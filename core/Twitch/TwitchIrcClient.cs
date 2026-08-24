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
    private volatile TwitchState _state = TwitchState.Disconnected;
    private bool _sawJoin;
    private bool _sawMessage;

    public TwitchState State => _state;

    public void Connect(string accessToken, string login)
    {
        lock (_connectLock)
        {
            _accessToken = accessToken;
            _login = login.ToLowerInvariant();
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
        return await SendAsync($"PRIVMSG #{_login} :{trimmed}").ConfigureAwait(false);
    }

    public async Task<(bool Ok, string? Error)> UpdateChannelTitleAsync(string title)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(_login) || string.IsNullOrWhiteSpace(_accessToken)) return (false, "TWITCH SESSION IS NOT READY");
        try
        {
            using var userRequest = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?login={Uri.EscapeDataString(_login)}");
            AddHelixHeaders(userRequest);
            using var userResponse = await Helix.SendAsync(userRequest).ConfigureAwait(false);
            if (!userResponse.IsSuccessStatusCode) return (false, await ReadHelixErrorAsync(userResponse).ConfigureAwait(false));
            using var userDoc = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync().ConfigureAwait(false));
            var users = userDoc.RootElement.GetProperty("data");
            if (users.GetArrayLength() == 0) return (false, "BROADCASTER USER NOT FOUND");
            var userId = users[0].GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(userId)) return (false, "BROADCASTER ID NOT FOUND");

            using var updateRequest = new HttpRequestMessage(HttpMethod.Patch, $"https://api.twitch.tv/helix/channels?broadcaster_id={Uri.EscapeDataString(userId)}")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { title = title.Trim()[..Math.Min(title.Trim().Length, 140)] }), Encoding.UTF8, "application/json"),
            };
            AddHelixHeaders(updateRequest);
            using var updateResponse = await Helix.SendAsync(updateRequest).ConfigureAwait(false);
            return updateResponse.IsSuccessStatusCode
                ? (true, null)
                : (false, await ReadHelixErrorAsync(updateResponse).ConfigureAwait(false));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
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
                await SendAsync($"JOIN #{_login}").ConfigureAwait(false);
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
        if (line.Contains($" JOIN #{_login}", StringComparison.Ordinal))
        {
            if (!_sawJoin)
            {
                _sawJoin = true;
                Info?.Invoke(new TwitchInfo("chat-joined", _login));
            }
            return;
        }
        if (line.Contains(" NOTICE ", StringComparison.Ordinal))
        {
            var colon = line.LastIndexOf(':');
            Info?.Invoke(new TwitchInfo("notice", colon >= 0 ? line[(colon + 1)..] : line));
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
        var idx = line.IndexOf(" PRIVMSG ", StringComparison.Ordinal);
        if (idx < 0) return;
        var prefix = line[..idx];
        var rest = line[(idx + 9)..];
        var colon = rest.IndexOf(':');
        if (colon < 0) return;
        var message = rest[(colon + 1)..];

        var sender = "unknown";
        var bang = prefix.IndexOf('!');
        if (bang > 0)
        {
            var nameStart = prefix.IndexOf(':');
            sender = prefix[(nameStart + 1)..bang];
        }

        var isBroadcaster = false;
        var isMod = false;
        var isVip = false;
        var isSubscriber = false;
        if (prefix.StartsWith('@'))
        {
            foreach (var tag in prefix[1..].Split(';'))
            {
                if (!tag.StartsWith("badges=", StringComparison.Ordinal)) continue;
                foreach (var badge in tag[7..].Split(','))
                {
                    var parts = badge.Split('/');
                    if (parts.Length != 2) continue;
                    if (!int.TryParse(parts[1], out var version) || version <= 0) continue;
                    switch (parts[0])
                    {
                        case "broadcaster": isBroadcaster = true; break;
                        case "moderator": isMod = true; break;
                        case "vip": isVip = true; break;
                        case "subscriber": isSubscriber = true; break;
                    }
                }
            }
        }

        ChatMessageReceived?.Invoke(new ChatMessage
        {
            Id = Guid.NewGuid().ToString(),
            Username = sender,
            IsBroadcaster = isBroadcaster,
            IsMod = isMod,
            IsVip = isVip,
            IsSubscriber = isSubscriber,
            Message = message,
            Timestamp = DateTime.UtcNow.ToString("O"),
        });
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
        _cts.Dispose();
    }
}
