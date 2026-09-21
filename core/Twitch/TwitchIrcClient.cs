using System.Collections.Concurrent;
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
    public event Action<TwitchRaidEvent>? RaidReceived;
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

    private readonly PendingRemodManager _remodManager;
    private readonly ConcurrentDictionary<string, (bool IsMod, bool IsLeadMod)> _chatterRoles = new(StringComparer.OrdinalIgnoreCase);
    private System.Threading.Timer? _remodTimer;
    private int _processingRemods;

    public PendingRemodManager RemodManager => _remodManager;
    private readonly ConcurrentDictionary<string, (string UserId, string Login, string DisplayName)> _knownChatters = new(StringComparer.OrdinalIgnoreCase);

    public Func<Task<string?>>? TokenRefreshRequested { get; set; }

    public void UpdateAccessToken(string accessToken)
    {
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            _accessToken = accessToken;
        }
    }

    private void RememberChatter(string userId, string login, string displayName)
    {
        var info = (userId, login, displayName);
        _knownChatters[userId] = info;
        _knownChatters[login] = info;
        _knownChatters[displayName] = info;
        var norm = TwitchPrivmsgParser.NormalizeArabic(displayName);
        if (!string.IsNullOrWhiteSpace(norm))
        {
            _knownChatters[norm] = info;
        }
    }

    private async Task<HttpResponseMessage> SendHelixWithRetryAsync(
        Func<HttpRequestMessage> requestFactory,
        CancellationToken cancellationToken = default)
    {
        var request = requestFactory();
        AddHelixHeaders(request);
        var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);

        if (response.StatusCode == HttpStatusCode.Unauthorized && TokenRefreshRequested != null)
        {
            response.Dispose();
            string? newToken = null;
            try
            {
                newToken = await TokenRefreshRequested().ConfigureAwait(false);
            }
            catch
            {
                // ignore
            }

            if (!string.IsNullOrWhiteSpace(newToken))
            {
                _accessToken = newToken;
                var retryRequest = requestFactory();
                AddHelixHeaders(retryRequest);
                return await Helix.SendAsync(retryRequest, cancellationToken).ConfigureAwait(false);
            }

            var finalRequest = requestFactory();
            AddHelixHeaders(finalRequest);
            return await Helix.SendAsync(finalRequest, cancellationToken).ConfigureAwait(false);
        }

        return response;
    }

    public TwitchIrcClient(string? pendingRemodsPath = null)
    {
        _remodManager = new PendingRemodManager(pendingRemodsPath);
    }

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

    private async Task<(string? Id, string? Error)> GetBroadcasterIdAsync(CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(_cachedBroadcasterId)) return (_cachedBroadcasterId, null);
        if (string.IsNullOrWhiteSpace(_login) || string.IsNullOrWhiteSpace(_accessToken)) return (null, "TWITCH SESSION IS NOT READY");

        try
        {
            var channelToQuery = string.IsNullOrWhiteSpace(_channel) ? _login : _channel;
            using var userResponse = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?login={Uri.EscapeDataString(channelToQuery)}"),
                cancellationToken).ConfigureAwait(false);
            if (!userResponse.IsSuccessStatusCode) return (null, await ReadHelixErrorAsync(userResponse).ConfigureAwait(false));
            using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
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

    private async Task<(string? Id, string? Error)> GetModeratorIdAsync(CancellationToken cancellationToken = default)
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
            using var userResponse = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?login={Uri.EscapeDataString(_login)}"),
                cancellationToken).ConfigureAwait(false);
            if (!userResponse.IsSuccessStatusCode) return (null, await ReadHelixErrorAsync(userResponse).ConfigureAwait(false));
            using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
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
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/channels?broadcaster_id={Uri.EscapeDataString(userId)}")).ConfigureAwait(false);
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
            using var updateResponse = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Patch, $"https://api.twitch.tv/helix/channels?broadcaster_id={Uri.EscapeDataString(userId)}")
                {
                    Content = new StringContent(JsonSerializer.Serialize(new { title = trimmed }), Encoding.UTF8, "application/json"),
                }).ConfigureAwait(false);
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
        using var response = await SendHelixWithRetryAsync(
            () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?{query}"),
            cancellationToken).ConfigureAwait(false);
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

        // 1. Check in-memory known chatters cache first
        if (_knownChatters.TryGetValue(target, out var known))
        {
            return (true, known.UserId, known.Login, known.DisplayName, null, null);
        }
        var norm = TwitchPrivmsgParser.NormalizeArabic(target);
        if (!string.IsNullOrWhiteSpace(norm) && _knownChatters.TryGetValue(norm, out known))
        {
            return (true, known.UserId, known.Login, known.DisplayName, null, null);
        }

        var isDigits = target.All(char.IsDigit);
        var isNonAscii = target.Any(c => c > 127);

        try
        {
            if (isDigits || !isNonAscii)
            {
                var param = isDigits ? $"id={Uri.EscapeDataString(target)}" : $"login={Uri.EscapeDataString(target)}";
                using var response = await SendHelixWithRetryAsync(
                    () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?{param}"),
                    cancellationToken).ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                {
                    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
                    var data = document.RootElement.GetProperty("data");
                    if (data.GetArrayLength() > 0)
                    {
                        var user = data[0];
                        var userId = user.GetProperty("id").GetString();
                        var login = user.GetProperty("login").GetString();
                        var displayName = user.TryGetProperty("display_name", out var dn) ? dn.GetString() : login;
                        var avatarUrl = user.TryGetProperty("profile_image_url", out var av) ? av.GetString() : null;

                        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(login))
                        {
                            RememberChatter(userId, login, displayName ?? login);
                        }

                        return (true, userId, login, displayName, avatarUrl, null);
                    }
                }
            }

            // Fallback for non-ASCII (e.g. Arabic display names) or if direct lookup returned no user:
            // Query Helix search/channels which indexes localized display names
            using var searchResp = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/search/channels?query={Uri.EscapeDataString(target)}&first=10"),
                cancellationToken).ConfigureAwait(false);
            if (searchResp.IsSuccessStatusCode)
            {
                using var searchDoc = JsonDocument.Parse(await searchResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
                var channels = searchDoc.RootElement.GetProperty("data");
                string? matchedChannelId = null;
                string? matchedLogin = null;
                string? matchedDisplayName = null;
                string? matchedThumbnail = null;

                var normTarget = TwitchPrivmsgParser.NormalizeArabic(target);
                foreach (var channel in channels.EnumerateArray())
                {
                    var chId = channel.GetProperty("id").GetString();
                    var chLogin = channel.TryGetProperty("broadcaster_login", out var bl) ? bl.GetString() : null;
                    var chDisplay = channel.TryGetProperty("display_name", out var cd) ? cd.GetString() : chLogin;
                    var chThumb = channel.TryGetProperty("thumbnail_url", out var tu) ? tu.GetString() : null;

                    if (string.Equals(chDisplay, target, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(chLogin, target, StringComparison.OrdinalIgnoreCase) ||
                        (!string.IsNullOrEmpty(normTarget) && TwitchPrivmsgParser.NormalizeArabic(chDisplay ?? string.Empty) == normTarget))
                    {
                        matchedChannelId = chId;
                        matchedLogin = chLogin;
                        matchedDisplayName = chDisplay;
                        matchedThumbnail = chThumb;
                        break;
                    }

                    if (matchedChannelId == null && isNonAscii)
                    {
                        matchedChannelId = chId;
                        matchedLogin = chLogin;
                        matchedDisplayName = chDisplay;
                        matchedThumbnail = chThumb;
                    }
                }

                if (!string.IsNullOrWhiteSpace(matchedChannelId))
                {
                    // Fetch full profile by ID to obtain official avatar and user info
                    using var userByIdResp = await SendHelixWithRetryAsync(
                        () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?id={Uri.EscapeDataString(matchedChannelId)}"),
                        cancellationToken).ConfigureAwait(false);
                    if (userByIdResp.IsSuccessStatusCode)
                    {
                        using var userByIdDoc = JsonDocument.Parse(await userByIdResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
                        var uData = userByIdDoc.RootElement.GetProperty("data");
                        if (uData.GetArrayLength() > 0)
                        {
                            var u = uData[0];
                            var uId = u.GetProperty("id").GetString();
                            var uLog = u.GetProperty("login").GetString();
                            var uDisp = u.TryGetProperty("display_name", out var ud) ? ud.GetString() : uLog;
                            var uAv = u.TryGetProperty("profile_image_url", out var ua) ? ua.GetString() : matchedThumbnail;
                            if (!string.IsNullOrWhiteSpace(uId) && !string.IsNullOrWhiteSpace(uLog))
                            {
                                RememberChatter(uId, uLog, uDisp ?? uLog);
                            }
                            return (true, uId, uLog, uDisp, uAv, null);
                        }
                    }
                    if (!string.IsNullOrWhiteSpace(matchedChannelId) && !string.IsNullOrWhiteSpace(matchedLogin))
                    {
                        RememberChatter(matchedChannelId, matchedLogin, matchedDisplayName ?? matchedLogin);
                    }
                    return (true, matchedChannelId, matchedLogin, matchedDisplayName, matchedThumbnail, null);
                }
            }

            return (false, null, target, null, null, $"TWITCH USER NOT FOUND: {target}");
        }
        catch (Exception ex)
        {
            return (false, null, target, null, null, ex.Message);
        }
    }

    private async Task<(bool Ok, string? UserId, string? Login, string? Error)> ResolveTargetUserAsync(
        string cleanTarget,
        CancellationToken cancellationToken)
    {
        if (cleanTarget.All(char.IsDigit))
        {
            if (_knownChatters.TryGetValue(cleanTarget, out var known))
            {
                return (true, cleanTarget, known.Login, null);
            }
            return (true, cleanTarget, cleanTarget, null);
        }

        if (_knownChatters.TryGetValue(cleanTarget, out var knownUser))
        {
            return (true, knownUser.UserId, knownUser.Login, null);
        }

        var norm = TwitchPrivmsgParser.NormalizeArabic(cleanTarget);
        if (!string.IsNullOrWhiteSpace(norm) && _knownChatters.TryGetValue(norm, out knownUser))
        {
            return (true, knownUser.UserId, knownUser.Login, null);
        }

        var profile = await CheckUserProfileAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!profile.Ok || string.IsNullOrWhiteSpace(profile.UserId))
        {
            return (false, null, null, profile.Error ?? "USER_NOT_FOUND");
        }

        return (true, profile.UserId, profile.Login ?? cleanTarget, null);
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
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id={Uri.EscapeDataString(userId)}"),
                cancellationToken).ConfigureAwait(false);
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
        _remodTimer = new System.Threading.Timer(_ => _ = ProcessPendingRemodsAsync(), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
    }

    private async Task ProcessPendingRemodsAsync()
    {
        if (_state != TwitchState.Connected || string.IsNullOrWhiteSpace(_accessToken)) return;
        if (Interlocked.CompareExchange(ref _processingRemods, 1, 0) != 0) return;

        try
        {
            await _remodManager.ProcessDueRemodsAsync(
                async (targetUserId, ct) => await CheckIsModeratorAsync(targetUserId, ct).ConfigureAwait(false),
                async (targetUserId, ct) => await ModUserAsync(targetUserId, ct).ConfigureAwait(false),
                async (entry, success, error) =>
                {
                    if (success)
                    {
                        Info?.Invoke(new TwitchInfo("remod-success", entry.TargetLogin));
                        if (entry.WasLeadMod)
                        {
                            Info?.Invoke(new TwitchInfo("remod-lead-mod-notice", $"{entry.TargetLogin}: Moderator privileges restored. (Lead Moderator: check Twitch Roles Manager if badge re-grant is needed)"));
                            await SendChatMessageAsync($"[Moderation] Restored moderator privileges for @{entry.TargetLogin}. (Lead Moderator)").ConfigureAwait(false);
                        }
                        else
                        {
                            await SendChatMessageAsync($"[Moderation] Restored moderator privileges for @{entry.TargetLogin}.").ConfigureAwait(false);
                        }
                    }
                    else
                    {
                        Info?.Invoke(new TwitchInfo("remod-status", $"{entry.TargetLogin}: {error}"));
                    }
                },
                _cts.Token).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Info?.Invoke(new TwitchInfo("remod-error", ex.Message));
        }
        finally
        {
            Interlocked.Exchange(ref _processingRemods, 0);
        }
    }

    public async Task<(bool Ok, bool IsMod, string? Error)> CheckIsModeratorAsync(string targetUsernameOrId, CancellationToken cancellationToken = default)
    {
        var cleanTarget = CleanUsername(targetUsernameOrId);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, false, "EMPTY_TARGET");

        var (userId, error) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(userId)) return (false, false, error ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, false, targetErr ?? "USER_NOT_FOUND");
        }

        if (string.Equals(targetUserId, userId, StringComparison.OrdinalIgnoreCase))
        {
            return (true, false, null);
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(userId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (ok, error) = await TimeoutUserDirectAsync(cleanTarget, durationSeconds, reason, cleanTarget, cancellationToken).ConfigureAwait(false);
        if (ok) return (true, null);

        if (error != null && error.Contains("moderator", StringComparison.OrdinalIgnoreCase))
        {
            var smartResult = await SmartModTimeoutAsync(cleanTarget, durationSeconds, reason, cancellationToken).ConfigureAwait(false);
            return (smartResult.Ok, smartResult.Error);
        }

        return (false, error);
    }

    private async Task<(bool Ok, string? Error)> TimeoutUserDirectAsync(string targetUserIdOrLogin, int durationSeconds, string? reason, string fallbackLogin, CancellationToken cancellationToken)
    {
        var cleanTarget = CleanUsername(targetUserIdOrLogin);
        if (string.IsNullOrWhiteSpace(cleanTarget)) return (false, "EMPTY_TARGET");

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var (targetResolved, targetUserId, resolvedLogin, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        var effectiveLogin = resolvedLogin ?? fallbackLogin;

        if (string.Equals(targetUserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(effectiveLogin, _channel, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(cleanTarget, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_TIMEOUT_BROADCASTER");
        }

        var duration = Math.Clamp(durationSeconds, 1, 1209600);
        var safeReason = string.IsNullOrWhiteSpace(reason) ? "Timed out via Streamer Hub" : reason.Trim();
        if (safeReason.Length > 500) safeReason = safeReason[..500];

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}")
                {
                    Content = new StringContent(JsonSerializer.Serialize(new
                    {
                        data = new
                        {
                            user_id = targetUserId,
                            duration = duration,
                            reason = safeReason,
                        }
                    }), Encoding.UTF8, "application/json")
                },
                cancellationToken).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, targetUserId));
                if (!string.IsNullOrWhiteSpace(effectiveLogin) && !string.Equals(effectiveLogin, targetUserId, StringComparison.OrdinalIgnoreCase))
                {
                    ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, effectiveLogin));
                }
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var (targetResolved, targetUserId, resolvedLogin, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        if (string.Equals(targetUserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(resolvedLogin, _channel, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(cleanTarget, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_BAN_BROADCASTER");
        }

        var safeReason = string.IsNullOrWhiteSpace(reason) ? "Banned via Streamer Hub" : reason.Trim();
        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}")
                {
                    Content = new StringContent(JsonSerializer.Serialize(new
                    {
                        data = new { user_id = targetUserId, reason = safeReason }
                    }), Encoding.UTF8, "application/json")
                },
                cancellationToken).ConfigureAwait(false);

            if (response.IsSuccessStatusCode)
            {
                ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, targetUserId));
                if (!string.IsNullOrWhiteSpace(resolvedLogin) && !string.Equals(resolvedLogin, targetUserId, StringComparison.OrdinalIgnoreCase))
                {
                    ChatCleared?.Invoke(new ChatClear(ChatClearScope.User, resolvedLogin));
                }
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, resolvedLogin, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        if (string.Equals(targetUserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(resolvedLogin, _channel, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(cleanTarget, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, "CANNOT_UNMOD_BROADCASTER");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/channels/vips?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/channels/vips?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(targetUserId)}"),
                cancellationToken).ConfigureAwait(false);
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
        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/chat?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/chat?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(moderatorId)}&message_id={Uri.EscapeDataString(messageId.Trim())}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId)) return (false, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (moderatorId, mErr) = await GetModeratorIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(moderatorId)) return (false, mErr ?? "MODERATOR_ID_NOT_FOUND");

        var (targetResolved, targetUserId, _, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
        {
            return (false, targetErr ?? "USER_NOT_FOUND");
        }

        try
        {
            using var response = await SendHelixWithRetryAsync(
                () => new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/chat/shoutouts?from_broadcaster_id={Uri.EscapeDataString(broadcasterId)}&to_broadcaster_id={Uri.EscapeDataString(targetUserId)}&moderator_id={Uri.EscapeDataString(moderatorId)}"),
                cancellationToken).ConfigureAwait(false);
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

        var (broadcasterId, bErr) = await GetBroadcasterIdAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(broadcasterId))
            return (false, false, cleanTarget, bErr ?? "BROADCASTER_ID_NOT_FOUND");

        var (targetResolved, targetUserId, resolvedLogin, targetErr) = await ResolveTargetUserAsync(cleanTarget, cancellationToken).ConfigureAwait(false);
        if (!targetResolved || string.IsNullOrWhiteSpace(targetUserId))
            return (false, false, cleanTarget, targetErr ?? "USER_NOT_FOUND");

        var targetLogin = resolvedLogin ?? cleanTarget;

        if (string.Equals(targetUserId, broadcasterId, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(targetLogin, _channel, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(cleanTarget, _channel, StringComparison.OrdinalIgnoreCase))
        {
            return (false, false, targetLogin, "CANNOT_TIMEOUT_BROADCASTER");
        }

        var duration = Math.Clamp(durationSeconds, 1, 1209600);
        var timeoutReason = string.IsNullOrWhiteSpace(reason)
            ? "Timed out via Streamer Hub"
            : reason.Trim();

        // Check if user is known as a Lead Mod or standard Mod from recent chat messages or badge cache
        var isLeadMod = false;
        if (_chatterRoles.TryGetValue(targetLogin, out var cachedRole) ||
            _chatterRoles.TryGetValue(targetUserId, out cachedRole))
        {
            isLeadMod = cachedRole.IsLeadMod;
        }

        var (checkOk, isMod, _) = await CheckIsModeratorAsync(targetUserId, cancellationToken).ConfigureAwait(false);
        var targetIsMod = (checkOk && isMod) || isLeadMod;

        if (!targetIsMod)
        {
            // First try a direct timeout
            var (directOk, directErr) = await TimeoutUserDirectAsync(targetUserId, duration, timeoutReason, targetLogin, cancellationToken).ConfigureAwait(false);
            if (directOk) return (true, false, targetLogin, null);
            if (directErr == null || !directErr.Contains("moderator", StringComparison.OrdinalIgnoreCase))
            {
                return (false, false, targetLogin, directErr);
            }
            // Direct timeout confirmed they are indeed a moderator on Twitch
            targetIsMod = true;
        }

        // Target is a moderator: Unmod -> wait for edge propagation -> Timeout -> Enqueue Remod
        var (unmodOk, unmodErr) = await UnmodUserAsync(targetUserId, cancellationToken).ConfigureAwait(false);
        if (!unmodOk)
        {
            if (unmodErr == null || !unmodErr.Contains("not a moderator", StringComparison.OrdinalIgnoreCase))
            {
                return (false, true, targetLogin, $"FAILED_TO_UNMOD_FOR_TIMEOUT: {unmodErr}");
            }
        }

        // Unmod propagation loop: Twitch distributed clusters can take 1-4 seconds to propagate the unmod
        bool timeoutOk = false;
        string? timeoutErr = null;
        var propagationDelays = new[] { 1000, 1200, 1500, 2000 };
        for (var attempt = 0; attempt < propagationDelays.Length; attempt++)
        {
            try
            {
                await Task.Delay(propagationDelays[attempt], cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            (timeoutOk, timeoutErr) = await TimeoutUserDirectAsync(targetUserId, duration, timeoutReason, targetLogin, cancellationToken).ConfigureAwait(false);
            if (timeoutOk) break;

            // If the error is not about being a moderator, do not keep retrying propagation
            if (timeoutErr == null || !timeoutErr.Contains("moderator", StringComparison.OrdinalIgnoreCase))
            {
                break;
            }
        }

        if (!timeoutOk)
        {
            // Rollback: try to restore mod status immediately so user is not left unmodded
            var (rollbackOk, _) = await ModUserAsync(targetUserId, CancellationToken.None).ConfigureAwait(false);
            if (!rollbackOk)
            {
                // If immediate rollback failed, enqueue to persistent manager so background retry loop handles it
                EnsureRemodTimerStarted();
                _remodManager.Enqueue(broadcasterId, targetUserId, targetLogin, DateTime.UtcNow.AddSeconds(2), wasLeadMod: isLeadMod);
            }
            return (false, true, targetLogin, $"FAILED_TO_TIMEOUT_MOD: {timeoutErr}");
        }

        // Enqueue remod with a 2-second safety buffer beyond duration to allow Twitch ban table to clear
        EnsureRemodTimerStarted();
        _remodManager.Enqueue(broadcasterId, targetUserId, targetLogin, DateTime.UtcNow.AddSeconds(duration).AddSeconds(2), wasLeadMod: isLeadMod);

        return (true, true, targetLogin, null);
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
        if (line.Contains(" USERNOTICE ", StringComparison.Ordinal))
        {
            if (TwitchUsernoticeParser.TryParseRaid(line, out var raid))
            {
                RaidReceived?.Invoke(raid);
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
            if (!string.IsNullOrWhiteSpace(message.UserLogin))
            {
                _chatterRoles[message.UserLogin] = (message.IsMod, message.IsLeadMod);
            }
            if (!string.IsNullOrWhiteSpace(message.UserId))
            {
                _chatterRoles[message.UserId] = (message.IsMod, message.IsLeadMod);
                var login = message.UserLogin ?? message.Username.ToLowerInvariant();
                var displayName = message.DisplayName ?? message.Username;
                RememberChatter(message.UserId, login, displayName);
            }

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
        var isLeadMod = false;
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
                            case "lead_moderator":
                            case "lead-moderator":
                                isLeadMod = true;
                                isMod = true;
                                break;
                            case "moderator":
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
        var cleanSender = !string.IsNullOrWhiteSpace(sender) && !string.Equals(sender, "unknown", StringComparison.OrdinalIgnoreCase)
            ? sender.ToLowerInvariant()
            : null;

        message = new ChatMessage
        {
            Id = !string.IsNullOrWhiteSpace(messageId) ? messageId : Guid.NewGuid().ToString(),
            Username = effectiveUsername,
            DisplayName = !string.IsNullOrWhiteSpace(displayName) ? displayName : effectiveUsername,
            UserLogin = cleanSender,
            UserId = string.IsNullOrWhiteSpace(userId) ? null : userId,
            IsBroadcaster = isBroadcaster,
            IsMod = isMod,
            IsLeadMod = isLeadMod,
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

    internal static string NormalizeArabic(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new System.Text.StringBuilder(text.Length);
        foreach (var ch in text.Trim())
        {
            if (ch is >= '\u064B' and <= '\u065F' or '\u0670' or '\u0640') continue;
            if (ch is 'أ' or 'إ' or 'آ' or 'ٱ') { sb.Append('ا'); continue; }
            if (ch is 'ة') { sb.Append('ه'); continue; }
            if (ch is 'ى') { sb.Append('ي'); continue; }
            sb.Append(char.ToLowerInvariant(ch));
        }
        return sb.ToString();
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

        var lastColon = line.LastIndexOf(':');
        if (lastColon > 0)
        {
            var trailing = line[(lastColon + 1)..].Trim();
            if (!string.IsNullOrEmpty(trailing) && !trailing.StartsWith("tmi.twitch.tv", StringComparison.OrdinalIgnoreCase))
            {
                clear = new ChatClear(ChatClearScope.User, trailing);
                return true;
            }
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

public static class TwitchUsernoticeParser
{
    public static bool TryParseRaid(string line, [NotNullWhen(true)] out TwitchRaidEvent? raid)
    {
        raid = null;
        if (string.IsNullOrEmpty(line)) return false;
        if (!line.Contains(" USERNOTICE ", StringComparison.Ordinal)) return false;

        var tags = ParseTags(line);
        if (!tags.TryGetValue("msg-id", out var msgId) || !string.Equals(msgId, "raid", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        tags.TryGetValue("user-id", out var userId);
        tags.TryGetValue("msg-param-login", out var login);
        if (string.IsNullOrWhiteSpace(login))
        {
            tags.TryGetValue("login", out login);
        }
        tags.TryGetValue("msg-param-displayName", out var displayName);
        if (string.IsNullOrWhiteSpace(displayName))
        {
            tags.TryGetValue("display-name", out displayName);
        }
        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = login ?? "Raider";
        }
        if (string.IsNullOrWhiteSpace(login))
        {
            login = displayName.ToLowerInvariant();
        }

        var viewers = 0;
        if (tags.TryGetValue("msg-param-viewerCount", out var viewerStr) && int.TryParse(viewerStr, out var vCount))
        {
            viewers = vCount;
        }

        raid = new TwitchRaidEvent(userId ?? string.Empty, displayName, login, viewers);
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
