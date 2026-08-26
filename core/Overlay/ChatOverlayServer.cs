using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Overlay;

public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
{
    private const int DuplicateWindowSize = 2048;

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
    private readonly SemaphoreSlim _lifecycleLock = new(1, 1);
    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
    private readonly object _stateLock = new();
    private readonly HashSet<string> _seenMessageIds = new(StringComparer.Ordinal);
    private readonly Queue<string> _seenMessageOrder = new();
    private HttpListener? _listener;
    private CancellationTokenSource? _serverCancellation;
    private Task? _acceptLoop;
    private ChatOverlaySettings _settings;
    private bool _connected;
    private int _disposed;

    public ChatOverlayServer(string assetRoot, ChatOverlaySettings settings, bool connected = false)
    {
        if (string.IsNullOrWhiteSpace(assetRoot)) throw new ArgumentException("An overlay asset root is required.", nameof(assetRoot));
        _assetRoot = Path.GetFullPath(assetRoot);
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _connected = connected;
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
            Exception? lastError = null;
            for (var attempt = 0; attempt < 10; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var port = FindAvailableLoopbackPort();
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
        var relativePath = requestPath is "/" or "/chat-overlay.html"
            ? OverlayEntryPath()
            : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('/', Path.DirectorySeparatorChar);
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
        var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
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
