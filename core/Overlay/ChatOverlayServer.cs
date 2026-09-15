using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Overlay;

public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
{
    private const int DuplicateWindowSize = 2048;
    public const int DefaultPort = 49178;

    private sealed class ClientConnection : IDisposable
    {
        private readonly SemaphoreSlim _sendLock = new(1, 1);

        public ClientConnection(WebSocket socket, string target = "overlay", string overlayId = "default")
        {
            Socket = socket;
            Target = target;
            OverlayId = overlayId;
        }

        public WebSocket Socket { get; }
        public string Target { get; }
        public string OverlayId { get; }

        public async Task SendAsync(string message, CancellationToken cancellationToken)
        {
            var bytes = Encoding.UTF8.GetBytes(message);
            await _sendLock.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                if (Socket.State == WebSocketState.Open)
                {
                    await Socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken)
                        .ConfigureAwait(false);
                }
            }
            finally
            {
                _sendLock.Release();
            }
        }

        public void Dispose()
        {
            Socket.Dispose();
            _sendLock.Dispose();
        }
    }

    private readonly string _assetRoot;
    private readonly int _preferredPort;
    private readonly SemaphoreSlim _lifecycleLock = new(1, 1);
    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
    private readonly ConcurrentDictionary<string, ChatOverlaySettings> _overlaySettings = new(StringComparer.Ordinal);
    private readonly object _stateLock = new();
    private readonly HashSet<string> _seenMessageIds = new(StringComparer.Ordinal);
    private readonly Queue<string> _seenMessageOrder = new();
    private HashSet<string> _allowedAssetPaths = new(StringComparer.Ordinal);
    private HttpListener? _listener;
    private CancellationTokenSource? _serverCancellation;
    private Task? _acceptLoop;
    private ChatOverlaySettings _settings;
    private ChatOverlaySettings _obsChatSettings;
    private IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> _emoteProviders =
        new Dictionary<string, IReadOnlyDictionary<string, string>>();
    private bool _connected;
    private bool _previewEnabled;
    private IReadOnlyList<ChatMessage>? _previewMessages;
    private int _disposed;

    public ChatOverlayServer(
        string assetRoot,
        ChatOverlaySettings settings,
        ChatOverlaySettings? obsChatSettings = null,
        bool connected = false,
        int preferredPort = DefaultPort)
    {
        if (string.IsNullOrWhiteSpace(assetRoot)) throw new ArgumentException("An overlay asset root is required.", nameof(assetRoot));
        if (preferredPort is < 0 or > 65535) throw new ArgumentOutOfRangeException(nameof(preferredPort));
        _assetRoot = Path.GetFullPath(assetRoot);
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _obsChatSettings = obsChatSettings ?? settings;
        _overlaySettings["default"] = _settings;
        _connected = connected;
        _preferredPort = preferredPort;
    }

    public int Port { get; private set; }

    public Uri OverlayUrl { get; private set; } = null!;

    public Uri DockUrl { get; private set; } = null!;

    public Uri WebSocketUrl { get; private set; } = null!;

    public event Func<string, Task>? ChatSendRequested;
    public event Func<string, int, Task>? ChatTimeoutRequested;
    public event Func<string, Task>? ChatBanRequested;
    public event Func<string, Task>? ChatDeleteMessageRequested;

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);
        await _lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_listener?.IsListening == true) return;

            Directory.CreateDirectory(_assetRoot);
            _allowedAssetPaths = LoadOverlayAssetAllowlist();
            Exception? lastError = null;
            for (var attempt = 0; attempt < 10; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var port = attempt == 0 && _preferredPort != 0
                    ? _preferredPort
                    : FindAvailableLoopbackPort();
                var listener = new HttpListener();
                listener.Prefixes.Add($"http://127.0.0.1:{port}/");
                try
                {
                    listener.Start();
                    Port = port;
                    OverlayUrl = new Uri($"http://127.0.0.1:{port}/chat-overlay.html");
                    DockUrl = new Uri($"http://127.0.0.1:{port}/obs-chat.html");
                    WebSocketUrl = new Uri($"ws://127.0.0.1:{port}/ws");
                    _listener = listener;
                    _serverCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    _acceptLoop = AcceptLoopAsync(listener, _serverCancellation.Token);
                    return;
                }
                catch (HttpListenerException ex)
                {
                    lastError = ex;
                    listener.Close();
                }
            }

            throw new InvalidOperationException("Could not bind the chat overlay server to a loopback port.", lastError);
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    public async Task<bool> PublishChatMessageAsync(ChatMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        var id = string.IsNullOrWhiteSpace(message.Id) ? $"chat-{Guid.NewGuid():N}" : message.Id.Trim();
        lock (_stateLock)
        {
            if (!_seenMessageIds.Add(id)) return false;
            _seenMessageOrder.Enqueue(id);
            while (_seenMessageOrder.Count > DuplicateWindowSize)
            {
                _seenMessageIds.Remove(_seenMessageOrder.Dequeue());
            }
        }

        await BroadcastAsync(ChatOverlayProtocol.ChatMessage(message with { Id = id }), cancellationToken)
            .ConfigureAwait(false);
        return true;
    }

    /// <summary>
    /// Pushes a resolved avatar to the overlay so it can patch messages that
    /// were already published without one.
    /// </summary>
    public async Task PublishProfileAsync(string userId, string? avatarUrl, string? color, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        await BroadcastAsync(ChatOverlayProtocol.Profile(userId.Trim(), avatarUrl, color), cancellationToken).ConfigureAwait(false);
    }

    public async Task PublishClearAsync(ChatClear clear, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(clear);
        await BroadcastAsync(ChatOverlayProtocol.Clear(clear), cancellationToken).ConfigureAwait(false);
    }

    public async Task PublishEmotesAsync(
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> providers,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(providers);
        lock (_stateLock) _emoteProviders = providers;
        await BroadcastAsync(ChatOverlayProtocol.Emotes(providers), cancellationToken).ConfigureAwait(false);
    }

    public void RegisterOverlays(IEnumerable<ChatOverlayInstance> overlays)
    {
        ArgumentNullException.ThrowIfNull(overlays);
        lock (_stateLock)
        {
            foreach (var o in overlays)
            {
                if (o is not null && !string.IsNullOrWhiteSpace(o.Id))
                {
                    _overlaySettings[o.Id] = o.Settings ?? new();
                    if (o.Id == "default" || o.IsMain)
                    {
                        _settings = o.Settings ?? new();
                    }
                }
            }
        }
    }

    public async Task UpdateOverlaySettingsAsync(string overlayId, ChatOverlaySettings settings, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        var id = string.IsNullOrWhiteSpace(overlayId) ? "default" : overlayId.Trim();
        lock (_stateLock)
        {
            _overlaySettings[id] = settings;
            if (string.Equals(id, "default", StringComparison.OrdinalIgnoreCase))
            {
                _settings = settings;
            }
        }
        await BroadcastToOverlayAsync(id, ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
    }

    public async Task UpdateSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default) =>
        await UpdateOverlaySettingsAsync("default", settings, cancellationToken).ConfigureAwait(false);

    public async Task UpdateSettingsAsync(ChatOverlaySettings settings, string target, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        if (string.Equals(target, "obs-chat", StringComparison.OrdinalIgnoreCase))
        {
            lock (_stateLock)
            {
                _obsChatSettings = settings;
            }
            await BroadcastAsync(ChatOverlayProtocol.Settings(settings), "obs-chat", cancellationToken).ConfigureAwait(false);
        }
        else
        {
            await UpdateOverlaySettingsAsync("default", settings, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SetConnectedAsync(bool connected, CancellationToken cancellationToken = default)
    {
        lock (_stateLock)
        {
            if (_connected == connected) return;
            _connected = connected;
        }

        await BroadcastAsync(
            connected ? ChatOverlayProtocol.Connected() : ChatOverlayProtocol.Disconnected(),
            cancellationToken).ConfigureAwait(false);
    }

    public async Task ReloadAsync(CancellationToken cancellationToken = default) =>
        await ReloadAsync("overlay", cancellationToken).ConfigureAwait(false);

    public async Task ReloadOverlayAsync(string overlayId, CancellationToken cancellationToken = default)
    {
        var id = string.IsNullOrWhiteSpace(overlayId) ? "default" : overlayId.Trim();
        await BroadcastToOverlayAsync(id, ChatOverlayProtocol.Reload(), cancellationToken).ConfigureAwait(false);
    }

    public async Task ReloadAsync(string target, CancellationToken cancellationToken = default)
    {
        if (string.Equals(target, "obs-chat", StringComparison.OrdinalIgnoreCase))
        {
            await BroadcastAsync(ChatOverlayProtocol.Reload(), "obs-chat", cancellationToken).ConfigureAwait(false);
        }
        else
        {
            await ReloadOverlayAsync("default", cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SetOverlayPreviewAsync(string overlayId, bool enabled, IReadOnlyList<ChatMessage>? sampleMessages = null, CancellationToken cancellationToken = default)
    {
        var id = string.IsNullOrWhiteSpace(overlayId) ? "default" : overlayId.Trim();
        lock (_stateLock)
        {
            _previewEnabled = enabled;
            _previewMessages = sampleMessages;
        }
        await BroadcastToOverlayAsync(id, ChatOverlayProtocol.Preview(enabled, sampleMessages), cancellationToken).ConfigureAwait(false);
    }

    public async Task SetPreviewAsync(bool enabled, IReadOnlyList<ChatMessage>? sampleMessages = null, CancellationToken cancellationToken = default) =>
        await SetPreviewAsync(enabled, sampleMessages, "overlay", cancellationToken).ConfigureAwait(false);

    public async Task SetPreviewAsync(bool enabled, IReadOnlyList<ChatMessage>? sampleMessages, string target, CancellationToken cancellationToken = default)
    {
        lock (_stateLock)
        {
            _previewEnabled = enabled;
            _previewMessages = sampleMessages;
        }
        await BroadcastAsync(ChatOverlayProtocol.Preview(enabled, sampleMessages), target, cancellationToken).ConfigureAwait(false);
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        await _lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var listener = _listener;
            var serverCancellation = _serverCancellation;
            var acceptLoop = _acceptLoop;
            _listener = null;
            _serverCancellation = null;
            _acceptLoop = null;

            if (listener is null) return;
            serverCancellation?.Cancel();
            try
            {
                listener.Stop();
                listener.Close();
            }
            catch
            {
            }

            foreach (var pair in _clients.ToArray())
            {
                if (!_clients.TryRemove(pair.Key, out var client)) continue;
                try
                {
                    if (client.Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                    {
                        await client.Socket.CloseOutputAsync(
                            WebSocketCloseStatus.NormalClosure,
                            "Streamer Hub is shutting down",
                            CancellationToken.None).ConfigureAwait(false);
                    }
                }
                catch
                {
                }
                client.Dispose();
            }

            if (acceptLoop is not null)
            {
                try
                {
                    await acceptLoop.WaitAsync(cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (serverCancellation?.IsCancellationRequested == true)
                {
                }
                catch (HttpListenerException)
                {
                }
                catch (ObjectDisposedException)
                {
                }
            }

            serverCancellation?.Dispose();
            Port = 0;
        }
        finally
        {
            _lifecycleLock.Release();
        }
    }

    private async Task AcceptLoopAsync(HttpListener listener, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && listener.IsListening)
        {
            HttpListenerContext context;
            try
            {
                context = await listener.GetContextAsync().WaitAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (HttpListenerException) when (!listener.IsListening || cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }

            _ = HandleContextAsync(context, cancellationToken);
        }
    }

    private async Task HandleContextAsync(HttpListenerContext context, CancellationToken cancellationToken)
    {
        try
        {
            if (context.Request.RemoteEndPoint is null || !IPAddress.IsLoopback(context.Request.RemoteEndPoint.Address))
            {
                await CloseResponseAsync(context.Response, HttpStatusCode.Forbidden, "Loopback requests only.")
                    .ConfigureAwait(false);
                return;
            }

            if (!string.Equals(context.Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.Headers[HttpResponseHeader.Allow] = "GET";
                await CloseResponseAsync(context.Response, HttpStatusCode.MethodNotAllowed, "GET required.")
                    .ConfigureAwait(false);
                return;
            }

            var path = context.Request.Url?.AbsolutePath ?? "/";
            if (string.Equals(path, "/chat-overlay-health", StringComparison.Ordinal))
            {
                context.Response.StatusCode = (int)HttpStatusCode.NoContent;
                context.Response.Headers[HttpResponseHeader.CacheControl] = "no-store";
                context.Response.Close();
                return;
            }
            if (string.Equals(path, "/chat-overlay-sw.js", StringComparison.Ordinal))
            {
                await ServeRecoveryServiceWorkerAsync(context.Response).ConfigureAwait(false);
                return;
            }
            if (string.Equals(path, "/ws", StringComparison.Ordinal))
            {
                if (!context.Request.IsWebSocketRequest)
                {
                    await CloseResponseAsync(context.Response, HttpStatusCode.BadRequest, "WebSocket upgrade required.")
                        .ConfigureAwait(false);
                    return;
                }
                await HandleWebSocketAsync(context, cancellationToken).ConfigureAwait(false);
                return;
            }

            await ServeAssetAsync(context.Response, path, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            TryClose(context.Response);
        }
        catch
        {
            try
            {
                await CloseResponseAsync(context.Response, HttpStatusCode.InternalServerError, "Overlay server error.")
                    .ConfigureAwait(false);
            }
            catch
            {
                TryClose(context.Response);
            }
        }
    }

    private async Task HandleWebSocketAsync(HttpListenerContext context, CancellationToken cancellationToken)
    {
        HttpListenerWebSocketContext upgrade;
        try
        {
            upgrade = await context.AcceptWebSocketAsync(null).ConfigureAwait(false);
        }
        catch
        {
            TryClose(context.Response);
            return;
        }

        var target = "overlay";
        var overlayId = "default";
        var query = context.Request.Url?.Query;
        if (!string.IsNullOrEmpty(query))
        {
            var pairs = query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries);
            foreach (var pair in pairs)
            {
                var parts = pair.Split('=', 2);
                var key = Uri.UnescapeDataString(parts[0]);
                var val = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : "";
                if (string.Equals(key, "target", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(val, "obs-chat", StringComparison.OrdinalIgnoreCase))
                        target = "obs-chat";
                }
                else if ((string.Equals(key, "id", StringComparison.OrdinalIgnoreCase) ||
                          string.Equals(key, "overlayId", StringComparison.OrdinalIgnoreCase)) &&
                         !string.IsNullOrWhiteSpace(val))
                {
                    overlayId = val.Trim();
                }
            }
        }
        if (context.Request.Url?.AbsolutePath.Contains("obs-chat", StringComparison.OrdinalIgnoreCase) == true)
        {
            target = "obs-chat";
        }

        var id = Guid.NewGuid();
        var client = new ClientConnection(upgrade.WebSocket, target, overlayId);
        _clients[id] = client;
        try
        {
            ChatOverlaySettings settings;
            bool connected;
            IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> emotes;
            lock (_stateLock)
            {
                if (string.Equals(target, "obs-chat", StringComparison.OrdinalIgnoreCase))
                {
                    settings = _obsChatSettings;
                }
                else
                {
                    settings = _overlaySettings.TryGetValue(overlayId, out var s) ? s : _settings;
                }
                connected = _connected;
                emotes = _emoteProviders;
            }

            await client.SendAsync(ChatOverlayProtocol.Hello(settings, connected), cancellationToken).ConfigureAwait(false);
            await client.SendAsync(ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
            // A reconnecting overlay needs the emote map replayed; it is not
            // resent otherwise until the next registry refresh.
            if (emotes.Count > 0)
            {
                await client.SendAsync(ChatOverlayProtocol.Emotes(emotes), cancellationToken).ConfigureAwait(false);
            }
            await client.SendAsync(
                connected ? ChatOverlayProtocol.Connected() : ChatOverlayProtocol.Disconnected(),
                cancellationToken).ConfigureAwait(false);
            if (_previewEnabled)
            {
                await client.SendAsync(ChatOverlayProtocol.Preview(true, _previewMessages), cancellationToken).ConfigureAwait(false);
            }

            var buffer = new byte[4096];
            while (!cancellationToken.IsCancellationRequested && client.Socket.State == WebSocketState.Open)
            {
                var result = await client.Socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close) break;
                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
                    try
                    {
                        var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        using var doc = JsonDocument.Parse(text);
                        if (doc.RootElement.TryGetProperty("kind", out var k))
                        {
                            var kind = k.GetString();
                            if (kind == "send-chat" && doc.RootElement.TryGetProperty("message", out var m))
                            {
                                var chatMsg = m.GetString();
                                if (!string.IsNullOrWhiteSpace(chatMsg) && ChatSendRequested is not null)
                                {
                                    await ChatSendRequested.Invoke(chatMsg).ConfigureAwait(false);
                                }
                            }
                            else if (kind == "timeout-user" && doc.RootElement.TryGetProperty("user", out var timeoutUserProp))
                            {
                                var user = timeoutUserProp.GetString();
                                var duration = doc.RootElement.TryGetProperty("duration", out var timeoutDurationProp) && timeoutDurationProp.TryGetInt32(out var parsedD) ? parsedD : 60;
                                if (!string.IsNullOrWhiteSpace(user) && ChatTimeoutRequested is not null)
                                {
                                    await ChatTimeoutRequested.Invoke(user, duration).ConfigureAwait(false);
                                }
                            }
                            else if (kind == "ban-user" && doc.RootElement.TryGetProperty("user", out var banUserProp))
                            {
                                var user = banUserProp.GetString();
                                if (!string.IsNullOrWhiteSpace(user) && ChatBanRequested is not null)
                                {
                                    await ChatBanRequested.Invoke(user).ConfigureAwait(false);
                                }
                            }
                            else if (kind == "delete-message" && doc.RootElement.TryGetProperty("messageId", out var delMidProp))
                            {
                                var messageId = delMidProp.GetString();
                                if (!string.IsNullOrWhiteSpace(messageId) && ChatDeleteMessageRequested is not null)
                                {
                                    await ChatDeleteMessageRequested.Invoke(messageId).ConfigureAwait(false);
                                }
                            }
                        }
                    }
                    catch
                    {
                    }
                }
            }

            if (client.Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                await client.Socket.CloseOutputAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Connection closed",
                    CancellationToken.None).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (WebSocketException)
        {
        }
        finally
        {
            _clients.TryRemove(id, out _);
            client.Dispose();
        }
    }

    private async Task ServeAssetAsync(HttpListenerResponse response, string requestPath, CancellationToken cancellationToken)
    {
        var isOverlayEntry = requestPath is "/" or "/chat-overlay.html";
        var isDockEntry = requestPath is "/obs-chat" or "/obs-chat.html" or "/streamer-chat" or "/streamer-chat.html";
        var relativePath = isOverlayEntry
            ? OverlayEntryPath()
            : isDockEntry
                ? DockEntryPath()
                : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('\\', '/');
        if (!isOverlayEntry && !isDockEntry && !_allowedAssetPaths.Contains(relativePath))
        {
            _allowedAssetPaths = LoadOverlayAssetAllowlist();
            if (!_allowedAssetPaths.Contains(relativePath))
            {
                await CloseResponseAsync(response, HttpStatusCode.NotFound, "Overlay asset not found.").ConfigureAwait(false);
                return;
            }
        }

        relativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_assetRoot, relativePath));
        var rootPrefix = _assetRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
        {
            await CloseResponseAsync(response, HttpStatusCode.NotFound, "Overlay asset not found.").ConfigureAwait(false);
            return;
        }

        response.StatusCode = (int)HttpStatusCode.OK;
        response.ContentType = ContentTypeFor(fullPath);
        response.Headers[HttpResponseHeader.CacheControl] = "no-store";
        response.Headers["X-Content-Type-Options"] = "nosniff";
        var bytes = (isOverlayEntry || isDockEntry)
            ? Encoding.UTF8.GetBytes(InjectRecoveryRegistration(await File.ReadAllTextAsync(fullPath, cancellationToken).ConfigureAwait(false)))
            : await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
        response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
        response.Close();
    }

    private async Task BroadcastAsync(string message, CancellationToken cancellationToken) =>
        await BroadcastAsync(message, target: null, cancellationToken).ConfigureAwait(false);

    private async Task BroadcastAsync(string message, string? target, CancellationToken cancellationToken)
    {
        var targets = string.IsNullOrWhiteSpace(target)
            ? _clients.ToArray()
            : _clients.Where(p => string.Equals(p.Value.Target, target, StringComparison.OrdinalIgnoreCase)).ToArray();

        var sends = targets.Select(async pair =>
        {
            try
            {
                await pair.Value.SendAsync(message, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException or InvalidOperationException)
            {
                if (_clients.TryRemove(pair.Key, out var client)) client.Dispose();
            }
        });
        await Task.WhenAll(sends).ConfigureAwait(false);
    }

    private async Task BroadcastToOverlayAsync(string overlayId, string message, CancellationToken cancellationToken)
    {
        var id = string.IsNullOrWhiteSpace(overlayId) ? "default" : overlayId.Trim();
        var targets = _clients.Where(p =>
            string.Equals(p.Value.Target, "overlay", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.Value.OverlayId, id, StringComparison.OrdinalIgnoreCase)
        ).ToArray();

        var sends = targets.Select(async pair =>
        {
            try
            {
                await pair.Value.SendAsync(message, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException or InvalidOperationException)
            {
                if (_clients.TryRemove(pair.Key, out var client)) client.Dispose();
            }
        });
        await Task.WhenAll(sends).ConfigureAwait(false);
    }

    private static int FindAvailableLoopbackPort()
    {
        using var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        return ((IPEndPoint)probe.LocalEndpoint).Port;
    }

    private string OverlayEntryPath() =>
        File.Exists(Path.Combine(_assetRoot, "chat-overlay.html"))
            ? "chat-overlay.html"
            : Path.Combine("src", "chat-overlay.html");

    private string DockEntryPath() =>
        File.Exists(Path.Combine(_assetRoot, "obs-chat.html"))
            ? "obs-chat.html"
            : Path.Combine("src", "obs-chat.html");

    private HashSet<string> LoadOverlayAssetAllowlist()
    {
        var allowed = new HashSet<string>(StringComparer.Ordinal);
        var manifestPath = Path.Combine(_assetRoot, ".vite", "manifest.json");
        if (!File.Exists(manifestPath)) return allowed;

        try
        {
            using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
            var root = manifest.RootElement;
            var entryKeys = new List<string>();
            foreach (var target in new[] { "src/chat-overlay.html", "src/obs-chat.html" })
            {
                if (root.TryGetProperty(target, out _))
                {
                    entryKeys.Add(target);
                }
                else
                {
                    foreach (var property in root.EnumerateObject())
                    {
                        if (property.Value.TryGetProperty("src", out var source) &&
                            string.Equals(source.GetString(), target, StringComparison.Ordinal))
                        {
                            entryKeys.Add(property.Name);
                            break;
                        }
                    }
                }
            }
            if (entryKeys.Count == 0) return allowed;

            var visited = new HashSet<string>(StringComparer.Ordinal);

            void Visit(string key)
            {
                if (!visited.Add(key) || !root.TryGetProperty(key, out var entry)) return;
                AddFile(entry, "file");
                AddFiles(entry, "css");
                AddFiles(entry, "assets");
                VisitEntries(entry, "imports");
                VisitEntries(entry, "dynamicImports");
            }

            foreach (var key in entryKeys) Visit(key);

            void AddFile(JsonElement entry, string propertyName)
            {
                if (entry.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String)
                    AddAllowed(value.GetString());
            }

            void AddFiles(JsonElement entry, string propertyName)
            {
                if (!entry.TryGetProperty(propertyName, out var values) || values.ValueKind != JsonValueKind.Array) return;
                foreach (var value in values.EnumerateArray())
                    if (value.ValueKind == JsonValueKind.String) AddAllowed(value.GetString());
            }

            void VisitEntries(JsonElement entry, string propertyName)
            {
                if (!entry.TryGetProperty(propertyName, out var values) || values.ValueKind != JsonValueKind.Array) return;
                foreach (var value in values.EnumerateArray())
                    if (value.ValueKind == JsonValueKind.String && value.GetString() is { } key) Visit(key);
            }

            void AddAllowed(string? relativePath)
            {
                if (string.IsNullOrWhiteSpace(relativePath)) return;
                var normalized = relativePath.Replace('\\', '/').TrimStart('/');
                if (!normalized.StartsWith("assets/", StringComparison.Ordinal) || normalized.Contains("..", StringComparison.Ordinal)) return;
                var fullPath = Path.GetFullPath(Path.Combine(_assetRoot, normalized.Replace('/', Path.DirectorySeparatorChar)));
                var rootPrefix = _assetRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
                if (fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
                    allowed.Add(normalized);
            }
        }
        catch (JsonException)
        {
        }

        return allowed;
    }

    private static string InjectRecoveryRegistration(string html)
    {
        const string registration = "<script>if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/chat-overlay-sw.js').catch(() => {}); }</script>";
        return html.Contains("</body>", StringComparison.OrdinalIgnoreCase)
            ? html.Replace("</body>", registration + "</body>", StringComparison.OrdinalIgnoreCase)
            : html + registration;
    }

    private static async Task ServeRecoveryServiceWorkerAsync(HttpListenerResponse response)
    {
        var bytes = Encoding.UTF8.GetBytes(RecoveryServiceWorker);
        response.StatusCode = (int)HttpStatusCode.OK;
        response.ContentType = "text/javascript; charset=utf-8";
        response.Headers[HttpResponseHeader.CacheControl] = "no-cache";
        response.Headers["Service-Worker-Allowed"] = "/";
        response.Headers["X-Content-Type-Options"] = "nosniff";
        response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
        response.Close();
    }

    private const string RecoveryServiceWorker = """
        const recoveryHtml = `<!doctype html>
        <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Streamer Hub is not running</title><style>
        html,body{height:100%;margin:0;background:transparent;color:#f7f4ee;font-family:system-ui,sans-serif}
        body{display:flex;align-items:flex-end;padding:32px;box-sizing:border-box}
        main{max-width:520px;padding:18px 20px;border:1px solid rgba(255,255,255,.12);border-left:4px solid #8b5cf6;border-radius:12px;background:rgba(16,18,24,.9);box-shadow:0 12px 32px rgba(0,0,0,.28)}
        h1{margin:0 0 5px;font-size:18px}p{margin:0;color:#b9bec8;font-size:14px;line-height:1.4}
        </style></head><body><main role="status"><h1>Streamer Hub is not running</h1>
        <p>Open Streamer Hub to restore this chat overlay. This page will reconnect automatically.</p></main>
        <script>setInterval(async()=>{try{const response=await fetch('/chat-overlay-health',{cache:'no-store'});if(response.status===204)location.reload()}catch{}},2000)</script>
        </body></html>`;

        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
        self.addEventListener('fetch', event => {
          const url = new URL(event.request.url);
          if (event.request.mode === 'navigate' && url.origin === self.location.origin &&
              (url.pathname === '/' || url.pathname === '/chat-overlay.html')) {
            event.respondWith(fetch(event.request).then(response => {
              if (response.ok) return response;
              throw new Error('overlay unavailable');
            }).catch(() => new Response(recoveryHtml, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
            })));
          }
        });
        """;

    private static string ContentTypeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".woff2" => "font/woff2",
        ".json" => "application/json; charset=utf-8",
        _ => "application/octet-stream",
    };

    private static async Task CloseResponseAsync(HttpListenerResponse response, HttpStatusCode status, string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        response.StatusCode = (int)status;
        response.ContentType = "text/plain; charset=utf-8";
        response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
        response.Close();
    }

    private static void TryClose(HttpListenerResponse response)
    {
        try { response.Close(); } catch { }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        StopAsync().GetAwaiter().GetResult();
        _lifecycleLock.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        await StopAsync().ConfigureAwait(false);
        _lifecycleLock.Dispose();
    }
}
