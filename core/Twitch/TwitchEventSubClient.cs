using System.Net.Http.Headers;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Twitch;

/// <summary>
/// Connects to Twitch EventSub WebSocket (wss://eventsub.wss.twitch.tv/ws)
/// to receive channel points redemptions in real-time without requiring chat input.
/// </summary>
public sealed class TwitchEventSubClient : IAsyncDisposable
{
    private static readonly Uri EventSubWsUri = new("wss://eventsub.wss.twitch.tv/ws");
    private static readonly HttpClient Http = new();

    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task? _listenTask;
    private string? _accessToken;
    private string? _broadcasterUserId;
    private bool _disposed;
    private readonly object _lock = new();

    public event Action<ChannelPointsRedemption>? ChannelPointsRedeemed;
    public event Action<string>? ChannelTitleUpdated;
    public event Action<TwitchRaidEvent>? RaidReceived;
    public event Action<string>? LogMessage;

    public void Connect(string accessToken, string broadcasterUserId)
    {
        lock (_lock)
        {
            if (_disposed) return;
            DisconnectInternal();

            _accessToken = accessToken;
            _broadcasterUserId = broadcasterUserId;
            _cts = new CancellationTokenSource();
            _listenTask = Task.Run(() => RunAsync(_cts.Token));
        }
    }

    public void Disconnect()
    {
        lock (_lock)
        {
            DisconnectInternal();
        }
    }

