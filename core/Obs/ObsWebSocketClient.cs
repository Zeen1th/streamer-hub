using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace StreamerHub.Core.Obs;

public sealed record ObsAudioSourceInfo(string Name, string Kind, bool Muted);

public sealed class ObsWebSocketClient : IAsyncDisposable
{
    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task? _readLoopTask;
    private readonly object _lock = new();
    private readonly Dictionary<string, TaskCompletionSource<JsonElement>> _pendingRequests = new(StringComparer.Ordinal);

    private string _host = "127.0.0.1";
    private int _port = 4455;
    private string _password = string.Empty;
    private bool _disposed;
    private bool _isIdentified;

    public bool IsConnected => _ws?.State == WebSocketState.Open && _isIdentified;
    public string Host => _host;
    public int Port => _port;
    public bool HasPassword => !string.IsNullOrEmpty(_password);
    public string? LastError { get; private set; }

    public event Action<bool>? ConnectionChanged;
    public event Action<string>? LogMessage;

    public void Configure(string host, int port, string password)
    {
        lock (_lock)
        {
            _host = string.IsNullOrWhiteSpace(host) ? "127.0.0.1" : host.Trim();
            _port = port > 0 ? port : 4455;
            _password = password ?? string.Empty;
        }
    }

    public async Task<bool> ConnectAsync(CancellationToken cancellationToken = default)
    {
        DisconnectInternal();

        lock (_lock)
        {
            if (_disposed) return false;
            _cts = new CancellationTokenSource();
            _isIdentified = false;
            LastError = null;
        }

        try
        {
            var ws = new ClientWebSocket();
            ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(5);
            var uri = new Uri($"ws://{_host}:{_port}");

            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);
            
            await ws.ConnectAsync(uri, linkedCts.Token).ConfigureAwait(false);

            lock (_lock)
            {
                _ws = ws;
            }

            _readLoopTask = Task.Run(() => ReadLoopAsync(_cts.Token));

            // Wait up to 3 seconds for OpCode 2 (Identified)
            var start = DateTime.UtcNow;
            while ((DateTime.UtcNow - start).TotalSeconds < 3)
            {
                if (_isIdentified)
                {
                    LogMessage?.Invoke($"[OBS] Connected & Identified on ws://{_host}:{_port}");
                    ConnectionChanged?.Invoke(true);
                    return true;
                }
                if (_ws.State != WebSocketState.Open) break;
                await Task.Delay(50, cancellationToken).ConfigureAwait(false);
            }

            if (!_isIdentified)
            {
                LastError = "Identification timeout";
                DisconnectInternal();
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            DisconnectInternal();
            return false;
        }
    }

    public void Disconnect()
    {
        DisconnectInternal();
        ConnectionChanged?.Invoke(false);
    }

    private void DisconnectInternal()
    {
        lock (_lock)
        {
            _isIdentified = false;
            try { _cts?.Cancel(); } catch { }
            try { _ws?.Abort(); } catch { }
            try { _ws?.Dispose(); } catch { }
            _ws = null;

            foreach (var kvp in _pendingRequests)
            {
                kvp.Value.TrySetCanceled();
            }
            _pendingRequests.Clear();
        }
    }

    private async Task ReadLoopAsync(CancellationToken ct)
    {
        var buffer = new byte[65536];
        var ms = new MemoryStream();

        try
        {
            while (!ct.IsCancellationRequested && _ws?.State == WebSocketState.Open)
            {
                ms.SetLength(0);
                WebSocketReceiveResult result;
                do
                {
                    result = await _ws.ReceiveAsync(buffer, ct).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }
                    ms.Write(buffer, 0, result.Count);
                }
                while (!result.EndOfMessage);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                ms.Position = 0;
                using var doc = JsonDocument.Parse(ms);
                ProcessMessage(doc.RootElement);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            LastError = ex.Message;
        }
        finally
        {
            var wasIdentified = _isIdentified;
            _isIdentified = false;
            if (wasIdentified)
            {
                ConnectionChanged?.Invoke(false);
            }
        }
    }

    private void ProcessMessage(JsonElement root)
    {
        if (!root.TryGetProperty("op", out var opElem)) return;
        var op = opElem.GetInt32();

        switch (op)
        {
            case 0: // Hello
                HandleHello(root.GetProperty("d"));
                break;

            case 2: // Identified
                _isIdentified = true;
                break;

            case 7: // RequestResponse
                HandleRequestResponse(root.GetProperty("d"));
                break;
        }
    }

    private void HandleHello(JsonElement d)
    {
        string? authString = null;

        if (d.TryGetProperty("authentication", out var authElem) &&
            authElem.TryGetProperty("challenge", out var chalElem) &&
            authElem.TryGetProperty("salt", out var saltElem))
        {
            var challenge = chalElem.GetString() ?? string.Empty;
            var salt = saltElem.GetString() ?? string.Empty;

            using var sha = SHA256.Create();
            var secretBytes = Encoding.UTF8.GetBytes(_password + salt);
            var secretHash = Convert.ToBase64String(sha.ComputeHash(secretBytes));
            var authBytes = Encoding.UTF8.GetBytes(secretHash + challenge);
            authString = Convert.ToBase64String(sha.ComputeHash(authBytes));
        }

        var identifyData = new JsonObject
        {
            ["rpcVersion"] = 1,
            ["eventSubscriptions"] = 33 // General + Inputs
        };

        if (authString != null)
        {
            identifyData["authentication"] = authString;
        }

        var payload = new JsonObject
        {
            ["op"] = 1,
            ["d"] = identifyData
        };

        _ = SendJsonAsync(payload);
    }

