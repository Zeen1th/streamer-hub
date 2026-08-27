# Review package
Base: 41dac3a
Head: d7dc3fb03e50e691154d39db872ef7d30074c5b8

## Commits
d7dc3fb Add local OBS chat overlay server

## Stat
 .superpowers/sdd/chat-overlay/task-3-report.md     | 150 +++++++
 core/Host/HostController.cs                        |   7 +-
 core/MainForm.cs                                   |  13 +-
 core/Overlay/ChatOverlayProtocol.cs                |  30 ++
 core/Overlay/ChatOverlayServer.cs                  | 454 +++++++++++++++++++++
 core/Rpc/Envelope.cs                               |   1 +
 core/StreamerHub.csproj                            |   3 +-
 src/chat-overlay.html                              |  13 +
 src/chat-overlay.tsx                               | 379 +++++++++++++++++
 tests/StreamerHub.Task3Tests/Program.cs            | 279 +++++++++++++
 .../StreamerHub.Task3Tests.csproj                  |  15 +
 vite.config.ts                                     |   6 +
 12 files changed, 1347 insertions(+), 3 deletions(-)

## Diff
diff --git a/.superpowers/sdd/chat-overlay/task-3-report.md b/.superpowers/sdd/chat-overlay/task-3-report.md
new file mode 100644
index 0000000..73b953a
--- /dev/null
+++ b/.superpowers/sdd/chat-overlay/task-3-report.md
@@ -0,0 +1,150 @@
+# Task 3 Implementation Report: Local OBS Chat Overlay Server
+
+Date: 2026-08-27
+
+## Status
+
+COMPLETE. Task 3 is implemented and verified in the `chat-overlay` worktree.
+
+## Scope delivered
+
+- Added a loopback-only `HttpListener` server that binds to `127.0.0.1` on an available ephemeral port.
+- Added a local overlay URL and WebSocket URL, with the overlay URL exposed through the native `chat-overlay/get-url` RPC channel.
+- Added HTTP routing for the overlay bootstrap and generated static assets.
+- Rejected non-loopback clients, unsupported HTTP methods, non-WebSocket `/ws` requests, missing paths, and paths that resolve outside the asset root.
+- Added a version 1 overlay protocol. Every envelope has `v`, `id`, `kind`, and `payload`.
+- Added `hello`, `chat-message`, `settings`, `connected`, and `disconnected` protocol messages.
+- Added multi-client WebSocket broadcasting with per-client send serialization and disconnected-client cleanup.
+- Added bounded server-side chat message ID suppression (2,048 IDs) so duplicate messages are not delivered.
+- Added reconnect behavior that sends current settings/connection state without replaying old chat messages.
+- Added server stop/dispose behavior that closes the listener and active WebSockets.
+- Wired server ownership into `MainForm`: startup occurs after native `wwwroot` is resolved, and shutdown is independent of host-controller disposal failures.
+- Added a standalone React/Vite overlay page with no WebView RPC dependency.
+- Added automatic WebSocket reconnection, client-side duplicate suppression, timed message expiry, stacked/latest modes, all persisted appearance settings, role accents, avatar fallback, reduced-motion support, and clear app-disabled/Twitch-disconnected/app-not-running recovery states.
+- Added a Vite multi-page input and native content mapping that copies the generated overlay entry to `wwwroot/chat-overlay.html` while retaining generated assets under `wwwroot/assets`.
+
+## Protocol shape
+
+All WebSocket messages use this envelope:
+
+```json
+{
+  "v": 1,
+  "id": "stable-or-generated-message-id",
+  "kind": "hello | chat-message | settings | connected | disconnected",
+  "payload": {}
+}
+```
+
+- `hello` carries current overlay settings and Twitch connection state.
+- `chat-message` carries the existing normalized native `ChatMessage`; its envelope and payload retain the Twitch/fallback message ID.
+- `settings` carries the current `ChatOverlaySettings` snapshot.
+- `connected` and `disconnected` carry a boolean connection state.
+
+## TDD evidence
+
+### RED
+
+The Task 3 native test project was created before implementation. After its one-time restore, the required failing run was:
+
+```text
+dotnet run --project tests\StreamerHub.Task3Tests\StreamerHub.Task3Tests.csproj --no-restore
+CS0234: StreamerHub.Core.Overlay does not exist
+CS0246: ChatOverlayServer could not be found
+```
+
+This confirmed the tests failed because the requested protocol/server implementation was absent.
+
+### GREEN
+
+Final server test result:
+
+```text
+PASS protocol_messages_are_versioned_and_identified
+PASS http_bootstrap_is_loopback_only
+PASS websocket_connect_receives_current_state
+PASS broadcasts_chat_settings_and_connection_changes
+PASS reconnect_gets_state_without_replaying_messages
+PASS duplicate_chat_message_ids_are_suppressed
+PASS server_stops_accepting_requests
+All Task 3 overlay server tests passed.
+```
+
+The shutdown test accepts either immediate connection refusal or an intentionally cancelled pending Windows HTTP connection after `StopAsync`; in both cases the listener is no longer accepting requests and `Port` has reset to zero.
+
+## Verification evidence
+
+### Server tests
+
+Command:
+
+```text
+dotnet run --project tests\StreamerHub.Task3Tests\StreamerHub.Task3Tests.csproj --no-restore
+```
+
+Result: 7 passed, 0 failed, no warnings.
+
+### Existing chat overlay normalization regression tests
+
+Command:
+
+```text
+node --test src\lib\chatOverlay.test.mjs
+```
+
+Result: 5 passed, 0 failed.
+
+### Frontend production build
+
+Command:
+
+```text
+npm run build
+```
+
+Result: success; Vite transformed 1,624 modules and emitted `dist/src/chat-overlay.html` plus the standalone overlay JavaScript, CSS, and local font assets.
+
+### Native build
+
+Command:
+
+```text
+dotnet build core\StreamerHub.csproj --no-restore -p:OutputPath=bin\ChatOverlayBuild\ -p:UseAppHost=false
+```
+
+Result:
+
+```text
+Build succeeded.
+0 Warning(s)
+0 Error(s)
+```
+
+The native output contains `core/bin/ChatOverlayBuild/wwwroot/chat-overlay.html` and the generated `chatOverlay-*` assets under `wwwroot/assets`.
+
+## Files added
+
+- `core/Overlay/ChatOverlayProtocol.cs`
+- `core/Overlay/ChatOverlayServer.cs`
+- `src/chat-overlay.html`
+- `src/chat-overlay.tsx`
+- `tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj`
+- `tests/StreamerHub.Task3Tests/Program.cs`
+- `.superpowers/sdd/chat-overlay/task-3-report.md`
+
+## Files updated
+
+- `core/MainForm.cs`
+- `core/Host/HostController.cs`
+- `core/Rpc/Envelope.cs`
+- `core/StreamerHub.csproj`
+- `vite.config.ts`
+
+## Scope boundary for Task 4
+
+Task 3 provides the server APIs for chat/settings/connection broadcasts and the native URL RPC. Per the approved plan, Task 4 still owns app-facing typed RPC hydration/settings-save contracts and forwarding live Twitch events into these server APIs.
+
+## Concerns
+
+- A fresh browser navigation cannot render an HTTP recovery page after the desktop process has exited because no process remains to answer the local URL. An already-loaded OBS browser source detects the WebSocket close, shows the explicit recovery message, and reconnects automatically when Streamer Hub returns.
+- The workspace editing helper intermittently failed during implementation; the authorized direct-workspace fallback was used. Verification confirms the resulting files and builds are valid.
diff --git a/core/Host/HostController.cs b/core/Host/HostController.cs
index 697807f..35d0d8f 100644
--- a/core/Host/HostController.cs
+++ b/core/Host/HostController.cs
@@ -1,17 +1,18 @@
 using System.Text.Json;
 using System.Diagnostics;
 using System.Net.Http.Headers;
 using Microsoft.Web.WebView2.Core;
 using Microsoft.Web.WebView2.WinForms;
 using StreamerHub.Core.Obs;
 using StreamerHub.Core.AI;
