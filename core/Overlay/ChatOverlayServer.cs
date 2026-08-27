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

        public ClientConnection(WebSocket socket) => Socket = socket;

        public WebSocket Socket { get; }

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
    private readonly object _stateLock = new();
    private readonly HashSet<string> _seenMessageIds = new(StringComparer.Ordinal);
    private readonly Queue<string> _seenMessageOrder = new();
    private HashSet<string> _allowedAssetPaths = new(StringComparer.Ordinal);
    private HttpListener? _listener;
    private CancellationTokenSource? _serverCancellation;
    private Task? _acceptLoop;
    private ChatOverlaySettings _settings;
    private bool _connected;
    private int _disposed;

    public ChatOverlayServer(
        string assetRoot,
        ChatOverlaySettings settings,
        bool connected = false,
        int preferredPort = DefaultPort)
    {
        if (string.IsNullOrWhiteSpace(assetRoot)) throw new ArgumentException("An overlay asset root is required.", nameof(assetRoot));
        if (preferredPort is < 0 or > 65535) throw new ArgumentOutOfRangeException(nameof(preferredPort));
        _assetRoot = Path.GetFullPath(assetRoot);
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _connected = connected;
        _preferredPort = preferredPort;
    }

    public int Port { get; private set; }

    public Uri OverlayUrl { get; private set; } = null!;

    public Uri WebSocketUrl { get; private set; } = null!;

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

    public async Task UpdateSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        lock (_stateLock) _settings = settings;
        await BroadcastAsync(ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
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

        var id = Guid.NewGuid();
        var client = new ClientConnection(upgrade.WebSocket);
        _clients[id] = client;
        try
        {
            ChatOverlaySettings settings;
            bool connected;
            lock (_stateLock)
            {
                settings = _settings;
                connected = _connected;
            }

            await client.SendAsync(ChatOverlayProtocol.Hello(settings, connected), cancellationToken).ConfigureAwait(false);
            await client.SendAsync(ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
            await client.SendAsync(
                connected ? ChatOverlayProtocol.Connected() : ChatOverlayProtocol.Disconnected(),
                cancellationToken).ConfigureAwait(false);

            var buffer = new byte[1024];
            while (!cancellationToken.IsCancellationRequested && client.Socket.State == WebSocketState.Open)
            {
                var result = await client.Socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close) break;
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
        var relativePath = isOverlayEntry
            ? OverlayEntryPath()
            : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('\\', '/');
        if (!isOverlayEntry && !_allowedAssetPaths.Contains(relativePath))
        {
            await CloseResponseAsync(response, HttpStatusCode.NotFound, "Overlay asset not found.").ConfigureAwait(false);
            return;
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
        var bytes = isOverlayEntry
            ? Encoding.UTF8.GetBytes(InjectRecoveryRegistration(await File.ReadAllTextAsync(fullPath, cancellationToken).ConfigureAwait(false)))
            : await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
        response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
        response.Close();
    }

    private async Task BroadcastAsync(string message, CancellationToken cancellationToken)
    {
        var sends = _clients.Select(async pair =>
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

    private HashSet<string> LoadOverlayAssetAllowlist()
    {
        var allowed = new HashSet<string>(StringComparer.Ordinal);
        var manifestPath = Path.Combine(_assetRoot, ".vite", "manifest.json");
        if (!File.Exists(manifestPath)) return allowed;

        try
        {
            using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
            var root = manifest.RootElement;
            var entryKey = root.TryGetProperty("src/chat-overlay.html", out _)
                ? "src/chat-overlay.html"
                : root.EnumerateObject()
                    .FirstOrDefault(property =>
                        property.Value.TryGetProperty("src", out var source) &&
                        string.Equals(source.GetString(), "src/chat-overlay.html", StringComparison.Ordinal))
                    .Name;
            if (string.IsNullOrEmpty(entryKey)) return allowed;

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

            Visit(entryKey);
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
