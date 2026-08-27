# Fix review package
Base: d7dc3fb03e50e691154d39db872ef7d30074c5b8
Head: 486247912eb9850de37bbd2e1edb720734a77b6f

## Stat
 core/Overlay/ChatOverlayServer.cs       | 167 +++++++++++++++++++++++++++++++-
 tests/StreamerHub.Task3Tests/Program.cs |  98 ++++++++++++++++++-
 vite.config.ts                          |   1 +
 3 files changed, 259 insertions(+), 7 deletions(-)

## Diff
diff --git a/core/Overlay/ChatOverlayServer.cs b/core/Overlay/ChatOverlayServer.cs
index 997683c..706175b 100644
--- a/core/Overlay/ChatOverlayServer.cs
+++ b/core/Overlay/ChatOverlayServer.cs
@@ -1,22 +1,24 @@
 using System.Collections.Concurrent;
 using System.Net;
 using System.Net.Sockets;
 using System.Net.WebSockets;
 using System.Text;
+using System.Text.Json;
 using StreamerHub.Core.Rpc;
 
 namespace StreamerHub.Core.Overlay;
 
 public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
 {
     private const int DuplicateWindowSize = 2048;
+    public const int DefaultPort = 49178;
 
     private sealed class ClientConnection : IDisposable
     {
         private readonly SemaphoreSlim _sendLock = new(1, 1);
 
         public ClientConnection(WebSocket socket) => Socket = socket;
 
         public WebSocket Socket { get; }
 
         public async Task SendAsync(string message, CancellationToken cancellationToken)
@@ -38,60 +40,71 @@ public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
         }
 
         public void Dispose()
         {
             Socket.Dispose();
             _sendLock.Dispose();
         }
     }
 
     private readonly string _assetRoot;
+    private readonly int _preferredPort;
     private readonly SemaphoreSlim _lifecycleLock = new(1, 1);
     private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
     private readonly object _stateLock = new();
     private readonly HashSet<string> _seenMessageIds = new(StringComparer.Ordinal);
     private readonly Queue<string> _seenMessageOrder = new();
+    private HashSet<string> _allowedAssetPaths = new(StringComparer.Ordinal);
     private HttpListener? _listener;
     private CancellationTokenSource? _serverCancellation;
     private Task? _acceptLoop;
     private ChatOverlaySettings _settings;
     private bool _connected;
     private int _disposed;
 