+using StreamerHub.Core.Overlay;
 using StreamerHub.Core.Rpc;
 using StreamerHub.Core.Storage;
 using StreamerHub.Core.Twitch;
 
 namespace StreamerHub.Core.Host;
 
 public sealed class HostController : IDisposable
 {
     private sealed record SetCountPayload(string CounterId, int Count, string Source);
     private sealed record SaveCounterPayload(Counter? Counter);
@@ -27,20 +28,21 @@ public sealed class HostController : IDisposable
     private sealed record SaveOpenRouterPayload(string Provider, string? ApiKey);
     private sealed record GenerateAutoReplyPayload(string RuleId, ChatMessage? Message, bool? Send = null);
     private sealed record GenerateAutoReplyResponse(bool Ok, string? Message = null, bool UsedFallback = false, string? Error = null);
     private sealed record UpdateCheckResponse(string CurrentVersion, string LatestVersion, bool UpdateAvailable, string ReleaseUrl, string? DownloadUrl = null, string? ReleaseNotes = null);
     private sealed record UpdateInstallPayload(string DownloadUrl);
 
     private readonly MainForm _form;
     private readonly WebView2 _webView;
     private readonly CancellationToken _shutdown;
     private readonly SettingsStore _settings;
+    private readonly ChatOverlayServer _chatOverlayServer;
     private readonly ObsFileWriter _obs = new();
     private readonly TokenVault _tokens;
     private readonly TokenVault _botTokens;
     private readonly SecretVault _openRouterKey;
     private readonly SecretVault _groqKey;
     private readonly OpenRouterClient _openRouter = new();
     private static readonly HttpClient UpdateHttp = new();
     private const string UpdateRepository = "Zeen1th/streamer-hub";
     private readonly ITwitchClient _twitch = new TwitchIrcClient();
     private readonly ITwitchClient _botTwitch = new TwitchIrcClient();
@@ -54,26 +56,27 @@ public sealed class HostController : IDisposable
     private string _twitchChannel = string.Empty;
     private string _botLogin = string.Empty;
     private int _chatBurst;
     private DateTime _chatWindow = DateTime.UtcNow;
     private DateTime _lastChatSentAt = DateTime.MinValue;
     private readonly SemaphoreSlim _chatSendLock = new(1, 1);
     private readonly SemaphoreSlim _aiRequestLock = new(1, 1);
     private DateTime _aiWindow = DateTime.UtcNow;
     private int _aiRequestsInWindow;
 
-    public HostController(MainForm form, WebView2 webView, SettingsStore settings, string appData, CancellationToken shutdown)
+    public HostController(MainForm form, WebView2 webView, SettingsStore settings, ChatOverlayServer chatOverlayServer, string appData, CancellationToken shutdown)
     {
         _form = form;
         _webView = webView;
         _shutdown = shutdown;
         _settings = settings;
+        _chatOverlayServer = chatOverlayServer;
         _tokens = new TokenVault(Path.Combine(appData, "token.bin"));
         _botTokens = new TokenVault(Path.Combine(appData, "bot-token.bin"));
         _openRouterKey = new SecretVault(Path.Combine(appData, "openrouter-key.bin"));
         _groqKey = new SecretVault(Path.Combine(appData, "groq-key.bin"));
         _logPath = Path.Combine(appData, "logs", $"session-{DateTime.Now:yyyyMMdd}.log");
         Directory.CreateDirectory(Path.GetDirectoryName(_logPath)!);
         RegisterHandlers();
         WireTwitch();
         WireBotState();
     }
@@ -223,20 +226,22 @@ public sealed class HostController : IDisposable
         _dispatcher.Register(Channels.TwitchBotForget, (_, _) =>
         {
             _botTokens.Delete();
             _botTwitch.Disconnect();
             _botLogin = string.Empty;
             EmitStatus();
             return Task.FromResult<object?>(new { ok = true });
         });
         _dispatcher.Register(Channels.SettingsGetState, (_, _) =>
             Task.FromResult<object?>(new { twitch = _settings.Twitch, language = _settings.Language, botAccountEnabled = _settings.BotAccountEnabled, startupEnabled = _settings.StartupEnabled }));
+        _dispatcher.Register(Channels.ChatOverlayGetUrl, (_, _) =>
+            Task.FromResult<object?>(new { url = _chatOverlayServer.OverlayUrl.ToString() }));
         _dispatcher.Register(Channels.SettingsSave, (payload, _) =>
         {
             var request = Json.Deserialize<SaveSettingsPayload>(payload ?? default);
             if (request?.Twitch is null) return Task.FromResult<object?>(new { ok = false });
             _settings.SetTwitch(request.Twitch);
             if (request.Language is not null) _settings.SetLanguage(request.Language);
             if (request.StartupEnabled.HasValue)
             {
                 _settings.SetStartupEnabled(request.StartupEnabled.Value);
                 _form.SetStartupEnabled(request.StartupEnabled.Value);
diff --git a/core/MainForm.cs b/core/MainForm.cs
index ebb81e2..0a9d125 100644
--- a/core/MainForm.cs
+++ b/core/MainForm.cs
@@ -1,16 +1,17 @@
 using System.Runtime.InteropServices;
 using Microsoft.Win32;
 using System.Text.Json;
 using Microsoft.Web.WebView2.Core;
 using Microsoft.Web.WebView2.WinForms;
 using StreamerHub.Core.Host;
+using StreamerHub.Core.Overlay;
 using StreamerHub.Core.Rpc;
 using StreamerHub.Core.Storage;
 
 namespace StreamerHub.Core;
 
 internal static class Native
 {
     [DllImport("user32.dll")]
     internal static extern bool ReleaseCapture();
 
@@ -42,20 +43,21 @@ public sealed class MainForm : Form
     private const int ZoneRight = 2;
     private const int ZoneTop = 4;
     private const int ZoneBottom = 8;
 
     private readonly WebView2 _webView = new();
     private readonly NotifyIcon _trayIcon;
     private readonly ContextMenuStrip _trayMenu = new();
     private readonly CancellationTokenSource _shutdown = new();
     private SettingsStore? _settings;
     private HostController? _host;
+    private ChatOverlayServer? _chatOverlayServer;
     private bool _lastMaximized;
     private bool _webViewRefreshPending;
     private bool _exitingFromTray;
     private bool _closePromptOpen;
     private int _initialized;
 
     public MainForm()
     {
         Text = "Streamer Hub";
         var iconPath = Path.Combine(AppContext.BaseDirectory, "streamer-hub-icon.ico");
@@ -143,21 +145,23 @@ public sealed class MainForm : Form
             null, Path.Combine(localData, "WebView2"), environmentOptions);
         await _webView.EnsureCoreWebView2Async(environment);
         _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
         _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
         _webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
 
         var wwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
         _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
             "app.streamerhub", wwwroot, CoreWebView2HostResourceAccessKind.Allow);
 
-        _host = new HostController(this, _webView, _settings, appData, _shutdown.Token);
+        _chatOverlayServer = new ChatOverlayServer(wwwroot, _settings.ChatOverlay);
+        await _chatOverlayServer.StartAsync(_shutdown.Token);
+        _host = new HostController(this, _webView, _settings, _chatOverlayServer, appData, _shutdown.Token);
         await _host.InitializeAsync();
 
         _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
         _webView.CoreWebView2.Navigate("https://app.streamerhub/index.html");
         if (Program.StartedWithWindows)
         {
             BeginInvoke(HideToTray);
         }
     }
 
@@ -488,20 +492,27 @@ public sealed class MainForm : Form
         _trayIcon.Dispose();
         _trayMenu.Dispose();
         _shutdown.Cancel();
         try
         {
             _host?.Dispose();
         }
         catch
         {
         }
+        try
+        {
+            _chatOverlayServer?.Dispose();
+        }
+        catch
+        {
+        }
         base.OnFormClosing(e);
     }
 }
 internal sealed class CloseChoiceDialog : Form
 {
     public CloseChoiceDialog(bool darkTheme)
     {
         Text = "Streamer Hub";
         FormBorderStyle = FormBorderStyle.FixedDialog;
         StartPosition = FormStartPosition.CenterParent;
diff --git a/core/Overlay/ChatOverlayProtocol.cs b/core/Overlay/ChatOverlayProtocol.cs
new file mode 100644
index 0000000..904ffca
--- /dev/null
+++ b/core/Overlay/ChatOverlayProtocol.cs
@@ -0,0 +1,30 @@
+using StreamerHub.Core.Rpc;
+
+namespace StreamerHub.Core.Overlay;
+
+public static class ChatOverlayProtocol
+{
+    public const int Version = 1;
+
+    public static string Hello(ChatOverlaySettings settings, bool connected) =>
+        Serialize("hello", new { settings, connected });
+
+    public static string ChatMessage(ChatMessage message) =>
+        Serialize("chat-message", message, message.Id);
+
+    public static string Settings(ChatOverlaySettings settings) =>
+        Serialize("settings", settings);
+
+    public static string Connected() => Serialize("connected", new { connected = true });
+
+    public static string Disconnected() => Serialize("disconnected", new { connected = false });
+
+    private static string Serialize(string kind, object payload, string? id = null) =>
+        Json.Serialize(new
+        {
+            v = Version,
+            id = string.IsNullOrWhiteSpace(id) ? $"overlay-{Guid.NewGuid():N}" : id,
+            kind,
+            payload,
+        });
+}
diff --git a/core/Overlay/ChatOverlayServer.cs b/core/Overlay/ChatOverlayServer.cs
new file mode 100644
index 0000000..997683c
--- /dev/null
+++ b/core/Overlay/ChatOverlayServer.cs
@@ -0,0 +1,454 @@
+using System.Collections.Concurrent;
+using System.Net;
+using System.Net.Sockets;
+using System.Net.WebSockets;
+using System.Text;
+using StreamerHub.Core.Rpc;
+
+namespace StreamerHub.Core.Overlay;
+
+public sealed class ChatOverlayServer : IDisposable, IAsyncDisposable
+{
+    private const int DuplicateWindowSize = 2048;
+
+    private sealed class ClientConnection : IDisposable
+    {
+        private readonly SemaphoreSlim _sendLock = new(1, 1);
+
+        public ClientConnection(WebSocket socket) => Socket = socket;
+
+        public WebSocket Socket { get; }
+
+        public async Task SendAsync(string message, CancellationToken cancellationToken)
+        {
+            var bytes = Encoding.UTF8.GetBytes(message);
+            await _sendLock.WaitAsync(cancellationToken).ConfigureAwait(false);
+            try
+            {
+                if (Socket.State == WebSocketState.Open)
+                {
+                    await Socket.SendAsync(bytes, WebSocketMessageType.Text, true, cancellationToken)
+                        .ConfigureAwait(false);
+                }
+            }
+            finally
+            {
+                _sendLock.Release();
+            }
+        }
+
+        public void Dispose()
+        {
+            Socket.Dispose();
+            _sendLock.Dispose();
+        }
+    }
+
+    private readonly string _assetRoot;
+    private readonly SemaphoreSlim _lifecycleLock = new(1, 1);
+    private readonly ConcurrentDictionary<Guid, ClientConnection> _clients = new();
+    private readonly object _stateLock = new();
+    private readonly HashSet<string> _seenMessageIds = new(StringComparer.Ordinal);
+    private readonly Queue<string> _seenMessageOrder = new();
+    private HttpListener? _listener;
+    private CancellationTokenSource? _serverCancellation;
+    private Task? _acceptLoop;
+    private ChatOverlaySettings _settings;
+    private bool _connected;
+    private int _disposed;
+
+    public ChatOverlayServer(string assetRoot, ChatOverlaySettings settings, bool connected = false)
+    {
+        if (string.IsNullOrWhiteSpace(assetRoot)) throw new ArgumentException("An overlay asset root is required.", nameof(assetRoot));
+        _assetRoot = Path.GetFullPath(assetRoot);
+        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
+        _connected = connected;
+    }
+
+    public int Port { get; private set; }
+
+    public Uri OverlayUrl { get; private set; } = null!;
+
+    public Uri WebSocketUrl { get; private set; } = null!;
+
+    public async Task StartAsync(CancellationToken cancellationToken = default)
+    {
+        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);
+        await _lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
+        try
+        {
+            if (_listener?.IsListening == true) return;
+
+            Directory.CreateDirectory(_assetRoot);
+            Exception? lastError = null;
+            for (var attempt = 0; attempt < 10; attempt++)
+            {
+                cancellationToken.ThrowIfCancellationRequested();
+                var port = FindAvailableLoopbackPort();
+                var listener = new HttpListener();
+                listener.Prefixes.Add($"http://127.0.0.1:{port}/");
+                try
+                {
+                    listener.Start();
+                    Port = port;
+                    OverlayUrl = new Uri($"http://127.0.0.1:{port}/chat-overlay.html");
+                    WebSocketUrl = new Uri($"ws://127.0.0.1:{port}/ws");
+                    _listener = listener;
+                    _serverCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
+                    _acceptLoop = AcceptLoopAsync(listener, _serverCancellation.Token);
+                    return;
+                }
+                catch (HttpListenerException ex)
+                {
+                    lastError = ex;
+                    listener.Close();
+                }
+            }
+
+            throw new InvalidOperationException("Could not bind the chat overlay server to a loopback port.", lastError);
+        }
+        finally
+        {
+            _lifecycleLock.Release();
+        }
+    }
+
+    public async Task<bool> PublishChatMessageAsync(ChatMessage message, CancellationToken cancellationToken = default)
+    {
+        ArgumentNullException.ThrowIfNull(message);
+        var id = string.IsNullOrWhiteSpace(message.Id) ? $"chat-{Guid.NewGuid():N}" : message.Id.Trim();
+        lock (_stateLock)
+        {
+            if (!_seenMessageIds.Add(id)) return false;
+            _seenMessageOrder.Enqueue(id);
+            while (_seenMessageOrder.Count > DuplicateWindowSize)
+            {
+                _seenMessageIds.Remove(_seenMessageOrder.Dequeue());
+            }
+        }
+
+        await BroadcastAsync(ChatOverlayProtocol.ChatMessage(message with { Id = id }), cancellationToken)
+            .ConfigureAwait(false);
+        return true;
+    }
+
+    public async Task UpdateSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default)
+    {
+        ArgumentNullException.ThrowIfNull(settings);
+        lock (_stateLock) _settings = settings;
+        await BroadcastAsync(ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
+    }
+
+    public async Task SetConnectedAsync(bool connected, CancellationToken cancellationToken = default)
+    {
+        lock (_stateLock)
+        {
+            if (_connected == connected) return;
+            _connected = connected;
+        }
+
+        await BroadcastAsync(
+            connected ? ChatOverlayProtocol.Connected() : ChatOverlayProtocol.Disconnected(),
+            cancellationToken).ConfigureAwait(false);
+    }
+
+    public async Task StopAsync(CancellationToken cancellationToken = default)
+    {
+        await _lifecycleLock.WaitAsync(cancellationToken).ConfigureAwait(false);
+        try
+        {
+            var listener = _listener;
+            var serverCancellation = _serverCancellation;
+            var acceptLoop = _acceptLoop;
+            _listener = null;
+            _serverCancellation = null;
+            _acceptLoop = null;
+
+            if (listener is null) return;
+            serverCancellation?.Cancel();
+            try
+            {
+                listener.Stop();
+                listener.Close();
+            }
+            catch
+            {
+            }
+
+            foreach (var pair in _clients.ToArray())
+            {
+                if (!_clients.TryRemove(pair.Key, out var client)) continue;
+                try
+                {
+                    if (client.Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
+                    {
+                        await client.Socket.CloseOutputAsync(
+                            WebSocketCloseStatus.NormalClosure,
+                            "Streamer Hub is shutting down",
+                            CancellationToken.None).ConfigureAwait(false);
+                    }
+                }
+                catch
+                {
+                }
+                client.Dispose();
+            }
+
+            if (acceptLoop is not null)
+            {
+                try
+                {
+                    await acceptLoop.WaitAsync(cancellationToken).ConfigureAwait(false);
+                }
+                catch (OperationCanceledException) when (serverCancellation?.IsCancellationRequested == true)
+                {
+                }
+                catch (HttpListenerException)
+                {
+                }
+                catch (ObjectDisposedException)
+                {
+                }
+            }
+
+            serverCancellation?.Dispose();
+            Port = 0;
+        }
+        finally
+        {
+            _lifecycleLock.Release();
+        }
+    }
+
+    private async Task AcceptLoopAsync(HttpListener listener, CancellationToken cancellationToken)
+    {
+        while (!cancellationToken.IsCancellationRequested && listener.IsListening)
+        {
+            HttpListenerContext context;
+            try
+            {
+                context = await listener.GetContextAsync().WaitAsync(cancellationToken).ConfigureAwait(false);
+            }
+            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
+            {
+                break;
+            }
+            catch (HttpListenerException) when (!listener.IsListening || cancellationToken.IsCancellationRequested)
+            {
+                break;
+            }
+            catch (ObjectDisposedException)
+            {
+                break;
+            }
+
+            _ = HandleContextAsync(context, cancellationToken);
+        }
+    }
+
+    private async Task HandleContextAsync(HttpListenerContext context, CancellationToken cancellationToken)
+    {
+        try
+        {
+            if (context.Request.RemoteEndPoint is null || !IPAddress.IsLoopback(context.Request.RemoteEndPoint.Address))
+            {
+                await CloseResponseAsync(context.Response, HttpStatusCode.Forbidden, "Loopback requests only.")
+                    .ConfigureAwait(false);
+                return;
+            }
+
+            if (!string.Equals(context.Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
+            {
+                context.Response.Headers[HttpResponseHeader.Allow] = "GET";
+                await CloseResponseAsync(context.Response, HttpStatusCode.MethodNotAllowed, "GET required.")
+                    .ConfigureAwait(false);
+                return;
+            }
+
+            var path = context.Request.Url?.AbsolutePath ?? "/";
+            if (string.Equals(path, "/ws", StringComparison.Ordinal))
+            {
+                if (!context.Request.IsWebSocketRequest)
+                {
+                    await CloseResponseAsync(context.Response, HttpStatusCode.BadRequest, "WebSocket upgrade required.")
+                        .ConfigureAwait(false);
+                    return;
+                }
+                await HandleWebSocketAsync(context, cancellationToken).ConfigureAwait(false);
+                return;
+            }
+
+            await ServeAssetAsync(context.Response, path, cancellationToken).ConfigureAwait(false);
+        }
+        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
+        {
+            TryClose(context.Response);
+        }
+        catch
+        {
+            try
+            {
+                await CloseResponseAsync(context.Response, HttpStatusCode.InternalServerError, "Overlay server error.")
+                    .ConfigureAwait(false);
+            }
+            catch
+            {
+                TryClose(context.Response);
+            }
+        }
+    }
+
+    private async Task HandleWebSocketAsync(HttpListenerContext context, CancellationToken cancellationToken)
+    {
+        HttpListenerWebSocketContext upgrade;
+        try
+        {
+            upgrade = await context.AcceptWebSocketAsync(null).ConfigureAwait(false);
+        }
+        catch
+        {
+            TryClose(context.Response);
+            return;
+        }
+
+        var id = Guid.NewGuid();
+        var client = new ClientConnection(upgrade.WebSocket);
+        _clients[id] = client;
+        try
+        {
+            ChatOverlaySettings settings;
+            bool connected;
+            lock (_stateLock)
+            {
+                settings = _settings;
+                connected = _connected;
+            }
+
+            await client.SendAsync(ChatOverlayProtocol.Hello(settings, connected), cancellationToken).ConfigureAwait(false);
+            await client.SendAsync(ChatOverlayProtocol.Settings(settings), cancellationToken).ConfigureAwait(false);
+            await client.SendAsync(
+                connected ? ChatOverlayProtocol.Connected() : ChatOverlayProtocol.Disconnected(),
+                cancellationToken).ConfigureAwait(false);
+
+            var buffer = new byte[1024];
+            while (!cancellationToken.IsCancellationRequested && client.Socket.State == WebSocketState.Open)
+            {
+                var result = await client.Socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
+                if (result.MessageType == WebSocketMessageType.Close) break;
+            }
+
+            if (client.Socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
+            {
+                await client.Socket.CloseOutputAsync(
+                    WebSocketCloseStatus.NormalClosure,
+                    "Connection closed",
+                    CancellationToken.None).ConfigureAwait(false);
+            }
+        }
+        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
+        {
+        }
+        catch (WebSocketException)
+        {
+        }
+        finally
+        {
+            _clients.TryRemove(id, out _);
+            client.Dispose();
+        }
+    }
+
+    private async Task ServeAssetAsync(HttpListenerResponse response, string requestPath, CancellationToken cancellationToken)
+    {
+        var relativePath = requestPath is "/" or "/chat-overlay.html"
+            ? OverlayEntryPath()
+            : Uri.UnescapeDataString(requestPath.TrimStart('/')).Replace('/', Path.DirectorySeparatorChar);
+        var fullPath = Path.GetFullPath(Path.Combine(_assetRoot, relativePath));
+        var rootPrefix = _assetRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
+        if (!fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
+        {
+            await CloseResponseAsync(response, HttpStatusCode.NotFound, "Overlay asset not found.").ConfigureAwait(false);
+            return;
+        }
+
+        response.StatusCode = (int)HttpStatusCode.OK;
+        response.ContentType = ContentTypeFor(fullPath);
+        response.Headers[HttpResponseHeader.CacheControl] = "no-store";
+        response.Headers["X-Content-Type-Options"] = "nosniff";
+        var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken).ConfigureAwait(false);
+        response.ContentLength64 = bytes.Length;
+        await response.OutputStream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
+        response.Close();
+    }
+
+    private async Task BroadcastAsync(string message, CancellationToken cancellationToken)
+    {
+        var sends = _clients.Select(async pair =>
+        {
+            try
+            {
+                await pair.Value.SendAsync(message, cancellationToken).ConfigureAwait(false);
+            }
+            catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException or InvalidOperationException)
+            {
+                if (_clients.TryRemove(pair.Key, out var client)) client.Dispose();
+            }
+        });
+        await Task.WhenAll(sends).ConfigureAwait(false);
+    }
+
+    private static int FindAvailableLoopbackPort()
+    {
+        using var probe = new TcpListener(IPAddress.Loopback, 0);
+        probe.Start();
+        return ((IPEndPoint)probe.LocalEndpoint).Port;
+    }
+
+    private string OverlayEntryPath() =>
+        File.Exists(Path.Combine(_assetRoot, "chat-overlay.html"))
+            ? "chat-overlay.html"
+            : Path.Combine("src", "chat-overlay.html");
+
+    private static string ContentTypeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
+    {
+        ".html" => "text/html; charset=utf-8",
+        ".js" => "text/javascript; charset=utf-8",
+        ".css" => "text/css; charset=utf-8",
+        ".svg" => "image/svg+xml",
+        ".png" => "image/png",
+        ".jpg" or ".jpeg" => "image/jpeg",
+        ".webp" => "image/webp",
+        ".woff2" => "font/woff2",
+        ".json" => "application/json; charset=utf-8",
+        _ => "application/octet-stream",
+    };
+
+    private static async Task CloseResponseAsync(HttpListenerResponse response, HttpStatusCode status, string message)
+    {
+        var bytes = Encoding.UTF8.GetBytes(message);
+        response.StatusCode = (int)status;
+        response.ContentType = "text/plain; charset=utf-8";
+        response.ContentLength64 = bytes.Length;
+        await response.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
+        response.Close();
+    }
+
+    private static void TryClose(HttpListenerResponse response)
+    {
+        try { response.Close(); } catch { }
+    }
+
+    public void Dispose()
+    {
+        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
+        StopAsync().GetAwaiter().GetResult();
+        _lifecycleLock.Dispose();
+    }
+
+    public async ValueTask DisposeAsync()
+    {
+        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
+        await StopAsync().ConfigureAwait(false);
+        _lifecycleLock.Dispose();
+    }
+}
diff --git a/core/Rpc/Envelope.cs b/core/Rpc/Envelope.cs
index 8dc9297..2468efb 100644
--- a/core/Rpc/Envelope.cs
+++ b/core/Rpc/Envelope.cs
@@ -40,20 +40,21 @@ public static class Channels
     public const string CountersDelete = "counters/delete";
     public const string ObsWrite = "obs/write";
     public const string DialogSaveFile = "dialog/save-file";
     public const string LogAppend = "log/append";
     public const string TwitchAuthorize = "twitch/authorize";
     public const string TwitchForget = "twitch/forget";
     public const string TwitchBotAuthorize = "twitch/bot-authorize";
     public const string TwitchBotForget = "twitch/bot-forget";
     public const string SettingsGetState = "settings/get-state";
     public const string SettingsSave = "settings/save";
+    public const string ChatOverlayGetUrl = "chat-overlay/get-url";
     public const string OpenRouterGetState = "openrouter/get-state";
     public const string OpenRouterSave = "openrouter/save";
     public const string WindowBeginDrag = "window/begin-drag";
     public const string AutoRepliesGetState = "auto-replies/get-state";
     public const string AutoRepliesSettingsGet = "auto-replies/settings-get";
     public const string AutoRepliesSettingsSave = "auto-replies/settings-save";
     public const string AutoRepliesSave = "auto-replies/save";
     public const string AutoRepliesDelete = "auto-replies/delete";
     public const string TwitchSendChatMessage = "twitch/send-chat-message";
     public const string TwitchUpdateTitle = "twitch/update-title";
diff --git a/core/StreamerHub.csproj b/core/StreamerHub.csproj
index c376f54..da999c7 100644
--- a/core/StreamerHub.csproj
+++ b/core/StreamerHub.csproj
@@ -13,16 +13,17 @@
     <ApplicationHighDpiMode>PerMonitorV2</ApplicationHighDpiMode>
     <NoWarn>$(NoWarn);MSB3277</NoWarn>
   </PropertyGroup>
 
   <ItemGroup>
     <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2903.40" />
     <PackageReference Include="System.Security.Cryptography.ProtectedData" Version="8.0.0" />
   </ItemGroup>
 
   <ItemGroup>
-    <Content Include="..\dist\**\*" Link="wwwroot\%(RecursiveDir)%(Filename)%(Extension)" CopyToOutputDirectory="PreserveNewest" />
+    <Content Include="..\dist\**\*" Exclude="..\dist\src\chat-overlay.html" Link="wwwroot\%(RecursiveDir)%(Filename)%(Extension)" CopyToOutputDirectory="PreserveNewest" />
+    <Content Include="..\dist\src\chat-overlay.html" Link="wwwroot\chat-overlay.html" CopyToOutputDirectory="PreserveNewest" />
     <Content Include="..\assets\streamer-hub-icon.ico" Link="streamer-hub-icon.ico" CopyToOutputDirectory="PreserveNewest" />
   </ItemGroup>
 
 </Project>
 
diff --git a/src/chat-overlay.html b/src/chat-overlay.html
new file mode 100644
index 0000000..6d35a1a
--- /dev/null
+++ b/src/chat-overlay.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="color-scheme" content="dark light" />
+    <title>Streamer Hub Chat Overlay</title>
+  </head>
+  <body>
+    <div id="chat-overlay-root"></div>
+    <script type="module" src="/src/chat-overlay.tsx"></script>
+  </body>
+</html>
diff --git a/src/chat-overlay.tsx b/src/chat-overlay.tsx
new file mode 100644
index 0000000..532a0b2
--- /dev/null
+++ b/src/chat-overlay.tsx
@@ -0,0 +1,379 @@
+import '@fontsource/barlow/500.css';
+import '@fontsource/barlow/700.css';
+import React, { useEffect, useRef, useState } from 'react';
+import { createRoot } from 'react-dom/client';
+import {
+  CHAT_OVERLAY_AVATAR_FALLBACK,
+  DEFAULT_CHAT_OVERLAY_SETTINGS,
+  normalizeChatOverlayMessage,
+  normalizeChatOverlaySettings,
+  type NormalizedChatOverlayMessage,
+} from './lib/chatOverlay';
+import type { ChatMessage, ChatOverlaySettings } from './rpc/contracts';
+
+type ServerState = 'connecting' | 'online' | 'offline';
+
+interface OverlayEnvelope {
+  v: number;
+  id: string;
+  kind: 'hello' | 'chat-message' | 'settings' | 'connected' | 'disconnected';
+  payload: unknown;
+}
+
+interface HelloPayload {
+  settings?: Partial<ChatOverlaySettings>;
+  connected?: boolean;
+}
+
+const styles = `
+  :root {
+    color-scheme: dark;
+    font-family: "Barlow", "Segoe UI", sans-serif;
+    font-synthesis: none;
+  }
+
+  * { box-sizing: border-box; }
+
+  html, body, #chat-overlay-root {
+    width: 100%;
+    height: 100%;
+    margin: 0;
+    overflow: hidden;
+    background: transparent;
+  }
+
+  body { -webkit-font-smoothing: antialiased; }
+
+  .overlay {
+    --surface: rgba(16, 18, 24, 0.88);
+    --surface-edge: rgba(255, 255, 255, 0.1);
+    --ink: #f7f4ee;
+    --muted: #b9bec8;
+    --signal: #8b5cf6;
+    --shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
+    display: flex;
+    align-items: flex-end;
+    width: 100%;
+    height: 100%;
+    padding: clamp(12px, 2.5vw, 32px);
+    color: var(--ink);
+  }
+
+  .overlay[data-theme="light"] {
+    color-scheme: light;
+    --surface: rgba(250, 248, 244, 0.94);
+    --surface-edge: rgba(31, 35, 45, 0.13);
+    --ink: #1f232d;
+    --muted: #606775;
+    --signal: #6d28d9;
+    --shadow: 0 12px 32px rgba(31, 35, 45, 0.16);
+  }
+
+  .overlay[data-theme="transparent"] {
+    --surface: rgba(16, 18, 24, 0.58);
+    --surface-edge: rgba(255, 255, 255, 0.13);
+    --shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
+  }
+
+  .message-list {
+    display: flex;
+    flex-direction: column;
+    justify-content: flex-end;
+    gap: var(--message-gap);
+    width: min(760px, 100%);
+    margin: 0;
+    padding: 0;
+    list-style: none;
+  }
+
+  .message {
+    position: relative;
+    display: grid;
+    grid-template-columns: auto minmax(0, 1fr);
+    gap: clamp(10px, 1.4vw, 16px);
+    align-items: center;
+    min-height: calc(var(--avatar-size) + 20px);
+    padding: 10px 16px 11px 13px;
+    overflow: hidden;
+    border: 1px solid var(--surface-edge);
+    border-radius: 18px;
+    background: var(--surface);
+    box-shadow: var(--shadow);
+    backdrop-filter: blur(12px);
+  }
+
+  .message::before {
+    content: "";
+    position: absolute;
+    inset: 0 auto 0 0;
+    width: 4px;
+    background: var(--role-color, var(--signal));
+  }
+
+  .overlay[data-shape="square"] .message { border-radius: 4px; }
+  .message.message--no-avatar { grid-template-columns: minmax(0, 1fr); }
+
+  .message[data-role="broadcaster"] { --role-color: #f43f5e; }
+  .message[data-role="moderator"] { --role-color: #22c55e; }
+  .message[data-role="vip"] { --role-color: #ec4899; }
+  .message[data-role="subscriber"] { --role-color: #38bdf8; }
+
+  .message[data-animation="slide"] { animation: signal-in 300ms cubic-bezier(.2,.8,.2,1) both; }
+  .message[data-animation="fade"] { animation: fade-in 260ms ease-out both; }
+
+  .avatar {
+    width: var(--avatar-size);
+    height: var(--avatar-size);
+    border: 2px solid color-mix(in srgb, var(--role-color, var(--signal)) 68%, white 32%);
+    border-radius: 50%;
+    object-fit: cover;
+    background: #334155;
+  }
+
+  .message-copy { min-width: 0; }
+
+  .username {
+    display: block;
+    margin-bottom: 2px;
+    overflow: hidden;
+    color: color-mix(in srgb, var(--role-color, var(--signal)) 74%, var(--ink) 26%);
+    font-size: max(12px, calc(var(--font-size) * 0.68));
+    font-weight: 700;
+    letter-spacing: 0.035em;
+    line-height: 1.05;
+    text-overflow: ellipsis;
+    white-space: nowrap;
+  }
+
+  .message-text {
+    margin: 0;
+    overflow-wrap: anywhere;
+    color: var(--ink);
+    font-size: var(--font-size);
+    font-weight: 500;
+    line-height: 1.25;
+    text-wrap: pretty;
+  }
+
+  .status {
+    width: min(520px, 100%);
+    padding: 16px 18px 17px 21px;
+    border: 1px solid var(--surface-edge);
+    border-left: 4px solid var(--signal);
+    border-radius: 12px;
+    background: var(--surface);
+    box-shadow: var(--shadow);
+    backdrop-filter: blur(12px);
+  }
+
+  .status strong {
+    display: block;
+    margin-bottom: 3px;
+    font-size: 16px;
+    letter-spacing: 0.02em;
+  }
+
+  .status span {
+    color: var(--muted);
+    font-size: 14px;
+    line-height: 1.35;
+  }
+
+  @keyframes signal-in {
+    from { opacity: 0; transform: translate3d(-24px, 8px, 0) scale(.985); }
+    to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
+  }
+
+  @keyframes fade-in {
+    from { opacity: 0; transform: translateY(6px); }
+    to { opacity: 1; transform: translateY(0); }
+  }
+
+  @media (prefers-reduced-motion: reduce) {
+    .message { animation: none !important; }
+  }
+`;
+
+function OverlayApp() {
+  const [settings, setSettings] = useState(DEFAULT_CHAT_OVERLAY_SETTINGS);
+  const [messages, setMessages] = useState<NormalizedChatOverlayMessage[]>([]);
+  const [serverState, setServerState] = useState<ServerState>('connecting');
+  const [twitchConnected, setTwitchConnected] = useState(false);
+  const seenMessageIds = useRef(new Set<string>());
+  const reconnectAttempt = useRef(0);
+  const durationSeconds = useRef(settings.durationSeconds);
+
+  useEffect(() => {
+    durationSeconds.current = settings.durationSeconds;
+  }, [settings.durationSeconds]);
+
+  useEffect(() => {
+    let disposed = false;
+    let socket: WebSocket | undefined;
+    let retryTimer: number | undefined;
+
+    const connect = () => {
+      if (disposed) return;
+      setServerState(reconnectAttempt.current === 0 ? 'connecting' : 'offline');
+      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
+      socket = new WebSocket(`${scheme}://${window.location.host}/ws`);
+
+      socket.addEventListener('open', () => {
+        reconnectAttempt.current = 0;
+        setServerState('online');
+      });
+
+      socket.addEventListener('message', (event) => {
+        const envelope = parseEnvelope(event.data);
+        if (!envelope) return;
+
+        if (envelope.kind === 'hello') {
+          const payload = envelope.payload as HelloPayload;
+          setSettings(normalizeChatOverlaySettings(payload.settings));
+          setTwitchConnected(payload.connected === true);
+          return;
+        }
+        if (envelope.kind === 'settings') {
+          setSettings(normalizeChatOverlaySettings(envelope.payload as Partial<ChatOverlaySettings>));
+          return;
+        }
+        if (envelope.kind === 'connected' || envelope.kind === 'disconnected') {
+          setTwitchConnected(envelope.kind === 'connected');
+          return;
+        }
+        if (envelope.kind !== 'chat-message' || seenMessageIds.current.has(envelope.id)) return;
+
+        const message = normalizeChatOverlayMessage(envelope.payload as Partial<ChatMessage>);
+        seenMessageIds.current.add(envelope.id);
+        if (seenMessageIds.current.size > 2048) {
+          const oldest = seenMessageIds.current.values().next().value;
+          if (typeof oldest === 'string') seenMessageIds.current.delete(oldest);
+        }
+        setMessages((current) => [...current, message]);
+        window.setTimeout(() => {
+          setMessages((current) => current.filter((candidate) => candidate.id !== message.id));
+        }, durationSeconds.current * 1000);
+      });
+
+      socket.addEventListener('close', () => {
+        if (disposed) return;
+        setServerState('offline');
+        reconnectAttempt.current += 1;
+        const delay = Math.min(5000, 500 * 2 ** Math.min(4, reconnectAttempt.current));
+        retryTimer = window.setTimeout(connect, delay);
+      });
+
+      socket.addEventListener('error', () => socket?.close());
+    };
+
+    connect();
+    return () => {
+      disposed = true;
+      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
+      socket?.close();
+    };
+  }, []);
+
+  useEffect(() => {
+    setMessages((current) => current.slice(-settings.maxMessages));
+  }, [settings.maxMessages]);
+
+  const visibleMessages = settings.displayMode === 'latest' ? messages.slice(-1) : messages.slice(-settings.maxMessages);
+  const status = getStatus(serverState, twitchConnected, settings.enabled, visibleMessages.length);
+
+  return (
+    <main
+      className="overlay"
+      data-theme={settings.theme}
+      data-shape={settings.messageStyle}
+      style={{
+        '--font-size': `${settings.fontSize}px`,
+        '--avatar-size': `${settings.avatarSize}px`,
+        '--message-gap': `${settings.spacing}px`,
+      } as React.CSSProperties}
+    >
+      {status ? (
+        <div className="status" role="status" aria-live="polite">
+          <strong>{status.title}</strong>
+          <span>{status.detail}</span>
+        </div>
+      ) : (
+        <ol className="message-list" aria-live="polite" aria-relevant="additions removals">
+          {visibleMessages.map((message) => (
+            <li
+              className={`message${settings.showAvatars ? '' : ' message--no-avatar'}`}
+              data-animation={settings.animation}
+              data-role={messageRole(message)}
+              key={message.id}
+            >
+              {settings.showAvatars && (
+                <img
+                  className="avatar"
+                  src={message.avatarUrl}
+                  alt=""
+                  onError={(event) => { event.currentTarget.src = CHAT_OVERLAY_AVATAR_FALLBACK; }}
+                />
+              )}
+              <div className="message-copy">
+                {settings.showUsernames && <span className="username">{message.username}</span>}
+                <p className="message-text">{message.message}</p>
+              </div>
+            </li>
+          ))}
+        </ol>
+      )}
+    </main>
+  );
+}
+
+function parseEnvelope(value: unknown): OverlayEnvelope | null {
+  if (typeof value !== 'string') return null;
+  try {
+    const envelope = JSON.parse(value) as Partial<OverlayEnvelope>;
+    if (envelope.v !== 1 || typeof envelope.id !== 'string' || !envelope.id || typeof envelope.kind !== 'string') return null;
+    if (!['hello', 'chat-message', 'settings', 'connected', 'disconnected'].includes(envelope.kind)) return null;
+    return envelope as OverlayEnvelope;
+  } catch {
+    return null;
+  }
+}
+
+function messageRole(message: NormalizedChatOverlayMessage): string {
+  if (message.isBroadcaster) return 'broadcaster';
+  if (message.isMod) return 'moderator';
+  if (message.isVip) return 'vip';
+  if (message.isSubscriber) return 'subscriber';
+  return 'viewer';
+}
+
+function getStatus(server: ServerState, twitch: boolean, enabled: boolean, messageCount: number) {
+  if (server === 'offline') return {
+    title: 'Streamer Hub is not running',
+    detail: 'Open Streamer Hub to restore this chat overlay. It will reconnect automatically.',
+  };
+  if (server === 'connecting') return {
+    title: 'Connecting to Streamer Hub',
+    detail: 'The local chat service is starting.',
+  };
+  if (!enabled) return {
+    title: 'Chat overlay is disabled',
+    detail: 'Enable it in Streamer Hub before going live.',
+  };
+  if (!twitch) return {
+    title: 'Twitch chat is disconnected',
+    detail: 'Reconnect Twitch in Streamer Hub. This overlay will stay ready.',
+  };
+  if (messageCount === 0) return {
+    title: 'Waiting for chat',
+    detail: 'New Twitch messages will appear here.',
+  };
+  return null;
+}
+
+const root = document.getElementById('chat-overlay-root');
+if (!root) throw new Error('Chat overlay root was not found.');
+
+const style = document.createElement('style');
+style.textContent = styles;
+document.head.appendChild(style);
+createRoot(root).render(<OverlayApp />);
diff --git a/tests/StreamerHub.Task3Tests/Program.cs b/tests/StreamerHub.Task3Tests/Program.cs
new file mode 100644
index 0000000..ff742e6
--- /dev/null
+++ b/tests/StreamerHub.Task3Tests/Program.cs
@@ -0,0 +1,279 @@
+using System.Net;
+using System.Net.WebSockets;
+using System.Text;
+using System.Text.Json;
+using StreamerHub.Core.Overlay;
+using StreamerHub.Core.Rpc;
+
+var failures = new List<string>();
+
+await RunAsync("protocol_messages_are_versioned_and_identified", ProtocolMessagesAreVersionedAndIdentifiedAsync);
+await RunAsync("http_bootstrap_is_loopback_only", HttpBootstrapIsLoopbackOnlyAsync);
+await RunAsync("websocket_connect_receives_current_state", WebSocketConnectReceivesCurrentStateAsync);
+await RunAsync("broadcasts_chat_settings_and_connection_changes", BroadcastsChatSettingsAndConnectionChangesAsync);
+await RunAsync("reconnect_gets_state_without_replaying_messages", ReconnectGetsStateWithoutReplayingMessagesAsync);
+await RunAsync("duplicate_chat_message_ids_are_suppressed", DuplicateChatMessageIdsAreSuppressedAsync);
+await RunAsync("server_stops_accepting_requests", ServerStopsAcceptingRequestsAsync);
+
+if (failures.Count > 0)
+{
+    Console.Error.WriteLine($"{failures.Count} test(s) failed:");
+    foreach (var failure in failures) Console.Error.WriteLine($"- {failure}");
+    Environment.ExitCode = 1;
+}
+else
+{
+    Console.WriteLine("All Task 3 overlay server tests passed.");
+}
+
+async Task ProtocolMessagesAreVersionedAndIdentifiedAsync()
+{
+    using var hello = JsonDocument.Parse(ChatOverlayProtocol.Hello(new ChatOverlaySettings(), connected: false));
+    AssertEnvelope(hello.RootElement, "hello");
+    AssertEqual(false, hello.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean(), "hello connection state");
+
+    var message = SampleMessage("message-1");
+    using var chat = JsonDocument.Parse(ChatOverlayProtocol.ChatMessage(message));
+    AssertEnvelope(chat.RootElement, "chat-message");
+    AssertEqual("message-1", chat.RootElement.GetProperty("payload").GetProperty("id").GetString(), "chat payload ID");
+    await Task.CompletedTask;
+}
+
+async Task HttpBootstrapIsLoopbackOnlyAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    AssertEqual("127.0.0.1", fixture.Server.OverlayUrl.Host, "overlay host");
+    AssertTrue(fixture.Server.Port > 0, "available local port");
+
+    using var response = await fixture.Http.GetAsync(fixture.Server.OverlayUrl);
+    AssertEqual(HttpStatusCode.OK, response.StatusCode, "overlay HTTP status");
+    AssertContains(await response.Content.ReadAsStringAsync(), "overlay-bootstrap", "overlay bootstrap body");
+
+    using var missing = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/not-found"));
+    AssertEqual(HttpStatusCode.NotFound, missing.StatusCode, "unsupported path");
+
+    using var post = await fixture.Http.PostAsync(fixture.Server.OverlayUrl, new StringContent("ignored"));
+    AssertEqual(HttpStatusCode.MethodNotAllowed, post.StatusCode, "unsupported method");
+}
+
+async Task WebSocketConnectReceivesCurrentStateAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using var socket = await fixture.ConnectAsync();
+
+    AssertEqual("hello", Kind(await ReceiveAsync(socket)), "first websocket message");
+    AssertEqual("settings", Kind(await ReceiveAsync(socket)), "settings bootstrap");
+    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "connection bootstrap");
+}
+
+async Task BroadcastsChatSettingsAndConnectionChangesAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using var socket = await fixture.ConnectAsync();
+    await DrainBootstrapAsync(socket);
+
+    var settings = new ChatOverlaySettings { Enabled = true, MaxMessages = 4, Theme = "transparent" };
+    await fixture.Server.UpdateSettingsAsync(settings);
+    using var settingsEnvelope = JsonDocument.Parse(await ReceiveAsync(socket));
+    AssertEqual("settings", KindDocument(settingsEnvelope), "settings event");
+    AssertEqual(4, settingsEnvelope.RootElement.GetProperty("payload").GetProperty("maxMessages").GetInt32(), "updated maximum");
+
+    await fixture.Server.SetConnectedAsync(true);
+    AssertEqual("connected", Kind(await ReceiveAsync(socket)), "connected event");
+
+    await fixture.Server.PublishChatMessageAsync(SampleMessage("message-2"));
+    using var chatEnvelope = JsonDocument.Parse(await ReceiveAsync(socket));
+    AssertEqual("chat-message", KindDocument(chatEnvelope), "chat event");
+    AssertEqual("viewer", chatEnvelope.RootElement.GetProperty("payload").GetProperty("username").GetString(), "chat username");
+
+    await fixture.Server.SetConnectedAsync(false);
+    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "disconnected event");
+}
+
+async Task ReconnectGetsStateWithoutReplayingMessagesAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using (var first = await fixture.ConnectAsync())
+    {
+        await DrainBootstrapAsync(first);
+        await fixture.Server.PublishChatMessageAsync(SampleMessage("message-3"));
+        AssertEqual("chat-message", Kind(await ReceiveAsync(first)), "first connection chat event");
+        await first.CloseAsync(WebSocketCloseStatus.NormalClosure, "test reconnect", CancellationToken.None);
+    }
+
+    using var second = await fixture.ConnectAsync();
+    await DrainBootstrapAsync(second);
+    await fixture.Server.PublishChatMessageAsync(SampleMessage("message-4"));
+    using var envelope = JsonDocument.Parse(await ReceiveAsync(second));
+    AssertEqual("chat-message", KindDocument(envelope), "new message after reconnect");
+    AssertEqual("message-4", envelope.RootElement.GetProperty("payload").GetProperty("id").GetString(), "old messages are not replayed");
+}
+
+async Task DuplicateChatMessageIdsAreSuppressedAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    using var socket = await fixture.ConnectAsync();
+    await DrainBootstrapAsync(socket);
+
+    var message = SampleMessage("duplicate-id");
+    AssertTrue(await fixture.Server.PublishChatMessageAsync(message), "first message accepted");
+    AssertFalse(await fixture.Server.PublishChatMessageAsync(message), "duplicate message rejected");
+    AssertEqual("chat-message", Kind(await ReceiveAsync(socket)), "first message delivered");
+    await AssertNoMessageAsync(socket, "duplicate must not be delivered");
+}
+
+async Task ServerStopsAcceptingRequestsAsync()
+{
+    await using var fixture = await ServerFixture.StartAsync();
+    var url = fixture.Server.OverlayUrl;
+    await fixture.Server.StopAsync();
+    AssertEqual(0, fixture.Server.Port, "stopped server port");
+    try
+    {
+        using var timeout = new CancellationTokenSource(1000);
+        _ = await fixture.Http.GetAsync(url, timeout.Token);
+        throw new InvalidOperationException("stopped server still accepted an HTTP request");
+    }
+    catch (HttpRequestException)
+    {
+    }
+    catch (OperationCanceledException)
+    {
+    }
+}
+
+static ChatMessage SampleMessage(string id) => new()
+{
+    Id = id,
+    Username = "viewer",
+    UserId = "100",
+    AvatarUrl = "https://cdn.example/avatar.png",
+    Message = "hello chat",
+    Timestamp = "2026-08-27T12:00:00Z",
+};
+
+static async Task DrainBootstrapAsync(ClientWebSocket socket)
+{
+    AssertEqual("hello", Kind(await ReceiveAsync(socket)), "bootstrap hello");
+    AssertEqual("settings", Kind(await ReceiveAsync(socket)), "bootstrap settings");
+    var state = Kind(await ReceiveAsync(socket));
+    AssertTrue(state is "connected" or "disconnected", "bootstrap connection state");
+}
+
+static async Task<string> ReceiveAsync(ClientWebSocket socket, int timeoutMilliseconds = 3000)
+{
+    using var timeout = new CancellationTokenSource(timeoutMilliseconds);
+    var buffer = new byte[16 * 1024];
+    using var stream = new MemoryStream();
+    WebSocketReceiveResult result;
+    do
+    {
+        result = await socket.ReceiveAsync(buffer, timeout.Token);
+        if (result.MessageType == WebSocketMessageType.Close)
+            throw new InvalidOperationException("websocket closed before receiving a message");
+        stream.Write(buffer, 0, result.Count);
+    } while (!result.EndOfMessage);
+    return Encoding.UTF8.GetString(stream.ToArray());
+}
+
+static async Task AssertNoMessageAsync(ClientWebSocket socket, string label)
+{
+    try
+    {
+        _ = await ReceiveAsync(socket, 250);
+        throw new InvalidOperationException($"{label}: unexpected websocket message");
+    }
+    catch (OperationCanceledException)
+    {
+    }
+}
+
+static string Kind(string json)
+{
+    using var document = JsonDocument.Parse(json);
+    return KindDocument(document);
+}
+
+static string KindDocument(JsonDocument document) => document.RootElement.GetProperty("kind").GetString() ?? string.Empty;
+
+static void AssertEnvelope(JsonElement element, string expectedKind)
+{
+    AssertEqual(1, element.GetProperty("v").GetInt32(), $"{expectedKind} protocol version");
+    AssertEqual(expectedKind, element.GetProperty("kind").GetString(), $"{expectedKind} kind");
+    AssertTrue(!string.IsNullOrWhiteSpace(element.GetProperty("id").GetString()), $"{expectedKind} message ID");
+}
+
+async Task RunAsync(string name, Func<Task> test)
+{
+    try
+    {
+        await test();
+        Console.WriteLine($"PASS {name}");
+    }
+    catch (Exception ex)
+    {
+        failures.Add($"{name}: {ex.Message}");
+        Console.Error.WriteLine($"FAIL {name}: {ex}");
+    }
+}
+
+static void AssertContains(string value, string expected, string label)
+{
+    if (!value.Contains(expected, StringComparison.Ordinal))
+        throw new InvalidOperationException($"{label}: expected '{expected}'");
+}
+
+static void AssertEqual<T>(T expected, T actual, string label)
+{
+    if (!EqualityComparer<T>.Default.Equals(expected, actual))
+        throw new InvalidOperationException($"{label}: expected '{expected}' but got '{actual}'");
+}
+
+static void AssertTrue(bool value, string label)
+{
+    if (!value) throw new InvalidOperationException($"{label}: expected true");
+}
+
+static void AssertFalse(bool value, string label)
+{
+    if (value) throw new InvalidOperationException($"{label}: expected false");
+}
+
+sealed class ServerFixture : IAsyncDisposable
+{
+    private readonly string _assetRoot;
+
+    private ServerFixture(string assetRoot, ChatOverlayServer server)
+    {
+        _assetRoot = assetRoot;
+        Server = server;
+        Http = new HttpClient();
+    }
+
+    public ChatOverlayServer Server { get; }
+    public HttpClient Http { get; }
+
+    public static async Task<ServerFixture> StartAsync()
+    {
+        var assetRoot = Path.Combine(Path.GetTempPath(), $"streamer-hub-overlay-tests-{Guid.NewGuid():N}");
+        Directory.CreateDirectory(assetRoot);
+        await File.WriteAllTextAsync(Path.Combine(assetRoot, "chat-overlay.html"), "<!doctype html><div id=\"overlay-bootstrap\">overlay-bootstrap</div>");
+        var server = new ChatOverlayServer(assetRoot, new ChatOverlaySettings());
+        await server.StartAsync();
+        return new ServerFixture(assetRoot, server);
+    }
+
+    public async Task<ClientWebSocket> ConnectAsync()
+    {
+        var socket = new ClientWebSocket();
+        await socket.ConnectAsync(Server.WebSocketUrl, CancellationToken.None);
+        return socket;
+    }
+
+    public async ValueTask DisposeAsync()
+    {
+        Http.Dispose();
+        await Server.DisposeAsync();
+        Directory.Delete(_assetRoot, recursive: true);
+    }
+}
diff --git a/tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj b/tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj
new file mode 100644
index 0000000..f6deb03
--- /dev/null
+++ b/tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj
@@ -0,0 +1,15 @@
+<Project Sdk="Microsoft.NET.Sdk">
+
+  <PropertyGroup>
+    <OutputType>Exe</OutputType>
+    <TargetFramework>net8.0-windows</TargetFramework>
+    <ImplicitUsings>enable</ImplicitUsings>
+    <Nullable>enable</Nullable>
+    <NoWarn>$(NoWarn);MSB3277</NoWarn>
+  </PropertyGroup>
+
+  <ItemGroup>
+    <ProjectReference Include="..\..\core\StreamerHub.csproj" />
+  </ItemGroup>
+
+</Project>
diff --git a/vite.config.ts b/vite.config.ts
index 28742b1..ca2326a 100644
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -1,12 +1,18 @@
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
 import tailwindcss from '@tailwindcss/vite';
 
 export default defineConfig({
   base: './',
   plugins: [react(), tailwindcss()],
   build: {
     target: 'chrome120',
     outDir: 'dist',
+    rollupOptions: {
+      input: {
+        app: 'index.html',
+        chatOverlay: 'src/chat-overlay.html',
+      },
+    },
   },
 });
