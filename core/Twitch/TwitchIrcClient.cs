using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Twitch;

public enum TwitchState
{
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    AuthFailed,
    Stopped,
}

public sealed class TwitchIrcClient : ITwitchClient
{
    private static readonly HttpClient Helix = new();
    public event Action<ChatMessage>? ChatMessageReceived;
    public event Action<ChatClear>? ChatCleared;
    public event Action<TwitchState>? StateChanged;
    public event Action<TwitchInfo>? Info;

    private readonly object _connectLock = new();
    private CancellationTokenSource _cts = new();
    private TcpClient? _tcp;
    private StreamReader? _reader;
    private StreamWriter? _writer;
    private Task? _loop;
    private string _accessToken = string.Empty;
    private string _login = string.Empty;
    private string _channel = string.Empty;
    private volatile TwitchState _state = TwitchState.Disconnected;
    private bool _sawJoin;
    private bool _sawMessage;

    private string? _cachedBroadcasterId;
    private string? _cachedModeratorId;
    private string? _lastKnownTitle;

    private readonly List<PendingRemodItem> _pendingRemods = new();
    private readonly object _pendingRemodsLock = new();
    private System.Threading.Timer? _remodTimer;

    public TwitchState State => _state;

    public void Connect(string accessToken, string login, string? channel = null)
    {
        lock (_connectLock)
        {
            _accessToken = accessToken;
            _login = login.ToLowerInvariant();
            _channel = string.IsNullOrWhiteSpace(channel) ? _login : channel.Trim().ToLowerInvariant();
            _cachedBroadcasterId = null;
            _cachedModeratorId = null;
            _lastKnownTitle = null;
            if (_loop is { IsCompleted: false })
            {
                _cts.Cancel();
                try
                {
                    _tcp?.Close();
                }
                catch
                {
                }
                try
                {
                    _loop.GetAwaiter().GetResult();
                }
                catch
                {
                }
            }
            _cts = new CancellationTokenSource();
            _loop = Task.Run(LoopAsync);
        }
    }

    public void Disconnect()
    {
        _cts.Cancel();
        _cachedBroadcasterId = null;
        _cachedModeratorId = null;
        _lastKnownTitle = null;
        try
        {
            _tcp?.Close();
        }
        catch
        {
        }
    }