    private void DisconnectInternal()
    {
        try
        {
            _cts?.Cancel();
            _cts?.Dispose();
            _cts = null;
        }
        catch { }

        try
        {
            _ws?.Dispose();
            _ws = null;
        }
        catch { }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        var backoffMs = 1000;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var ws = new ClientWebSocket();
                _ws = ws;
                Log("Twitch EventSub connecting...");
                await ws.ConnectAsync(EventSubWsUri, ct).ConfigureAwait(false);
                Log("Twitch EventSub WebSocket connected.");
                backoffMs = 1000;

                var buffer = new byte[16384];
                var ms = new MemoryStream();

                while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                {
                    ms.SetLength(0);
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct).ConfigureAwait(false);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", ct).ConfigureAwait(false);
                            break;
                        }
                        ms.Write(buffer, 0, result.Count);
                    } while (!result.EndOfMessage);

                    if (result.MessageType == WebSocketMessageType.Close) break;

                    var json = Encoding.UTF8.GetString(ms.ToArray());
                    await HandleMessageAsync(json, ct).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                Log($"Twitch EventSub error: {ex.Message}");
            }

            if (!ct.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(backoffMs, ct).ConfigureAwait(false);
                    backoffMs = Math.Min(backoffMs * 2, 30000);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private async Task HandleMessageAsync(string json, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("metadata", out var metadata)) return;
            var messageType = metadata.TryGetProperty("message_type", out var typeProp) ? typeProp.GetString() : null;

            if (messageType == "session_welcome")
            {
                if (root.TryGetProperty("payload", out var payload) &&
                    payload.TryGetProperty("session", out var session) &&
                    session.TryGetProperty("id", out var sessionIdProp))
                {
                    var sessionId = sessionIdProp.GetString();
                    if (!string.IsNullOrWhiteSpace(sessionId))
                    {
                        Log($"Twitch EventSub session welcome received. SessionId: {sessionId}");
                        await SubscribeRedemptionsAsync(sessionId, ct).ConfigureAwait(false);
                        await SubscribeChannelUpdateAsync(sessionId, ct).ConfigureAwait(false);
                        await SubscribeRaidAsync(sessionId, ct).ConfigureAwait(false);
                    }
                }
            }
            else if (messageType == "notification")
            {
                var subType = metadata.TryGetProperty("subscription", out var sub) && sub.TryGetProperty("type", out var st)
                    ? st.GetString()
                    : null;

                if (root.TryGetProperty("payload", out var payload) &&
                    payload.TryGetProperty("event", out var ev))
                {
                    if (string.Equals(subType, "channel.raid", StringComparison.OrdinalIgnoreCase))
                    {
                        var fromUserId = ev.TryGetProperty("from_broadcaster_user_id", out var fId) ? fId.GetString() ?? string.Empty : string.Empty;
                        var fromUserName = ev.TryGetProperty("from_broadcaster_user_name", out var fName) ? fName.GetString() ?? string.Empty : string.Empty;
                        var fromUserLogin = ev.TryGetProperty("from_broadcaster_user_login", out var fLogin) ? fLogin.GetString() ?? string.Empty : string.Empty;
                        var viewers = ev.TryGetProperty("viewers", out var v) && v.TryGetInt32(out var count) ? count : 0;

                        var raid = new TwitchRaidEvent(fromUserId, fromUserName, fromUserLogin, viewers);
                        Log($"Twitch EventSub Raid: {fromUserName} raided with {viewers} viewers!");
                        RaidReceived?.Invoke(raid);
                    }
                    else if (string.Equals(subType, "channel.update", StringComparison.OrdinalIgnoreCase))
                    {
                        if (ev.TryGetProperty("title", out var titleProp))
                        {
                            var updatedTitle = titleProp.GetString() ?? string.Empty;
                            Log($"Twitch Channel Title Updated: \"{updatedTitle}\"");
                            ChannelTitleUpdated?.Invoke(updatedTitle);
                        }
                    }
                    else
                    {
                        var redemptionId = ev.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? Guid.NewGuid().ToString() : Guid.NewGuid().ToString();
                        var reward = ev.TryGetProperty("reward", out var r) ? r : default;
                        var rewardId = reward.ValueKind != JsonValueKind.Undefined && reward.TryGetProperty("id", out var rId) ? rId.GetString() ?? string.Empty : string.Empty;
                        var rewardTitle = reward.ValueKind != JsonValueKind.Undefined && reward.TryGetProperty("title", out var rTitle) ? rTitle.GetString() ?? string.Empty : string.Empty;
                        var rewardCost = reward.ValueKind != JsonValueKind.Undefined && reward.TryGetProperty("cost", out var rCost) && rCost.TryGetInt32(out var c) ? c : (int?)null;

                        var userId = ev.TryGetProperty("user_id", out var uId) ? uId.GetString() ?? string.Empty : string.Empty;
                        var userName = ev.TryGetProperty("user_name", out var uName) ? uName.GetString() ?? string.Empty : string.Empty;
                        var userLogin = ev.TryGetProperty("user_login", out var uLogin) ? uLogin.GetString() ?? string.Empty : string.Empty;
                        var userInput = ev.TryGetProperty("user_input", out var uInput) ? uInput.GetString() : null;
                        var redeemedAt = ev.TryGetProperty("redeemed_at", out var rAt) ? rAt.GetString() ?? DateTime.UtcNow.ToString("O") : DateTime.UtcNow.ToString("O");

                        var redemption = new ChannelPointsRedemption
                        {
                            Id = redemptionId,
                            RewardId = rewardId,
                            RewardTitle = rewardTitle,
                            RewardCost = rewardCost,
                            UserId = userId,
                            UserName = userName,
                            UserLogin = userLogin,
                            UserInput = userInput,
                            RedeemedAt = redeemedAt,
                        };

                        Log($"Channel Points Redemption: {userName} redeemed '{rewardTitle}'");
                        ChannelPointsRedeemed?.Invoke(redemption);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Twitch EventSub message parse error: {ex.Message}");
        }
    }

    private async Task SubscribeRedemptionsAsync(string sessionId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_accessToken) || string.IsNullOrWhiteSpace(_broadcasterUserId)) return;

        try
        {
            var body = new
            {
                type = "channel.channel_points_custom_reward_redemption.add",
                version = "1",
                condition = new
                {
                    broadcaster_user_id = _broadcasterUserId,
                },
                transport = new
                {
                    method = "websocket",
                    session_id = sessionId,
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.TryAddWithoutValidation("Client-Id", TwitchConstants.ClientId);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_accessToken}");

            using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                Log("Subscribed to Twitch Channel Points redemptions successfully.");
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                Log($"Failed to subscribe to channel points redemptions: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            Log($"Error subscribing to channel points redemptions: {ex.Message}");
        }
    }

    private async Task SubscribeChannelUpdateAsync(string sessionId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_accessToken) || string.IsNullOrWhiteSpace(_broadcasterUserId)) return;

        try
        {
            var body = new
            {
                type = "channel.update",
                version = "2",
                condition = new
                {
                    broadcaster_user_id = _broadcasterUserId,
                },
                transport = new
                {
                    method = "websocket",
                    session_id = sessionId,
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.TryAddWithoutValidation("Client-Id", TwitchConstants.ClientId);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_accessToken}");

            using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                Log("Subscribed to Twitch channel update events successfully.");
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                Log($"Failed to subscribe to channel update events: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            Log($"Error subscribing to channel update events: {ex.Message}");
        }
    }

    private async Task SubscribeRaidAsync(string sessionId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_accessToken) || string.IsNullOrWhiteSpace(_broadcasterUserId)) return;

        try
        {
            var body = new
            {
                type = "channel.raid",
                version = "1",
                condition = new
                {
                    to_broadcaster_user_id = _broadcasterUserId,
                },
                transport = new
                {
                    method = "websocket",
                    session_id = sessionId,
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/eventsub/subscriptions")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.TryAddWithoutValidation("Client-Id", TwitchConstants.ClientId);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_accessToken}");

            using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                Log("Subscribed to Twitch channel raid events successfully.");
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                Log($"Failed to subscribe to channel raid events: {response.StatusCode} - {error}");
            }
        }
        catch (Exception ex)
        {
            Log($"Error subscribing to channel raid events: {ex.Message}");
        }
    }

    private void Log(string message)
    {
        LogMessage?.Invoke(message);
    }

    public async ValueTask DisposeAsync()
    {
        lock (_lock)
        {
            if (_disposed) return;
            _disposed = true;
            DisconnectInternal();
        }

        if (_listenTask is not null)
        {
            try
            {
                await _listenTask.ConfigureAwait(false);
            }
            catch { }
        }
    }
}