    private void HandleRequestResponse(JsonElement d)
    {
        if (!d.TryGetProperty("requestId", out var reqIdElem)) return;
        var reqId = reqIdElem.GetString();
        if (reqId == null) return;

        TaskCompletionSource<JsonElement>? tcs;
        lock (_lock)
        {
            _pendingRequests.Remove(reqId, out tcs);
        }

        if (tcs != null)
        {
            tcs.TrySetResult(d.Clone());
        }
    }

    private async Task<bool> SendJsonAsync(JsonObject json, CancellationToken ct = default)
    {
        ClientWebSocket? ws;
        lock (_lock)
        {
            ws = _ws;
        }

        if (ws == null || ws.State != WebSocketState.Open) return false;

        var bytes = Encoding.UTF8.GetBytes(json.ToJsonString());
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct).ConfigureAwait(false);
        return true;
    }

    public async Task<JsonElement?> SendRequestAsync(string requestType, JsonObject? requestData = null, CancellationToken ct = default)
    {
        if (!IsConnected) return null;

        var reqId = Guid.NewGuid().ToString("N");
        var tcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);

        lock (_lock)
        {
            _pendingRequests[reqId] = tcs;
        }

        var req = new JsonObject
        {
            ["op"] = 6,
            ["d"] = new JsonObject
            {
                ["requestType"] = requestType,
                ["requestId"] = reqId,
                ["requestData"] = requestData ?? new JsonObject()
            }
        };

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            var sent = await SendJsonAsync(req, linkedCts.Token).ConfigureAwait(false);
            if (!sent)
            {
                lock (_lock) { _pendingRequests.Remove(reqId); }
                return null;
            }

            using (linkedCts.Token.Register(() => tcs.TrySetCanceled()))
            {
                var response = await tcs.Task.ConfigureAwait(false);
                return response;
            }
        }
        catch
        {
            lock (_lock) { _pendingRequests.Remove(reqId); }
            return null;
        }
    }

    public async Task<IReadOnlyList<ObsAudioSourceInfo>> GetAudioSourcesAsync(CancellationToken ct = default)
    {
        var result = new List<ObsAudioSourceInfo>();
        if (!IsConnected) return result;

        try
        {
            var res = await SendRequestAsync("GetInputList", null, ct).ConfigureAwait(false);
            if (res == null) return result;

            if (res.Value.TryGetProperty("responseData", out var respData) &&
                respData.TryGetProperty("inputs", out var inputsElem) &&
                inputsElem.ValueKind == JsonValueKind.Array)
            {
                foreach (var input in inputsElem.EnumerateArray())
                {
                    var name = input.TryGetProperty("inputName", out var n) ? n.GetString() : null;
                    var kind = input.TryGetProperty("inputKind", out var k) ? k.GetString() : null;
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    // Query mute state for this input
                    var muteData = new JsonObject { ["inputName"] = name };
                    var muteRes = await SendRequestAsync("GetInputMute", muteData, ct).ConfigureAwait(false);
                    var isMuted = false;
                    if (muteRes != null &&
                        muteRes.Value.TryGetProperty("responseData", out var md) &&
                        md.TryGetProperty("inputMuted", out var im))
                    {
                        isMuted = im.GetBoolean();
                    }

                    result.Add(new ObsAudioSourceInfo(name, kind ?? "unknown", isMuted));
                }
            }
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"[OBS] Failed to query audio sources: {ex.Message}");
        }

        return result;
    }

    public async Task<bool> SetInputMuteAsync(string inputName, bool mute, CancellationToken ct = default)
    {
        if (!IsConnected || string.IsNullOrWhiteSpace(inputName)) return false;

        var reqData = new JsonObject
        {
            ["inputName"] = inputName,
            ["inputMuted"] = mute
        };

        var res = await SendRequestAsync("SetInputMute", reqData, ct).ConfigureAwait(false);
        if (res == null) return false;

        if (res.Value.TryGetProperty("requestStatus", out var status) &&
            status.TryGetProperty("result", out var r))
        {
            return r.GetBoolean();
        }

        return false;
    }

    public async Task<bool> MuteInputForDurationAsync(string inputName, int durationSeconds, CancellationToken ct = default)
    {
        if (!IsConnected || string.IsNullOrWhiteSpace(inputName)) return false;
        var dur = Math.Max(1, durationSeconds);

        var muted = await SetInputMuteAsync(inputName, true, ct).ConfigureAwait(false);
        if (!muted) return false;

        LogMessage?.Invoke($"[OBS] Source '{inputName}' muted for {dur}s.");

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(dur), ct).ConfigureAwait(false);
                await SetInputMuteAsync(inputName, false, CancellationToken.None).ConfigureAwait(false);
                LogMessage?.Invoke($"[OBS] Source '{inputName}' unmuted after {dur}s.");
            }
            catch (Exception ex)
            {
                LogMessage?.Invoke($"[OBS] Error during unmuting '{inputName}': {ex.Message}");
            }
        });

        return true;
    }

    public ValueTask DisposeAsync()
    {
        _disposed = true;
        DisconnectInternal();
        return ValueTask.CompletedTask;
    }
}