    public async Task<bool> SendChatMessageAsync(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || string.IsNullOrWhiteSpace(_login)) return false;
        var trimmed = message.Trim();
        if (trimmed.Length > 500) trimmed = trimmed[..500];
        return await SendAsync($"PRIVMSG #{_channel} :{trimmed}").ConfigureAwait(false);
    }

    private async Task<(string? Id, string? Error)> GetBroadcasterIdAsync()
    {
        if (!string.IsNullOrWhiteSpace(_cachedBroadcasterId)) return (_cachedBroadcasterId, null);
        if (string.IsNullOrWhiteSpace(_login) || string.IsNullOrWhiteSpace(_accessToken)) return (null, "TWITCH SESSION IS NOT READY");

        try
        {
            var channelToQuery = string.IsNullOrWhiteSpace(_channel) ? _login : _channel;
            using var userRequest = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?login={Uri.EscapeDataString(channelToQuery)}");
            AddHelixHeaders(userRequest);
            using var userResponse = await Helix.SendAsync(userRequest).ConfigureAwait(false);
            if (!userResponse.IsSuccessStatusCode) return (null, await ReadHelixErrorAsync(userResponse).ConfigureAwait(false));
            using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync().ConfigureAwait(false));
            var users = userDoc.RootElement.GetProperty("data");
            if (users.GetArrayLength() == 0) return (null, "BROADCASTER USER NOT FOUND");
            var userId = users[0].GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(userId)) return (null, "BROADCASTER ID NOT FOUND");
            _cachedBroadcasterId = userId;
            return (userId, null);
        }
        catch (Exception ex)
        {
            return (null, ex.Message);
        }
    }

    private async Task<(string? Id, string? Error)> GetModeratorIdAsync()
    {
        if (!string.IsNullOrWhiteSpace(_cachedModeratorId)) return (_cachedModeratorId, null);
        if (string.IsNullOrWhiteSpace(_login) || string.IsNullOrWhiteSpace(_accessToken)) return (null, "TWITCH SESSION IS NOT READY");

        if (string.Equals(_channel, _login, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(_cachedBroadcasterId))
        {
            _cachedModeratorId = _cachedBroadcasterId;
            return (_cachedModeratorId, null);
        }

        try
        {
            using var userRequest = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?login={Uri.EscapeDataString(_login)}");
            AddHelixHeaders(userRequest);
            using var userResponse = await Helix.SendAsync(userRequest).ConfigureAwait(false);
            if (!userResponse.IsSuccessStatusCode) return (null, await ReadHelixErrorAsync(userResponse).ConfigureAwait(false));
            using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync().ConfigureAwait(false));
            var users = userDoc.RootElement.GetProperty("data");
            if (users.GetArrayLength() == 0) return (null, "MODERATOR USER NOT FOUND");
            var userId = users[0].GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(userId)) return (null, "MODERATOR ID NOT FOUND");
            _cachedModeratorId = userId;
            return (userId, null);
        }
        catch (Exception ex)
        {
            return (null, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Title, string? Error)> GetChannelTitleAsync()
    {
        var (userId, error) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(userId)) return (false, null, error ?? "BROADCASTER ID NOT FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/channels?broadcaster_id={Uri.EscapeDataString(userId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return (false, null, await ReadHelixErrorAsync(response).ConfigureAwait(false));
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync().ConfigureAwait(false));
            var data = doc.RootElement.GetProperty("data");
            if (data.GetArrayLength() == 0) return (false, null, "CHANNEL NOT FOUND");
            var title = data[0].TryGetProperty("title", out var titleProp) ? titleProp.GetString() : null;
            if (title is not null) _lastKnownTitle = title;
            return (true, title, null);
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }

    public void SetLastKnownTitle(string? title)
    {
        _lastKnownTitle = title;
    }

    public async Task<(bool Ok, string? Error)> UpdateChannelTitleAsync(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return (false, "EMPTY TITLE");
        var trimmed = title.Trim();
        if (trimmed.Length > 140) trimmed = trimmed[..140];

        var (userId, error) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(userId)) return (false, error ?? "BROADCASTER ID NOT FOUND");

        try
        {
            using var updateRequest = new HttpRequestMessage(HttpMethod.Patch, $"https://api.twitch.tv/helix/channels?broadcaster_id={Uri.EscapeDataString(userId)}")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { title = trimmed }), Encoding.UTF8, "application/json"),
            };
            AddHelixHeaders(updateRequest);
            using var updateResponse = await Helix.SendAsync(updateRequest).ConfigureAwait(false);
            if (updateResponse.IsSuccessStatusCode)
            {
                _lastKnownTitle = trimmed;
                return (true, null);
            }
            return (false, await ReadHelixErrorAsync(updateResponse).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<IReadOnlyDictionary<string, string?>> GetUserProfileImagesAsync(
        IReadOnlyList<string> userIds,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        if (userIds.Count is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(userIds), "Helix user lookups accept between 1 and 100 IDs.");
        if (string.IsNullOrWhiteSpace(_accessToken)) throw new InvalidOperationException("TWITCH SESSION IS NOT READY");

        var query = string.Join("&", userIds.Select(userId => $"id={Uri.EscapeDataString(userId)}"));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?{query}");
        AddHelixHeaders(request);
        using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException(await ReadHelixErrorAsync(response).ConfigureAwait(false));

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        var profiles = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var user in document.RootElement.GetProperty("data").EnumerateArray())
        {
            var userId = user.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(userId)) continue;
            profiles[userId] = user.TryGetProperty("profile_image_url", out var avatar)
                ? avatar.GetString()
                : null;
        }

        return profiles;
    }

    public async Task<(bool Ok, string? UserId, string? Login, string? DisplayName, string? AvatarUrl, string? Error)> CheckUserProfileAsync(
        string? usernameOrId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_accessToken))
        {
            return (false, null, null, null, null, "TWITCH SESSION IS NOT READY (NOT LOGGED IN)");
        }

        var target = usernameOrId?.Trim().TrimStart('@');
        if (string.IsNullOrWhiteSpace(target)) target = _login;
        if (string.IsNullOrWhiteSpace(target))
        {
            return (false, null, null, null, null, "NO USERNAME PROVIDED AND CHANNEL LOGIN UNKNOWN");
        }

        var param = target.All(char.IsDigit) ? $"id={Uri.EscapeDataString(target)}" : $"login={Uri.EscapeDataString(target)}";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?{param}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return (false, null, null, null, null, await ReadHelixErrorAsync(response).ConfigureAwait(false));
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
            var data = document.RootElement.GetProperty("data");
            if (data.GetArrayLength() == 0)
            {
                return (false, null, target, null, null, $"TWITCH USER NOT FOUND: {target}");
            }

            var user = data[0];
            var userId = user.GetProperty("id").GetString();
            var login = user.GetProperty("login").GetString();
            var displayName = user.TryGetProperty("display_name", out var dn) ? dn.GetString() : login;
            var avatarUrl = user.TryGetProperty("profile_image_url", out var av) ? av.GetString() : null;

            return (true, userId, login, displayName, avatarUrl, null);
        }
        catch (Exception ex)
        {
            return (false, null, target, null, null, ex.Message);
        }
    }

    public async Task<(bool Ok, IReadOnlyList<TwitchRewardInfo> Rewards, string? Error)> GetCustomRewardsAsync(
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_accessToken))
        {
            return (false, Array.Empty<TwitchRewardInfo>(), "TWITCH SESSION IS NOT READY (NOT LOGGED IN)");
        }

        var (userId, error) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return (false, Array.Empty<TwitchRewardInfo>(), error ?? "BROADCASTER ID NOT FOUND");
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id={Uri.EscapeDataString(userId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return (false, Array.Empty<TwitchRewardInfo>(), await ReadHelixErrorAsync(response).ConfigureAwait(false));
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
            var list = new List<TwitchRewardInfo>();
            if (document.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var reward in data.EnumerateArray())
                {
                    var id = reward.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? string.Empty : string.Empty;
                    var title = reward.TryGetProperty("title", out var titleProp) ? titleProp.GetString() ?? string.Empty : string.Empty;
                    var cost = reward.TryGetProperty("cost", out var costProp) && costProp.TryGetInt32(out var c) ? c : 0;
                    var prompt = reward.TryGetProperty("prompt", out var promptProp) ? promptProp.GetString() : null;
                    var userInputRequired = reward.TryGetProperty("is_user_input_required", out var inputProp) && inputProp.GetBoolean();

                    if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(title))
                    {
                        list.Add(new TwitchRewardInfo
                        {
                            Id = id,
                            Title = title,
                            Cost = cost,
                            Prompt = prompt,
                            UserInputRequired = userInputRequired,
                        });
                    }
                }
            }

            return (true, list, null);
        }
        catch (Exception ex)
        {
            return (false, Array.Empty<TwitchRewardInfo>(), ex.Message);
        }
    }

    private static string CleanUsername(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var firstWord = input.Trim().Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)[0];
        return firstWord.TrimStart('@', '!', '#').TrimEnd(',', ':', ';', '.');
    }

    private void EnsureRemodTimerStarted()
    {
        if (_remodTimer is not null) return;
        _remodTimer = new System.Threading.Timer(_ => ProcessPendingRemods(), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
    }

    private void RegisterPendingRemod(string broadcasterId, string targetUserId, string targetLogin, DateTime remodAtUtc)
    {
        EnsureRemodTimerStarted();
        lock (_pendingRemodsLock)
        {
            _pendingRemods.Add(new PendingRemodItem(broadcasterId, targetUserId, targetLogin, remodAtUtc));
        }
    }

    private void ProcessPendingRemods()
    {
        List<PendingRemodItem> due;
        lock (_pendingRemodsLock)
        {
            if (_pendingRemods.Count == 0) return;
            var now = DateTime.UtcNow;
            due = _pendingRemods.Where(item => now >= item.RemodAtUtc).ToList();
            if (due.Count > 0)
            {
                _pendingRemods.RemoveAll(item => now >= item.RemodAtUtc);
            }
        }

        foreach (var item in due)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var result = await ModUserAsync(item.TargetUserId).ConfigureAwait(false);
                    if (result.Ok)
                    {
                        Info?.Invoke(new TwitchInfo("remod-success", item.TargetLogin));
                        await SendChatMessageAsync($"[Moderation] Restored moderator privileges for @{item.TargetLogin}.").ConfigureAwait(false);
                    }
                    else
                    {
                        Info?.Invoke(new TwitchInfo("remod-failed", $"{item.TargetLogin}: {result.Error}"));
                        await SendChatMessageAsync($"/mod {item.TargetLogin}").ConfigureAwait(false);
                    }
                }
                catch (Exception ex)
                {
                    Info?.Invoke(new TwitchInfo("remod-error", $"{item.TargetLogin}: {ex.Message}"));
                }
            });
        }
    }

    public async Task<(bool Ok, bool IsMod, string? Error)> CheckIsModeratorAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, false, "EMPTY_TARGET");

        var (userId, error) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(userId)) return (false, false, error ?? "BROADCASTER_ID_NOT_FOUND");

        string targetUserId;
        if (cleanTarget.All(char.IsDigit))
        {
            targetUserId = cleanTarget;
        }
        else
        {
            var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
            if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId))
                return (false, false, profile.Error ?? "USER_NOT_FOUND");
            targetUserId = profile.UserId;
        }

        if (string.Equals(targetUserId, userId, StringComparison.OrdinalIgnoreCase))
        {
            return (true, false, null);
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(userId)}&user_id={Uri.EscapeDataString(targetUserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return (false, false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
            if (document.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                var isMod = data.GetArrayLength() > 0;
                return (true, isMod, null);
            }

            return (true, false, null);
        }
        catch (Exception ex)
        {
            return (false, false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> TimeoutUserAsync(string targetUsernameOrId, int durationSeconds, string? reason = null, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        if (string.Equals(profile.UserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(profile.Login, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_TIMEOUT_BROADCASTER");
        }

        var duration = Math.Clamp(durationSeconds, 1, 1209600);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "Timed out via Streamer Hub" : reason.Trim();
        if (safeReason.Length > 500) safeReason = safeReason[..500];

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}")
            {
                Content = new StringContent(JsonSerializer.Serialize(new
                {
                    data = new
                    {
                        user_id = profile.UserId,
                        duration = duration,
                        reason = safeReason,
                    }
                }), Encoding.UTF8, "application/json")
            };
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, cleanTarget));
                return (true, null);
            }

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> BanUserAsync(string targetUsernameOrId, string? reason = null, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        if (string.Equals(profile.UserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(profile.Login, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_BAN_BROADCASTER");
        }

        var safeReason = string.IsNullOrWhiteSpace(reason) ? "Banned via Streamer Hub" : reason.Trim();
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}")
            {
                Content = new StringContent(JsonSerializer.Serialize(new
                {
                    data = new { user_id = profile.UserId, reason = safeReason }
                }), Encoding.UTF8, "application/json")
            };
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, cleanTarget));
                return (true, null);
            }

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> UnbanUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}&user_id={Uri.EscapeDataString(profile.UserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> ModUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(profile.UserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> UnmodUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        if (string.Equals(profile.UserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(profile.Login, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_UNMOD_BROADCASTER");
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(profile.UserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> VipUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/channels/vips?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(profile.UserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> UnvipUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/channels/vips?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(profile.UserId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> ClearChatAsync(CancellationToken cancellationToken = default)
    {
        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/chat?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> DeleteChatMessageAsync(string messageId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(messageId)) return (false, "EMPTY_MESSAGE_ID");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/chat?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}&message_id={Uri.EscapeDataString(messageId.Trim())}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                ChatCleared?.Invoke(new ChatClear(ChatClearScope.Message, messageId.Trim()));
                return (true, null);
            }

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, string? Error)> SendShoutoutAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId)) return (false, profile.Error ?? "USER_NOT_FOUND");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/chat/shoutouts?from_broadcaster_id={Uri.EscapeDataString(broadcasterId)}&to_broadcaster_id={Uri.EscapeDataString(profile.UserId)}&moderator_id={Uri.EscapeDataString(moderatorId)}");
            AddHelixHeaders(request);
            using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode) return (true, null);

            return (false, await ReadHelixErrorAsync(response).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Ok, bool WasMod, string? TargetUser, string? Error)> SmartModTimeoutAsync(
        string targetUsernameOrId,
        int durationSeconds,
        string? reason = null,
        CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget))
            return (false, false, null, "EMPTY_TARGET_USERNAME");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId))
            return (false, false, cleanTarget, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId))
            return (false, false, cleanTarget, profile.Error ?? "USER_NOT_FOUND");

        var targetUserId = profile.UserId;
        var targetLogin = profile.Login ?? cleanTarget;

        if (string.Equals(targetUserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(targetLogin, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, false, targetLogin, "CANNOT_TIMEOUT_BROADCASTER");
        }

        var duration = Math.Clamp(durationSeconds, 1, 1209600);
        var timeoutReason = string.IsNullOrWhiteSpace(reason)
            ? "Timed out via Streamer Hub"
            : reason.Trim();

        var (checkOk, isMod, _) = await CheckIsModeratorAsync(targetUserId, cancellationToken).ConfigureAwait(false);

        if (checkOk && isMod)
        {
            var (unmodOk, unmodErr) = await UnmodUserAsync(targetUserId, cancellationToken).ConfigureAwait(false);
            if (!unmodOk)
            {
                return (false, true, targetLogin, $"FAILED_TO_UNMOD_FOR_TIMEOUT: {unmodErr}");
            }

            try
            {
                await Task.Delay(1200, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
            }

            RegisterPendingRemod(broadcasterId, targetUserId, targetLogin, DateTime.UtcNow.AddSeconds(duration));

            var (timeoutOk, timeoutErr) = await TimeoutUserAsync(targetUserId, duration, timeoutReason, cancellationToken).ConfigureAwait(false);
            if (!timeoutOk)
            {
                _ = ModUserAsync(targetUserId, CancellationToken.None);
                return (false, true, targetLogin, $"FAILED_TO_TIMEOUT_MOD: {timeoutErr}");
            }

            return (true, true, targetLogin, null);
        }
        else
        {
            var (timeoutOk, timeoutErr) = await TimeoutUserAsync(targetUserId, duration, timeoutReason, cancellationToken).ConfigureAwait(false);
            if (!timeoutOk && timeoutErr != null && timeoutErr.Contains("moderator", StringComparison.OrdinalIgnoreCase))
            {
                var (unmodOk, _) = await UnmodUserAsync(targetUserId, cancellationToken).ConfigureAwait(false);
                if (unmodOk)
                {
                    try { await Task.Delay(1200, cancellationToken).ConfigureAwait(false); } catch { }
                    RegisterPendingRemod(broadcasterId, targetUserId, targetLogin, DateTime.UtcNow.AddSeconds(duration));
                    var (retryOk, retryErr) = await TimeoutUserAsync(targetUserId, duration, timeoutReason, cancellationToken).ConfigureAwait(false);
                    if (!retryOk)
                    {
                        _ = ModUserAsync(targetUserId, CancellationToken.None);
                        return (false, true, targetLogin, retryErr);
                    }
                    return (true, true, targetLogin, null);
                }
            }

            return (timeoutOk, false, targetLogin, timeoutErr);
        }
    }

    private static async Task<string> ReadHelixErrorAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
        return $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {body.Replace('\n', ' ').Replace('\r', ' ').Trim()}";
    }

    private void AddHelixHeaders(HttpRequestMessage request)
    {
        request.Headers.TryAddWithoutValidation("Client-Id", TwitchConstants.ClientId);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_accessToken}");
    }

    private void SetState(TwitchState state)
    {
        if (_state == state) return;
        _state = state;
        StateChanged?.Invoke(state);
    }

    private async Task LoopAsync()
    {
        var delay = TimeSpan.FromSeconds(1);
        while (!_cts.IsCancellationRequested)
        {
            try
            {
                SetState(_state == TwitchState.Connected ? TwitchState.Reconnecting : TwitchState.Connecting);
                var tcp = new TcpClient { NoDelay = true };
                await tcp.ConnectAsync(TwitchConstants.IrcHost, TwitchConstants.IrcPort, _cts.Token).ConfigureAwait(false);
                var ssl = new SslStream(tcp.GetStream(), false);
                await ssl.AuthenticateAsClientAsync(
                        new SslClientAuthenticationOptions { TargetHost = TwitchConstants.IrcHost },
                        _cts.Token)
                    .ConfigureAwait(false);
                var reader = new StreamReader(ssl, Encoding.UTF8);
                var writer = new StreamWriter(ssl, new UTF8Encoding(false)) { NewLine = "\r\n", AutoFlush = true };
                _tcp = tcp;
                _reader = reader;
                _writer = writer;
                await SendAsync("CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands").ConfigureAwait(false);
                await SendAsync($"PASS oauth:{_accessToken}").ConfigureAwait(false);
                await SendAsync($"NICK {_login}").ConfigureAwait(false);
                await SendAsync($"JOIN #{_channel}").ConfigureAwait(false);
                SetState(TwitchState.Connected);
                delay = TimeSpan.FromSeconds(1);
                string? line;
                while (!_cts.IsCancellationRequested && (line = await reader.ReadLineAsync().ConfigureAwait(false)) is not null)
                {
                    try
                    {
                        ProcessLine(line);
                    }
                    catch
                    {
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                if (_state == TwitchState.AuthFailed) break;
                SetState(TwitchState.Reconnecting);
                Info?.Invoke(new TwitchInfo("connect-failed", Truncate(ex.Message)));
                try
                {
                    await Task.Delay(delay, _cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                delay = delay.TotalSeconds >= 60
                    ? TimeSpan.FromSeconds(60)
                    : TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 60));
            }
        }
        SetState(TwitchState.Stopped);
    }

    private void ProcessLine(string line)
    {
        if (line.StartsWith("PING", StringComparison.Ordinal))
        {
            var token = line.Length > 5 ? line[5..].Trim() : "tmi.twitch.tv";
            _ = SendAsync("PONG :" + token);
            return;
        }
        if (line.Contains("Login authentication failed", StringComparison.Ordinal))
        {
            Info?.Invoke(new TwitchInfo("auth-failed", null));
            SetState(TwitchState.AuthFailed);
            return;
        }
        if (line.Contains($" JOIN #{_channel}", StringComparison.Ordinal))
        {
            if (!_sawJoin)
            {
                _sawJoin = true;
                Info?.Invoke(new TwitchInfo("chat-joined", _channel));
            }
            return;
        }
        if (line.Contains(" NOTICE ", StringComparison.Ordinal))
        {
            var colon = line.LastIndexOf(':');
            Info?.Invoke(new TwitchInfo("notice", colon >= 0 ? line[(colon + 1)..] : line));
            return;
        }
        if (line.Contains(" CLEARMSG ", StringComparison.Ordinal) || line.Contains(" CLEARCHAT ", StringComparison.Ordinal))
        {
            if (TwitchClearParser.TryParse(line, out var clear))
            {
                ChatCleared?.Invoke(clear);
            }
            return;
        }
        if (line.Contains(" PRIVMSG ", StringComparison.Ordinal))
        {
            if (!_sawMessage)
            {
                _sawMessage = true;
                Info?.Invoke(new TwitchInfo("messages-flowing", null));
            }
            HandlePrivmsg(line);
        }
    }

    private void HandlePrivmsg(string line)
    {
        if (TwitchPrivmsgParser.TryParse(line, DateTime.UtcNow, out var message))
        {
            ChatMessageReceived?.Invoke(message);
        }
    }

    private async Task<bool> SendAsync(string text)
    {
        var writer = _writer;
        if (writer is null || _cts.IsCancellationRequested) return false;
        try
        {
            await writer.WriteLineAsync(text).ConfigureAwait(false);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string Truncate(string value)
    {
        value = value.Replace('\n', ' ').Replace('\r', ' ').Trim();
        return value.Length <= 160 ? value : value[..160];
    }

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        try
        {
            _tcp?.Close();
        }
        catch
        {
        }
        if (_loop is not null)
        {
            try
            {
                await _loop.ConfigureAwait(false);
            }
            catch
            {
            }
        }
        _remodTimer?.Dispose();
        _remodTimer = null;
        _cts.Dispose();
    }
}

public static class TwitchPrivmsgParser
{
    public static bool TryParse(string line, DateTime timestamp, [NotNullWhen(true)] out ChatMessage? message)
    {
        message = null;
        var idx = line.IndexOf(" PRIVMSG ", StringComparison.Ordinal);
        if (idx < 0) return false;
        var prefix = line[..idx];
        var rest = line[(idx + 9)..];
        var colon = rest.IndexOf(':');
        if (colon < 0) return false;
        var messageText = rest[(colon + 1)..];

        var sender = "unknown";
        var bang = prefix.IndexOf('!');
        if (bang > 0)
        {
            var nameStart = prefix.IndexOf(':');
            sender = prefix[(nameStart + 1)..bang];
        }

        string? userId = null;
        string? messageId = null;
        string? displayName = null;
        string? color = null;
        string? customRewardId = null;
        IReadOnlyList<EmoteRange> emotes = Array.Empty<EmoteRange>();
        var isBroadcaster = false;
        var isMod = false;
        var isVip = false;
        var isSubscriber = false;

        if (prefix.StartsWith('@'))
        {
            foreach (var tag in prefix[1..].Split(';'))
            {
                var eq = tag.IndexOf('=');
                if (eq < 0) continue;
                var key = tag[..eq];
                var val = tag[(eq + 1)..];

                if (string.Equals(key, "user-id", StringComparison.OrdinalIgnoreCase))
                {
                    userId = val;
                }
                else if (string.Equals(key, "id", StringComparison.OrdinalIgnoreCase))
                {
                    messageId = val;
                }
                else if (string.Equals(key, "display-name", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(val))
                {
                    displayName = val.Trim();
                }
                else if (string.Equals(key, "color", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(val))
                {
                    color = val.Trim();
                }
                else if (string.Equals(key, "emotes", StringComparison.OrdinalIgnoreCase))
                {
                    emotes = ParseEmotes(val);
                }
                else if (string.Equals(key, "custom-reward-id", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(val))
                {
                    customRewardId = val.Trim();
                }
                else if (string.Equals(key, "mod", StringComparison.OrdinalIgnoreCase) && val == "1")
                {
                    isMod = true;
                }
                else if (string.Equals(key, "user-type", StringComparison.OrdinalIgnoreCase) && string.Equals(val, "mod", StringComparison.OrdinalIgnoreCase))
                {
                    isMod = true;
                }
                else if (string.Equals(key, "badges", StringComparison.OrdinalIgnoreCase) || string.Equals(key, "badge-info", StringComparison.OrdinalIgnoreCase))
                {
                    foreach (var badge in val.Split(','))
                    {
                        var slash = badge.IndexOf('/');
                        var badgeName = slash >= 0 ? badge[..slash].Trim() : badge.Trim();
                        if (string.IsNullOrEmpty(badgeName)) continue;

                        switch (badgeName.ToLowerInvariant())
                        {
                            case "broadcaster":
                                isBroadcaster = true;
                                break;
                            case "moderator":
                            case "lead_moderator":
                            case "lead-moderator":
                                isMod = true;
                                break;
                            case "vip":
                                isVip = true;
                                break;
                            case "subscriber":
                            case "founder":
                                isSubscriber = true;
                                break;
                        }
                    }
                }
            }
        }

        var effectiveUsername = !string.IsNullOrWhiteSpace(displayName) ? displayName : sender;

        message = new ChatMessage
        {
            Id = !string.IsNullOrWhiteSpace(messageId) ? messageId : Guid.NewGuid().ToString(),
            Username = effectiveUsername,
            UserId = string.IsNullOrWhiteSpace(userId) ? null : userId,
            IsBroadcaster = isBroadcaster,
            IsMod = isMod,
            IsVip = isVip,
            IsSubscriber = isSubscriber,
            Message = messageText,
            Timestamp = timestamp.ToString("O"),
            Emotes = emotes,
            Color = color,
            CustomRewardId = customRewardId,
        };
        return true;
    }

    /// <summary>
    /// Parses the IRC <c>emotes</c> tag, formatted as
    /// <c>id:start-end,start-end/id2:start-end</c>.
    ///
    /// Offsets are code point indices into the message and are passed through
    /// unchanged; it is the renderer's job to slice by text element.
    /// </summary>
    internal static IReadOnlyList<EmoteRange> ParseEmotes(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<EmoteRange>();

        var ranges = new List<EmoteRange>();
        foreach (var group in value.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            var colon = group.IndexOf(':');
            if (colon <= 0 || colon == group.Length - 1) continue;

            var id = group[..colon].Trim();
            if (id.Length == 0) continue;

            foreach (var span in group[(colon + 1)..].Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var dash = span.IndexOf('-');
                if (dash <= 0) continue;
                if (!int.TryParse(span[..dash], out var start)) continue;
                if (!int.TryParse(span[(dash + 1)..], out var end)) continue;
                if (start < 0 || end < start) continue;
                ranges.Add(new EmoteRange(id, start, end));
            }
        }

        ranges.Sort((a, b) => a.Start.CompareTo(b.Start));
        return ranges;
    }
}

public static class TwitchClearParser
{
    /// <summary>
    /// Parses the moderation commands Twitch sends on the same connection:
    /// CLEARMSG deletes a single message, CLEARCHAT times out or bans a user
    /// (or clears the whole room when it carries no target).
    /// </summary>
    public static bool TryParse(string line, [NotNullWhen(true)] out ChatClear? clear)
    {
        clear = null;
        if (string.IsNullOrEmpty(line)) return false;

        var isClearMsg = line.Contains(" CLEARMSG ", StringComparison.Ordinal);
        var isClearChat = line.Contains(" CLEARCHAT ", StringComparison.Ordinal);
        if (!isClearMsg && !isClearChat) return false;

        var tags = ParseTags(line);

        if (isClearMsg)
        {
            // target-msg-id names the single message that was deleted.
            if (!tags.TryGetValue("target-msg-id", out var messageId) || string.IsNullOrWhiteSpace(messageId)) return false;
            clear = new ChatClear(ChatClearScope.Message, messageId.Trim());
            return true;
        }

        if (tags.TryGetValue("target-user-id", out var userId) && !string.IsNullOrWhiteSpace(userId))
        {
            clear = new ChatClear(ChatClearScope.User, userId.Trim());
            return true;
        }

        // A CLEARCHAT with no target clears the entire room.
        clear = new ChatClear(ChatClearScope.All, null);
        return true;
    }

    private static Dictionary<string, string> ParseTags(string line)
    {
        var tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!line.StartsWith('@')) return tags;

        var space = line.IndexOf(' ');
        if (space <= 1) return tags;

        foreach (var tag in line[1..space].Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = tag.IndexOf('=');
            if (eq <= 0) continue;
            tags[tag[..eq]] = tag[(eq + 1)..];
        }
        return tags;
    }
}

public sealed record PendingRemodItem(string BroadcasterId, string TargetUserId, string TargetLogin, DateTime RemodAtUtc);