-    public ChatOverlayServer(string assetRoot, ChatOverlaySettings settings, bool connected = false)
+    public ChatOverlayServer(
+        string assetRoot,
+        ChatOverlaySettings settings,
+        bool connected = false,
+        int preferredPort = DefaultPort)
     {
         if (string.IsNullOrWhiteSpace(assetRoot)) throw new ArgumentException("An overlay asset root is required.", nameof(assetRoot));
+        if (preferredPort is < 0 or > 65535) throw new ArgumentOutOfRangeException(nameof(preferredPort));
         _assetRoot = Path.GetFullPath(assetRoot);
         _settings = settings ?? throw new ArgumentNullException(nameof(settings));
         _connected = connected;
+        _preferredPort = preferredPort;
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
+            _allowedAssetPaths = LoadOverlayAssetAllowlist();
             Exception? lastError = null;
             for (var attempt = 0; attempt < 10; attempt++)
             {
                 cancellationToken.ThrowIfCancellationRequested();
-                var port = FindAvailableLoopbackPort();
+                var port = attempt == 0 && _preferredPort != 0
+                    ? _preferredPort
+                    : FindAvailableLoopbackPort();
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
@@ -259,20 +272,32 @@ public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
 
             if (!string.Equals(context.Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
             {
                 context.Response.Headers[HttpResponseHeader.Allow] = "GET";
                 await CloseResponseAsync(context.Response, HttpStatusCode.MethodNotAllowed, "GET required.")
                     .ConfigureAwait(false);
                 return;
             }
 
             var path = context.Request.Url?.AbsolutePath ?? "/";
+            if (string.Equals(path, "/chat-overlay-health", StringComparison.Ordinal))
+            {
+                context.Response.StatusCode = (int)HttpStatusCode.NoContent;
+                context.Response.Headers[HttpResponseHeader.CacheControl] = "no-store";
+                context.Response.Close();
+                return;
+            }
+            if (string.Equals(path, "/chat-overlay-sw.js", StringComparison.Ordinal))
+            {
+                await ServeRecoveryServiceWorkerAsync(context.Response).ConfigureAwait(false);
+                return;
+            }
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
@@ -353,36 +378,46 @@ public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
         }
         finally
         {
             _clients.TryRemove(id, out _);
             client.Dispose();
         }
     }
 
     private async Task ServeAssetAsync(HttpListenerResponse response, string requestPath, CancellationToken cancellationToken)
     {
-        var relativePath = requestPath is "/" or "/chat-overlay.html"
+        var isOverlayEntry = requestPath is "/" or "/chat-overlay.html";
+        var relativePath = isOverlayEntry
             ? OverlayEntryPath()
-            : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('/', Path.DirectorySeparatorChar);
+            : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('\\', '/');
+        if (!isOverlayEntry && !_allowedAssetPaths.Contains(relativePath))
+        {
+            await CloseResponseAsync(response, HttpStatusCode.NotFound, "Overlay asset not found.").ConfigureAwait(false);
+            return;
+        }
+
+        relativePath = relativePath.Replace('/', Path.DirectorySeparatorChar);
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
-        var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
+        var bytes = isOverlayEntry
+            ? Encoding.UTF8.GetBytes(InjectRecoveryRegistration(await File.ReadAllTextAsync(fullPath, cancellationToken).ConfigureAwait(false)))
+            : await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
         response.ContentLength64 = bytes.Length;
         await response.OutputStream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
         response.Close();
     }
 
     private async Task BroadcastAsync(string message, CancellationToken cancellationToken)
     {
         var sends = _clients.Select(async pair =>
         {
             try
@@ -402,20 +437,142 @@ public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
         using var probe = new TcpListener(IPAddress.Loopback, 0);
         probe.Start();
         return ((IPEndPoint)probe.LocalEndpoint).Port;
     }
 
     private string OverlayEntryPath() =>
         File.Exists(Path.Combine(_assetRoot, "chat-overlay.html"))
             ? "chat-overlay.html"
             : Path.Combine("src", "chat-overlay.html");
 
+    private HashSet<string> LoadOverlayAssetAllowlist()
+    {
+        var allowed = new HashSet<string>(StringComparer.Ordinal);
+        var manifestPath = Path.Combine(_assetRoot, ".vite", "manifest.json");
+        if (!File.Exists(manifestPath)) return allowed;
+
+        try
+        {
+            using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
+            var root = manifest.RootElement;
+            var entryKey = root.TryGetProperty("src/chat-overlay.html", out _)
+                ? "src/chat-overlay.html"
+                : root.EnumerateObject()
+                    .FirstOrDefault(property =>
+                        property.Value.TryGetProperty("src", out var source) &&
+                        string.Equals(source.GetString(), "src/chat-overlay.html", StringComparison.Ordinal))
+                    .Name;
+            if (string.IsNullOrEmpty(entryKey)) return allowed;
+
+            var visited = new HashSet<string>(StringComparer.Ordinal);
+
+            void Visit(string key)
+            {
+                if (!visited.Add(key) || !root.TryGetProperty(key, out var entry)) return;
+                AddFile(entry, "file");
+                AddFiles(entry, "css");
+                AddFiles(entry, "assets");
+                VisitEntries(entry, "imports");
+                VisitEntries(entry, "dynamicImports");
+            }
+
+            void AddFile(JsonElement entry, string propertyName)
+            {
+                if (entry.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String)
+                    AddAllowed(value.GetString());
+            }
+
+            void AddFiles(JsonElement entry, string propertyName)
+            {
+                if (!entry.TryGetProperty(propertyName, out var values) || values.ValueKind != JsonValueKind.Array) return;
+                foreach (var value in values.EnumerateArray())
+                    if (value.ValueKind == JsonValueKind.String) AddAllowed(value.GetString());
+            }
+
+            void VisitEntries(JsonElement entry, string propertyName)
+            {
+                if (!entry.TryGetProperty(propertyName, out var values) || values.ValueKind != JsonValueKind.Array) return;
+                foreach (var value in values.EnumerateArray())
+                    if (value.ValueKind == JsonValueKind.String && value.GetString() is { } key) Visit(key);
+            }
+
+            void AddAllowed(string? relativePath)
+            {
+                if (string.IsNullOrWhiteSpace(relativePath)) return;
+                var normalized = relativePath.Replace('\\', '/').TrimStart('/');
+                if (!normalized.StartsWith("assets/", StringComparison.Ordinal) || normalized.Contains("..", StringComparison.Ordinal)) return;
+                var fullPath = Path.GetFullPath(Path.Combine(_assetRoot, normalized.Replace('/', Path.DirectorySeparatorChar)));
+                var rootPrefix = _assetRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
+                if (fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
+                    allowed.Add(normalized);
+            }
+
+            Visit(entryKey);
+        }
+        catch (JsonException)
+        {
+        }
+
+        return allowed;
+    }
+
+    private static string InjectRecoveryRegistration(string html)
+    {
+        const string registration = "<script>if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/chat-overlay-sw.js').catch(() => {}); }</script>";
+        return html.Contains("</body>", StringComparison.OrdinalIgnoreCase)
+            ? html.Replace("</body>", registration + "</body>", StringComparison.OrdinalIgnoreCase)
+            : html + registration;
+    }
+
+    private static async Task ServeRecoveryServiceWorkerAsync(HttpListenerResponse response)
+    {
+        var bytes = Encoding.UTF8.GetBytes(RecoveryServiceWorker);
+        response.StatusCode = (int)HttpStatusCode.OK;
+        response.ContentType = "text/javascript; charset=utf-8";
+        response.Headers[HttpResponseHeader.CacheControl] = "no-cache";
+        response.Headers["Service-Worker-Allowed"] = "/";
+        response.Headers["X-Content-Type-Options"] = "nosniff";
+        response.ContentLength64 = bytes.Length;
+        await response.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
+        response.Close();
+    }
+
+    private const string RecoveryServiceWorker = """
+        const recoveryHtml = `<!doctype html>
+        <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
+        <title>Streamer Hub is not running</title><style>
+        html,body{height:100%;margin:0;background:transparent;color:#f7f4ee;font-family:system-ui,sans-serif}
+        body{display:flex;align-items:flex-end;padding:32px;box-sizing:border-box}
+        main{max-width:520px;padding:18px 20px;border:1px solid rgba(255,255,255,.12);border-left:4px solid #8b5cf6;border-radius:12px;background:rgba(16,18,24,.9);box-shadow:0 12px 32px rgba(0,0,0,.28)}
+        h1{margin:0 0 5px;font-size:18px}p{margin:0;color:#b9bec8;font-size:14px;line-height:1.4}
+        </style></head><body><main role="status"><h1>Streamer Hub is not running</h1>
+        <p>Open Streamer Hub to restore this chat overlay. This page will reconnect automatically.</p></main>
+        <script>setInterval(async()=>{try{const response=await fetch('/chat-overlay-health',{cache:'no-store'});if(response.status===204)location.reload()}catch{}},2000)</script>
+        </body></html>`;
+
+        self.addEventListener('install', () => self.skipWaiting());
+        self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
+        self.addEventListener('fetch', event => {
+          const url = new URL(event.request.url);
+          if (event.request.mode === 'navigate' && url.origin === self.location.origin &&
+              (url.pathname === '/' || url.pathname === '/chat-overlay.html')) {
+            event.respondWith(fetch(event.request).then(response => {
+              if (response.ok) return response;
+              throw new Error('overlay unavailable');
+            }).catch(() => new Response(recoveryHtml, {
+              status: 200,
+              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
+            })));
+          }
+        });
+        """;
+
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
diff --git a/tests/StreamerHub.Task3Tests/Program.cs b/tests/StreamerHub.Task3Tests/Program.cs
index ff742e6..62c706d 100644
--- a/tests/StreamerHub.Task3Tests/Program.cs
+++ b/tests/StreamerHub.Task3Tests/Program.cs
@@ -1,26 +1,30 @@
 using System.Net;
+using System.Net.Sockets;
 using System.Net.WebSockets;
 using System.Text;
 using System.Text.Json;
 using StreamerHub.Core.Overlay;
 using StreamerHub.Core.Rpc;
 
 var failures = new List<string>();
 
 await RunAsync("protocol_messages_are_versioned_and_identified", ProtocolMessagesAreVersionedAndIdentifiedAsync);
 await RunAsync("http_bootstrap_is_loopback_only", HttpBootstrapIsLoopbackOnlyAsync);
 await RunAsync("websocket_connect_receives_current_state", WebSocketConnectReceivesCurrentStateAsync);
 await RunAsync("broadcasts_chat_settings_and_connection_changes", BroadcastsChatSettingsAndConnectionChangesAsync);
 await RunAsync("reconnect_gets_state_without_replaying_messages", ReconnectGetsStateWithoutReplayingMessagesAsync);
 await RunAsync("duplicate_chat_message_ids_are_suppressed", DuplicateChatMessageIdsAreSuppressedAsync);
 await RunAsync("server_stops_accepting_requests", ServerStopsAcceptingRequestsAsync);
+await RunAsync("overlay_bootstrap_installs_offline_recovery", OverlayBootstrapInstallsOfflineRecoveryAsync);
+await RunAsync("static_routes_only_serve_overlay_manifest_assets", StaticRoutesOnlyServeOverlayManifestAssetsAsync);
+await RunAsync("existing_obs_url_recovers_after_server_restart", ExistingObsUrlRecoversAfterServerRestartAsync);
 
 if (failures.Count > 0)
 {
     Console.Error.WriteLine($"{failures.Count} test(s) failed:");
     foreach (var failure in failures) Console.Error.WriteLine($"- {failure}");
     Environment.ExitCode = 1;
 }
 else
 {
     Console.WriteLine("All Task 3 overlay server tests passed.");
@@ -135,20 +139,84 @@ async Task ServerStopsAcceptingRequestsAsync()
         throw new InvalidOperationException("stopped server still accepted an HTTP request");
     }
     catch (HttpRequestException)
     {
     }
     catch (OperationCanceledException)
     {
     }
 }
 
+async Task OverlayBootstrapInstallsOfflineRecoveryAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using var overlay = await fixture.Http.GetAsync(fixture.Server.OverlayUrl);
+    var overlayHtml = await overlay.Content.ReadAsStringAsync();
+    AssertContains(overlayHtml, "navigator.serviceWorker.register('/chat-overlay-sw.js')", "service worker registration");
+
+    using var worker = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/chat-overlay-sw.js"));
+    AssertEqual(HttpStatusCode.OK, worker.StatusCode, "recovery service worker status");
+    var workerScript = await worker.Content.ReadAsStringAsync();
+    AssertContains(workerScript, "Streamer Hub is not running", "offline recovery message");
+    AssertContains(workerScript, "/chat-overlay-health", "recovery health probe");
+    AssertContains(workerScript, "event.request.mode === 'navigate'", "navigation fallback");
+
+    using var health = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/chat-overlay-health"));
+    AssertEqual(HttpStatusCode.NoContent, health.StatusCode, "recovery health status");
+}
+
+async Task StaticRoutesOnlyServeOverlayManifestAssetsAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using var requiredAsset = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/assets/chatOverlay-required.js"));
+    AssertEqual(HttpStatusCode.OK, requiredAsset.StatusCode, "required overlay asset");
+
+    using var appIndex = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/index.html"));
+    AssertEqual(HttpStatusCode.NotFound, appIndex.StatusCode, "main app index must not be exposed");
+
+    using var unrelatedAsset = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/assets/unrelated.js"));
+    AssertEqual(HttpStatusCode.NotFound, unrelatedAsset.StatusCode, "unrelated asset must not be exposed");
+
+    using var manifest = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/.vite/manifest.json"));
+    AssertEqual(HttpStatusCode.NotFound, manifest.StatusCode, "build manifest must not be exposed");
+}
+
+async Task ExistingObsUrlRecoversAfterServerRestartAsync()
+{
+    var preferredPort = FindAvailableTestPort();
+    await using var fixture = await ServerFixture.StartAsync(preferredPort);
+    var originalUrl = fixture.Server.OverlayUrl;
+    AssertEqual(preferredPort, fixture.Server.Port, "preferred loopback port");
+    await fixture.Server.StopAsync();
+
+    await using var restarted = new ChatOverlayServer(
+        fixture.AssetRoot,
+        new ChatOverlaySettings(),
+        preferredPort: preferredPort);
+    await restarted.StartAsync();
+    AssertEqual(originalUrl, restarted.OverlayUrl, "OBS overlay URL after app restart");
+
+    using var recoveredOverlay = await fixture.Http.GetAsync(originalUrl);
+    AssertEqual(HttpStatusCode.OK, recoveredOverlay.StatusCode, "existing OBS URL after app restart");
+    AssertContains(
+        await recoveredOverlay.Content.ReadAsStringAsync(),
+        "overlay-bootstrap",
+        "overlay content after app restart");
+}
+
+static int FindAvailableTestPort()
+{
+    using var listener = new TcpListener(IPAddress.Loopback, 0);
+    listener.Start();
+    return ((IPEndPoint)listener.LocalEndpoint).Port;
+}
+
 static ChatMessage SampleMessage(string id) => new()
 {
     Id = id,
     Username = "viewer",
     UserId = "100",
     AvatarUrl = "https://cdn.example/avatar.png",
     Message = "hello chat",
     Timestamp = "2026-08-27T12:00:00Z",
 };
 
@@ -245,27 +313,53 @@ sealed class ServerFixture : IAsyncDisposable
 
     private ServerFixture(string assetRoot, ChatOverlayServer server)
     {
         _assetRoot = assetRoot;
         Server = server;
         Http = new HttpClient();
     }
 
     public ChatOverlayServer Server { get; }
     public HttpClient Http { get; }
+    public string AssetRoot => _assetRoot;
 
-    public static async Task<ServerFixture> StartAsync()
+    public static async Task<ServerFixture> StartAsync(int? preferredPort = null)
     {
         var assetRoot = Path.Combine(Path.GetTempPath(), $"streamer-hub-overlay-tests-{Guid.NewGuid():N}");
         Directory.CreateDirectory(assetRoot);
+        Directory.CreateDirectory(Path.Combine(assetRoot, "assets"));
+        Directory.CreateDirectory(Path.Combine(assetRoot, ".vite"));
         await File.WriteAllTextAsync(Path.Combine(assetRoot, "chat-overlay.html"), "<!doctype html><div id=\"overlay-bootstrap\">overlay-bootstrap</div>");
-        var server = new ChatOverlayServer(assetRoot, new ChatOverlaySettings());
+        await File.WriteAllTextAsync(Path.Combine(assetRoot, "index.html"), "<!doctype html><div>main app</div>");
+        await File.WriteAllTextAsync(Path.Combine(assetRoot, "assets", "chatOverlay-required.js"), "export const overlay = true;");
+        await File.WriteAllTextAsync(Path.Combine(assetRoot, "assets", "unrelated.js"), "export const unrelated = true;");
+        await File.WriteAllTextAsync(
+            Path.Combine(assetRoot, ".vite", "manifest.json"),
+            """
+            {
+              "src/chat-overlay.html": {
+                "file": "assets/chatOverlay-required.js",
+                "name": "chatOverlay",
+                "src": "src/chat-overlay.html",
+                "isEntry": true
+              },
+              "index.html": {
+                "file": "assets/unrelated.js",
+                "name": "app",
+                "src": "index.html",
+                "isEntry": true
+              }
+            }
+            """);
+        var server = preferredPort.HasValue
+            ? new ChatOverlayServer(assetRoot, new ChatOverlaySettings(), preferredPort: preferredPort.Value)
+            : new ChatOverlayServer(assetRoot, new ChatOverlaySettings());
         await server.StartAsync();
         return new ServerFixture(assetRoot, server);
     }
 
     public async Task<ClientWebSocket> ConnectAsync()
     {
         var socket = new ClientWebSocket();
         await socket.ConnectAsync(Server.WebSocketUrl, CancellationToken.None);
         return socket;
     }
diff --git a/vite.config.ts b/vite.config.ts
index ca2326a..7742e39 100644
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -1,18 +1,19 @@
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
 import tailwindcss from '@tailwindcss/vite';
 
 export default defineConfig({
   base: './',
   plugins: [react(), tailwindcss()],
   build: {
     target: 'chrome120',
     outDir: 'dist',
+    manifest: true,
     rollupOptions: {
       input: {
         app: 'index.html',
         chatOverlay: 'src/chat-overlay.html',
       },
     },
   },
 });
