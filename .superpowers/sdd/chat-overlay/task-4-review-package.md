# Review package
Base: 486247912eb9850de37bbd2e1edb720734a77b6f
Head: b494aac3be224e8fdc4f321ffedab580e3b20f43

## Commits
b494aac Wire chat overlay into host events and RPC

## Stat
 .superpowers/sdd/chat-overlay/task-4-report.md     |  46 +++++
 core/Host/HostController.cs                        |  75 +++++++-
 core/Rpc/Envelope.cs                               |   2 +
 src/rpc/contracts.ts                               |   6 +
 src/rpc/mockHost.test.mjs                          | 209 +++++++++++++++++++++
 src/rpc/mockHost.ts                                |  43 ++++-
 tests/StreamerHub.Task4Tests/Program.cs            | 117 ++++++++++++
 .../StreamerHub.Task4Tests.csproj                  |  15 ++
 8 files changed, 508 insertions(+), 5 deletions(-)

## Diff
diff --git a/.superpowers/sdd/chat-overlay/task-4-report.md b/.superpowers/sdd/chat-overlay/task-4-report.md
new file mode 100644
index 0000000..2636d4f
--- /dev/null
+++ b/.superpowers/sdd/chat-overlay/task-4-report.md
@@ -0,0 +1,46 @@
+# Task 4 Report — Connect native events and overlay RPC
+
+Date: 2026-08-27
+
+## Status
+
+Complete. The desktop host and browser mock now expose the same typed chat-overlay RPC surface, persisted settings are normalized by the native settings store and broadcast live, accepted Twitch messages continue through the existing app event path and are also published to the overlay server, and Twitch connection transitions are forwarded without stopping the overlay server.
+
+## Implementation
+
+- Added typed `ChatOverlayGetState`, `ChatOverlaySaveSettings`, and `ChatOverlayGetUrl` channels to the TypeScript host API and matching native channel constants.
+- Added `ChatOverlayHostBridge` as the testable native boundary between `HostController`, `SettingsStore`, and `ChatOverlayServer`.
+- Registered native get-state, save-settings, and URL RPC handlers. Saves persist the normalized state from `SettingsStore` and broadcast that normalized state to connected overlay clients.
+- Preserved the existing Twitch relay sequence: the host still logs and posts `twitch/chat-message` to the WebView (Feed, counters, triggers, and auto-replies), then independently publishes the same enriched/normalized message to the overlay server.
+- Forwarded Twitch state changes to the overlay server as connected/disconnected events. The loopback server remains running, so the overlay shell remains loaded across disconnects and reconnects.
+- Retained the `MainForm` lifecycle established by Task 3: the loopback server starts with persisted settings before host initialization and is disposed during application shutdown.
+- Completed mock-host hydration, settings persistence, URL retrieval, and existing status/chat event behavior for browser development mode.
+
+## Tests added
+
+- `src/rpc/mockHost.test.mjs`
+  - hydrates saved overlay settings through RPC;
+  - saves settings and returns the updated state;
+  - returns the stable loopback OBS URL;
+  - preserves existing status and Twitch chat events.
+- `tests/StreamerHub.Task4Tests`
+  - verifies initial disconnected state and URL;
+  - verifies native settings normalization, persistence boundary, and live settings broadcast;
+  - verifies full chat identity/message forwarding;
+  - verifies connected and disconnected broadcasts against a real WebSocket client.
+
+## Verification
+
+- `node --test --experimental-strip-types <all src/**/*.test.mjs>` — 24 passed, 0 failed.
+- `dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj` — 4/4 passed.
+- `dotnet run --project tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj` — 10/10 passed.
+- `dotnet run --project tests/StreamerHub.Task4Tests/StreamerHub.Task4Tests.csproj` — passed.
+- `npm run typecheck` — passed.
+- `npm run build` — passed (1,624 modules transformed).
+- `dotnet build core/StreamerHub.csproj --no-restore -p:OutputPath=bin/Task4Build/ -p:UseAppHost=false` — succeeded with 0 warnings and 0 errors.
+- `git diff --check` — passed.
+
+## Concerns
+
+- The older Task 2 test project emits its pre-existing `MSB3277` WindowsBase version-conflict warning while still passing 4/4. The Task 3 and new Task 4 projects suppress that known WebView2 reference warning, and the production native build completes with 0 warnings.
+- The normal workspace patch helper continued to fail with `helper_unknown_error: setup refresh had errors`; the explicitly authorized direct-workspace editing fallback was used. Final diffs and builds verify the resulting files.
\ No newline at end of file
diff --git a/core/Host/HostController.cs b/core/Host/HostController.cs
index 35d0d8f..b923a82 100644
--- a/core/Host/HostController.cs
+++ b/core/Host/HostController.cs
@@ -5,20 +5,50 @@ using Microsoft.Web.WebView2.Core;
 using Microsoft.Web.WebView2.WinForms;
 using StreamerHub.Core.Obs;
 using StreamerHub.Core.AI;
 using StreamerHub.Core.Overlay;
 using StreamerHub.Core.Rpc;
 using StreamerHub.Core.Storage;
 using StreamerHub.Core.Twitch;
 
 namespace StreamerHub.Core.Host;
 
+public sealed class ChatOverlayHostBridge
+{
+    private readonly SettingsStore _settings;
+    private readonly ChatOverlayServer _server;
+
+    public ChatOverlayHostBridge(SettingsStore settings, ChatOverlayServer server)
+    {
+        _settings = settings;
+        _server = server;
+    }
+
+    public ChatOverlaySettings GetState() => _settings.ChatOverlay;
+
+    public string GetUrl() => _server.OverlayUrl?.ToString() ?? string.Empty;
+
+    public async Task<bool> SaveSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default)
+    {
+        ArgumentNullException.ThrowIfNull(settings);
+        _settings.SetChatOverlay(settings);
+        await _server.UpdateSettingsAsync(_settings.ChatOverlay, cancellationToken).ConfigureAwait(false);
+        return true;
+    }
+
+    public async Task<bool> PublishChatMessageAsync(ChatMessage message, CancellationToken cancellationToken = default) =>
+        await _server.PublishChatMessageAsync(message, cancellationToken).ConfigureAwait(false);
+
+    public async Task SetConnectedAsync(bool connected, CancellationToken cancellationToken = default) =>
+        await _server.SetConnectedAsync(connected, cancellationToken).ConfigureAwait(false);
+}
+
 public sealed class HostController : IDisposable
 {
     private sealed record SetCountPayload(string CounterId, int Count, string Source);
     private sealed record SaveCounterPayload(Counter? Counter);
     private sealed record DeleteCounterPayload(string CounterId);
     private sealed record ObsWritePayload(string FilePath, string Content);
     private sealed record SaveFilePayload(string DefaultName);
     private sealed record SaveSettingsPayload(TwitchSettings? Twitch, string? Language, bool? BotAccountEnabled = null, bool? StartupEnabled = null);
     private sealed record SaveAutoReplyPayload(AutoReply? Rule);
     private sealed record SaveAutoReplySettingsPayload(AutoReplySettings? Settings);
@@ -28,21 +58,21 @@ public sealed class HostController : IDisposable
     private sealed record SaveOpenRouterPayload(string Provider, string? ApiKey);
     private sealed record GenerateAutoReplyPayload(string RuleId, ChatMessage? Message, bool? Send = null);
     private sealed record GenerateAutoReplyResponse(bool Ok, string? Message = null, bool UsedFallback = false, string? Error = null);
     private sealed record UpdateCheckResponse(string CurrentVersion, string LatestVersion, bool UpdateAvailable, string ReleaseUrl, string? DownloadUrl = null, string? ReleaseNotes = null);
     private sealed record UpdateInstallPayload(string DownloadUrl);
 
     private readonly MainForm _form;
     private readonly WebView2 _webView;
     private readonly CancellationToken _shutdown;
     private readonly SettingsStore _settings;
-    private readonly ChatOverlayServer _chatOverlayServer;
+    private readonly ChatOverlayHostBridge _chatOverlay;
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
@@ -62,21 +92,21 @@ public sealed class HostController : IDisposable
     private readonly SemaphoreSlim _aiRequestLock = new(1, 1);
     private DateTime _aiWindow = DateTime.UtcNow;
     private int _aiRequestsInWindow;
 
     public HostController(MainForm form, WebView2 webView, SettingsStore settings, ChatOverlayServer chatOverlayServer, string appData, CancellationToken shutdown)
     {
         _form = form;
         _webView = webView;
         _shutdown = shutdown;
         _settings = settings;
-        _chatOverlayServer = chatOverlayServer;
+        _chatOverlay = new ChatOverlayHostBridge(settings, chatOverlayServer);
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
@@ -226,22 +256,31 @@ public sealed class HostController : IDisposable
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
+        _dispatcher.Register(Channels.ChatOverlayGetState, (_, _) =>
+            Task.FromResult<object?>(_chatOverlay.GetState()));
+        _dispatcher.Register(Channels.ChatOverlaySaveSettings, async (payload, ct) =>
+        {
+            var settings = Json.Deserialize<ChatOverlaySettings>(payload ?? default);
+            if (settings is null) return new { ok = false };
+            var ok = await _chatOverlay.SaveSettingsAsync(settings, ct).ConfigureAwait(false);
+            return new { ok };
+        });
         _dispatcher.Register(Channels.ChatOverlayGetUrl, (_, _) =>
-            Task.FromResult<object?>(new { url = _chatOverlayServer.OverlayUrl.ToString() }));
+            Task.FromResult<object?>(new { url = _chatOverlay.GetUrl() }));
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
@@ -396,33 +435,62 @@ public sealed class HostController : IDisposable
             if (results.Count == 1 && results[0].ShouldLogFailure)
             {
                 Log("system", $"TWITCH AVATAR LOOKUP FAILED · {username}");
             }
         }
         catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
         {
         }
     }
 
+    private async Task PublishChatOverlayMessageAsync(ChatMessage message)
+    {
+        try
+        {
+            await _chatOverlay.PublishChatMessageAsync(message, _shutdown).ConfigureAwait(false);
+        }
+        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
+        {
+        }
+        catch
+        {
+        }
+    }
+
+    private async Task SetChatOverlayConnectedAsync(bool connected)
+    {
+        try
+        {
+            await _chatOverlay.SetConnectedAsync(connected, _shutdown).ConfigureAwait(false);
+        }
+        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
+        {
+        }
+        catch
+        {
+        }
+    }
+
     private void WireTwitch()
     {
         _twitch.ChatMessageReceived += message =>
         {
             if (!AllowChatRelay()) return;
             var publishedMessage = message;
             if (!string.IsNullOrWhiteSpace(message.UserId) && _twitchUserProfiles.TryGet(message.UserId, out var avatarUrl))
             {
                 publishedMessage = message with { AvatarUrl = avatarUrl };
             }
 
             Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{publishedMessage.Username}: {publishedMessage.Message}");
             PostEvent(Events.TwitchChatMessage, publishedMessage);
+            _ = PublishChatOverlayMessageAsync(publishedMessage);
             if (!string.IsNullOrWhiteSpace(message.UserId) && !_twitchUserProfiles.TryGet(message.UserId, out _))
             {
                 _ = ResolveTwitchUserProfileAsync(message.UserId, message.Username);
             }
         };
         _twitch.Info += info =>
         {
             var message = info.Key switch
             {
                 "chat-joined" => CoreStrings.LF(Lang, "chat-joined", $"#{info.Arg}"),
@@ -437,20 +505,21 @@ public sealed class HostController : IDisposable
             Log("system", CoreStrings.L(Lang, "state-prefix") + CoreStrings.StateName(Lang, state));
             if (state == TwitchState.AuthFailed)
             {
                 _authRequired = true;
                 Log("system", CoreStrings.L(Lang, "auth-failed"));
             }
             else if (state == TwitchState.Connected)
             {
                 _authRequired = false;
             }
+            _ = SetChatOverlayConnectedAsync(state == TwitchState.Connected);
             EmitStatus();
         };
     }
 
     private void WireBotState()
     {
         _botTwitch.StateChanged += state =>
         {
             if (state == TwitchState.AuthFailed) Log("system", "BOT ACCOUNT AUTHENTICATION FAILED");
             EmitStatus();
diff --git a/core/Rpc/Envelope.cs b/core/Rpc/Envelope.cs
index 2468efb..25a9fc4 100644
--- a/core/Rpc/Envelope.cs
+++ b/core/Rpc/Envelope.cs
@@ -40,20 +40,22 @@ public static class Channels
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
+    public const string ChatOverlayGetState = "chat-overlay/get-state";
+    public const string ChatOverlaySaveSettings = "chat-overlay/save-settings";
     public const string ChatOverlayGetUrl = "chat-overlay/get-url";
     public const string OpenRouterGetState = "openrouter/get-state";
     public const string OpenRouterSave = "openrouter/save";
     public const string WindowBeginDrag = "window/begin-drag";
     public const string AutoRepliesGetState = "auto-replies/get-state";
     public const string AutoRepliesSettingsGet = "auto-replies/settings-get";
     public const string AutoRepliesSettingsSave = "auto-replies/settings-save";
     public const string AutoRepliesSave = "auto-replies/save";
     public const string AutoRepliesDelete = "auto-replies/delete";
     public const string TwitchSendChatMessage = "twitch/send-chat-message";
diff --git a/src/rpc/contracts.ts b/src/rpc/contracts.ts
index a1264b9..b8e5ef9 100644
--- a/src/rpc/contracts.ts
+++ b/src/rpc/contracts.ts
@@ -176,20 +176,23 @@ export const Channels = {
   CountersDelete: 'counters/delete',
   ObsWrite: 'obs/write',
   DialogSaveFile: 'dialog/save-file',
   LogAppend: 'log/append',
   TwitchAuthorize: 'twitch/authorize',
   TwitchForget: 'twitch/forget',
   TwitchBotAuthorize: 'twitch/bot-authorize',
   TwitchBotForget: 'twitch/bot-forget',
   SettingsGetState: 'settings/get-state',
   SettingsSave: 'settings/save',
+  ChatOverlayGetState: 'chat-overlay/get-state',
+  ChatOverlaySaveSettings: 'chat-overlay/save-settings',
+  ChatOverlayGetUrl: 'chat-overlay/get-url',
   OpenRouterGetState: 'openrouter/get-state',
   OpenRouterSave: 'openrouter/save',
   AutoRepliesGenerate: 'auto-replies/generate',
   WindowBeginDrag: 'window/begin-drag',
   AutoRepliesGetState: 'auto-replies/get-state',
   AutoRepliesSettingsGet: 'auto-replies/settings-get',
   AutoRepliesSettingsSave: 'auto-replies/settings-save',
   AutoRepliesSave: 'auto-replies/save',
   AutoRepliesDelete: 'auto-replies/delete',
   TwitchSendChatMessage: 'twitch/send-chat-message',
@@ -230,20 +233,23 @@ export interface HostApi {
   [Channels.LogAppend]: { request: LogPayload; response: { ok: boolean } };
   [Channels.TwitchAuthorize]: { request: undefined; response: { ok: boolean } };
   [Channels.TwitchForget]: { request: undefined; response: { ok: boolean } };
   [Channels.TwitchBotAuthorize]: { request: undefined; response: { ok: boolean } };
   [Channels.TwitchBotForget]: { request: undefined; response: { ok: boolean } };
   [Channels.SettingsGetState]: { request: undefined; response: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean } };
   [Channels.SettingsSave]: {
     request: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean };
     response: { ok: boolean };
   };
+  [Channels.ChatOverlayGetState]: { request: undefined; response: ChatOverlaySettings };
+  [Channels.ChatOverlaySaveSettings]: { request: ChatOverlaySettings; response: { ok: boolean } };
+  [Channels.ChatOverlayGetUrl]: { request: undefined; response: { url: string } };
   [Channels.OpenRouterGetState]: { request: undefined; response: OpenRouterSettingsState };
   [Channels.OpenRouterSave]: { request: { provider: 'openrouter' | 'groq'; apiKey: string | null }; response: { ok: boolean; configured: boolean } };
   [Channels.WindowBeginDrag]: { request: undefined; response: { ok: boolean } };
   [Channels.AutoRepliesGetState]: { request: undefined; response: AutoReply[] };
   [Channels.AutoRepliesSettingsGet]: { request: undefined; response: AutoReplySettings };
   [Channels.AutoRepliesSettingsSave]: { request: AutoReplySettings; response: { ok: boolean } };
   [Channels.AutoRepliesSave]: { request: { rule: AutoReply }; response: { ok: boolean } };
   [Channels.AutoRepliesDelete]: { request: { ruleId: string }; response: { ok: boolean } };
   [Channels.AutoRepliesGenerate]: { request: { ruleId: string; message: ChatMessage; send?: boolean }; response: { ok: boolean; message?: string; usedFallback?: boolean; error?: string } };
   [Channels.TwitchSendChatMessage]: { request: { message: string }; response: { ok: boolean; error?: string } };
diff --git a/src/rpc/mockHost.test.mjs b/src/rpc/mockHost.test.mjs
new file mode 100644
index 0000000..150bf25
--- /dev/null
+++ b/src/rpc/mockHost.test.mjs
@@ -0,0 +1,209 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import test, { afterEach } from 'node:test';
+import { pathToFileURL } from 'node:url';
+
+class MemoryStorage {
+  #store = new Map();
+
+  clear() {
+    this.#store.clear();
+  }
+
+  getItem(key) {
+    return this.#store.has(key) ? this.#store.get(key) : null;
+  }
+
+  removeItem(key) {
+    this.#store.delete(key);
+  }
+
+  setItem(key, value) {
+    this.#store.set(key, String(value));
+  }
+}
+
+const storage = new MemoryStorage();
+const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
+const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
+const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamer-hub-rpc-'));
+
+if (!globalThis.window) {
+  globalThis.window = globalThis;
+}
+
+globalThis.localStorage = storage;
+window.localStorage = storage;
+window.setTimeout = (callback, delay, ...args) => {
+  const timer = nativeSetTimeout(callback, delay, ...args);
+  timer.unref?.();
+  return timer;
+};
+window.clearTimeout = nativeClearTimeout;
+globalThis.structuredClone ??= (value) => JSON.parse(JSON.stringify(value));
+
+process.on('exit', () => {
+  fs.rmSync(tempRoot, { recursive: true, force: true });
+});
+
+afterEach(() => {
+  storage.clear();
+});
+
+async function loadHarness() {
+  const contractsSource = fs.readFileSync(new URL('./contracts.ts', import.meta.url), 'utf8');
+  const mockHostSource = fs.readFileSync(new URL('./mockHost.ts', import.meta.url), 'utf8');
+  const contractsPath = path.join(tempRoot, 'contracts.testable.ts');
+  const mockHostPath = path.join(tempRoot, 'mockHost.testable.ts');
+
+  fs.writeFileSync(contractsPath, contractsSource, 'utf8');
+  fs.writeFileSync(
+    mockHostPath,
+    mockHostSource
+      .split("import type { Transport } from './transport';\n").join('')
+      .split("import type { Transport } from './transport';\r\n").join('')
+      .split("from './contracts';").join("from './contracts.testable.ts';")
+      .replace(/\nexport class MockTransport[\s\S]*$/, '\n'),
+    'utf8',
+  );
+
+  const [{ Channels, Events, PROTOCOL_VERSION }, { MockHost }] = await Promise.all([
+    import(pathToFileURL(contractsPath).href),
+    import(pathToFileURL(mockHostPath).href),
+  ]);
+
+  return { Channels, Events, PROTOCOL_VERSION, MockHost };
+}
+
+function waitForEvent(host, channel, timeoutMs = 1200) {
+  return new Promise((resolve, reject) => {
+    let off = () => {};
+    const timer = nativeSetTimeout(() => {
+      off();
+      reject(new Error('TIMED OUT WAITING FOR EVENT ' + channel));
+    }, timeoutMs);
+    off = host.onMessage((message) => {
+      if (message.kind !== 'event' || message.channel !== channel) return;
+      nativeClearTimeout(timer);
+      off();
+      resolve(message.payload);
+    });
+  });
+}
+
+function invoke(host, protocolVersion, channel, payload) {
+  const id = 'req-' + Math.random().toString(16).slice(2);
+  return new Promise((resolve, reject) => {
+    let off = () => {};
+    const timer = nativeSetTimeout(() => {
+      off();
+      reject(new Error('TIMED OUT WAITING FOR RESPONSE ' + String(channel)));
+    }, 1500);
+    off = host.onMessage((message) => {
+      if (message.kind !== 'response' || message.id !== id) return;
+      nativeClearTimeout(timer);
+      off();
+      if (message.error) reject(new Error(message.error));
+      else resolve(message.payload);
+    });
+    host.handleEnvelope({
+      v: protocolVersion,
+      id,
+      kind: 'request',
+      channel,
+      payload,
+    });
+  });
+}
+
+test('hydrates saved chat overlay settings through rpc', async () => {
+  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
+  assert.equal(typeof Channels.ChatOverlayGetState, 'string');
+
+  localStorage.setItem('streamer-hub-mock-chat-overlay-settings', JSON.stringify({
+    enabled: true,
+    maxMessages: 6,
+    durationSeconds: 45,
+    displayMode: 'latest',
+    fontSize: 18,
+    avatarSize: 28,
+    spacing: 10,
+    showUsernames: false,
+    showAvatars: true,
+    theme: 'transparent',
+    messageStyle: 'square',
+    animation: 'fade',
+  }));
+
+  const host = new MockHost();
+  const state = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);
+
+  assert.deepEqual(state, {
+    enabled: true,
+    maxMessages: 6,
+    durationSeconds: 45,
+    displayMode: 'latest',
+    fontSize: 18,
+    avatarSize: 28,
+    spacing: 10,
+    showUsernames: false,
+    showAvatars: true,
+    theme: 'transparent',
+    messageStyle: 'square',
+    animation: 'fade',
+  });
+});
+
+test('saves chat overlay settings and returns the updated state', async () => {
+  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
+  assert.equal(typeof Channels.ChatOverlaySaveSettings, 'string');
+
+  const host = new MockHost();
+  const next = {
+    enabled: true,
+    maxMessages: 5,
+    durationSeconds: 30,
+    displayMode: 'stacked',
+    fontSize: 20,
+    avatarSize: 24,
+    spacing: 8,
+    showUsernames: true,
+    showAvatars: false,
+    theme: 'light',
+    messageStyle: 'rounded',
+    animation: 'off',
+  };
+
+  const result = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlaySaveSettings, next);
+  const stored = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);
+
+  assert.deepEqual(result, { ok: true });
+  assert.deepEqual(stored, next);
+  assert.deepEqual(JSON.parse(localStorage.getItem('streamer-hub-mock-chat-overlay-settings')), next);
+});
+
+test('returns a loopback overlay url for OBS/browser mode', async () => {
+  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
+  assert.equal(typeof Channels.ChatOverlayGetUrl, 'string');
+
+  const host = new MockHost();
+  const result = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetUrl, undefined);
+
+  assert.equal(result.url, 'http://127.0.0.1:49178/chat-overlay.html');
+});
+
+test('keeps forwarding existing status and chat events in mock mode', async () => {
+  const { Events, MockHost } = await loadHarness();
+  const host = new MockHost();
+
+  const statusPromise = waitForEvent(host, Events.CoreStatusChanged);
+  const chatPromise = waitForEvent(host, Events.TwitchChatMessage);
+  host.simulateChat({ username: 'viewer', message: '!death' });
+
+  const [status, chat] = await Promise.all([statusPromise, chatPromise]);
+  assert.equal(status.coreConnected, true);
+  assert.equal(chat.username, 'viewer');
+  assert.equal(chat.message, '!death');
+});
diff --git a/src/rpc/mockHost.ts b/src/rpc/mockHost.ts
index 8716966..fc37853 100644
--- a/src/rpc/mockHost.ts
+++ b/src/rpc/mockHost.ts
@@ -1,19 +1,35 @@
-import type { AutoReply, AutoReplySettings, ConnectionStatus, Counter, RpcEnvelope, TwitchSettings } from './contracts';
-import { Events, PROTOCOL_VERSION } from './contracts';
+import type { AutoReply, AutoReplySettings, ChatOverlaySettings, ConnectionStatus, Counter, RpcEnvelope, TwitchSettings } from './contracts';
+import { Channels, Events, PROTOCOL_VERSION } from './contracts';
 import type { Transport } from './transport';
 
 const STORAGE_KEY = 'streamer-hub-mock-counters';
 const LEGACY_STORAGE_KEY = 'streamer-hub-mock-state';
 const TWITCH_STORAGE_KEY = 'streamer-hub-mock-settings';
 const AUTO_REPLY_STORAGE_KEY = 'streamer-hub-mock-auto-replies';
 const AUTO_REPLY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-auto-reply-settings';
+const CHAT_OVERLAY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-chat-overlay-settings';
+const CHAT_OVERLAY_URL = 'http://127.0.0.1:49178/chat-overlay.html';
+const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = {
+  enabled: false,
+  maxMessages: 8,
+  durationSeconds: 20,
+  displayMode: 'stacked',
+  fontSize: 24,
+  avatarSize: 32,
+  spacing: 12,
+  showUsernames: true,
+  showAvatars: true,
+  theme: 'dark',
+  messageStyle: 'rounded',
+  animation: 'slide',
+};
 
 interface MockSettings {
   clientId: string;
   clientSecret: string;
   language: string;
 }
 
 function migrateLegacyCounters(): Counter[] | null {
   try {
     const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
@@ -42,29 +58,31 @@ function migrateLegacyCounters(): Counter[] | null {
     ];
   } catch {
     return null;
   }
 }
 
 export class MockHost {
   private counters: Counter[];
   private autoReplies: AutoReply[];
   private autoReplySettings: AutoReplySettings;
+  private chatOverlaySettings: ChatOverlaySettings;
   private readonly listeners = new Set<(message: RpcEnvelope) => void>();
   private isMaximized = false;
   private twitchConnected = false;
   private readonly timers: number[] = [];
 
   constructor() {
     this.counters = this.loadCounters();
     this.autoReplies = this.loadAutoReplies();
     this.autoReplySettings = this.loadAutoReplySettings();
+    this.chatOverlaySettings = this.loadChatOverlaySettings();
     this.schedule(() => this.emitStatus(), 350);
     this.schedule(() => {
       this.twitchConnected = true;
       this.emitStatus();
     }, 1400);
     this.schedule(() => this.twitchBlip(), 90000);
   }
 
   simulateChat(message: { username: string; message: string }): void {
     this.emitEvent(Events.TwitchChatMessage, {
@@ -218,20 +236,31 @@ export class MockHost {
               language: payload.language ?? current.language,
             };
             localStorage.setItem(TWITCH_STORAGE_KEY, JSON.stringify(next));
           } catch {
             void 0;
           }
         }
         this.respond(request, { ok: true });
         break;
       }
+      case Channels.ChatOverlayGetState:
+        this.respond(request, structuredClone(this.chatOverlaySettings));
+        break;
+      case Channels.ChatOverlaySaveSettings:
+        this.chatOverlaySettings = request.payload as ChatOverlaySettings;
+        localStorage.setItem(CHAT_OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify(this.chatOverlaySettings));
+        this.respond(request, { ok: true });
+        break;
+      case Channels.ChatOverlayGetUrl:
+        this.respond(request, { url: CHAT_OVERLAY_URL });
+        break;
       case 'openrouter/get-state':
         this.respond(request, { configured: false, groqConfigured: false });
         break;
       case 'openrouter/save': {
         const payload = request.payload as { apiKey?: string | null };
         this.respond(request, { ok: true, configured: Boolean(payload?.apiKey?.trim()) });
         break;
       }
       case 'log/append':
         this.respond(request, { ok: true });
@@ -259,20 +288,30 @@ export class MockHost {
   private status(): ConnectionStatus {
     return {
       coreConnected: true,
       coreVersion: '1.0.0-mock',
       twitchConnected: this.twitchConnected,
       twitchChannel: this.twitchConnected ? 'mock_channel' : '',
       authRequired: false,
     };
   }
 
+  private loadChatOverlaySettings(): ChatOverlaySettings {
+    try {
+      const raw = localStorage.getItem(CHAT_OVERLAY_SETTINGS_STORAGE_KEY);
+      if (raw) return { ...DEFAULT_CHAT_OVERLAY_SETTINGS, ...JSON.parse(raw) } as ChatOverlaySettings;
+    } catch {
+      void 0;
+    }
+    return { ...DEFAULT_CHAT_OVERLAY_SETTINGS };
+  }
+
   private loadAutoReplies(): AutoReply[] {
     try {
       const raw = localStorage.getItem(AUTO_REPLY_STORAGE_KEY);
       return raw ? (JSON.parse(raw) as AutoReply[]) : [];
     } catch {
       return [];
     }
   }
 
   private persistAutoReplies(): void {
diff --git a/tests/StreamerHub.Task4Tests/Program.cs b/tests/StreamerHub.Task4Tests/Program.cs
new file mode 100644
index 0000000..21b3692
--- /dev/null
+++ b/tests/StreamerHub.Task4Tests/Program.cs
@@ -0,0 +1,117 @@
+using System.Net.WebSockets;
+using System.Text;
+using System.Text.Json;
+using StreamerHub.Core.Host;
+using StreamerHub.Core.Overlay;
+using StreamerHub.Core.Rpc;
+using StreamerHub.Core.Storage;
+
+var root = Path.Combine(Path.GetTempPath(), $"streamer-hub-task4-{Guid.NewGuid():N}");
+Directory.CreateDirectory(root);
+try
+{
+    using var settings = new SettingsStore(Path.Combine(root, "settings.json"));
+    await using var server = new ChatOverlayServer(root, settings.ChatOverlay, preferredPort: 0);
+    await server.StartAsync();
+    var bridge = new ChatOverlayHostBridge(settings, server);
+
+    AssertEqual(settings.ChatOverlay, bridge.GetState(), "initial overlay state");
+    AssertEqual(server.OverlayUrl.ToString(), bridge.GetUrl(), "overlay URL");
+
+    using var socket = new ClientWebSocket();
+    await socket.ConnectAsync(server.WebSocketUrl, CancellationToken.None);
+    await ReceiveAsync(socket);
+    await ReceiveAsync(socket);
+    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "safe initial disconnected state");
+
+    var requested = new ChatOverlaySettings
+    {
+        Enabled = true,
+        MaxMessages = 99,
+        DurationSeconds = 1,
+        DisplayMode = "latest",
+        FontSize = 18,
+        AvatarSize = 28,
+        Spacing = 10,
+        ShowUsernames = false,
+        ShowAvatars = true,
+        Theme = "transparent",
+        MessageStyle = "square",
+        Animation = "fade",
+    };
+    AssertTrue(await bridge.SaveSettingsAsync(requested), "settings save result");
+    AssertEqual(12, bridge.GetState().MaxMessages, "normalized maximum messages");
+    AssertEqual(5, bridge.GetState().DurationSeconds, "normalized duration");
+    using (var settingsEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
+    {
+        AssertEqual("settings", settingsEvent.RootElement.GetProperty("kind").GetString(), "settings event kind");
+        AssertEqual(12, settingsEvent.RootElement.GetProperty("payload").GetProperty("maxMessages").GetInt32(), "broadcast normalized maximum");
+    }
+
+    await bridge.SetConnectedAsync(true);
+    AssertEqual("connected", Kind(await ReceiveAsync(socket)), "connected transition");
+
+    var message = new ChatMessage
+    {
+        Id = "task4-message",
+        Username = "viewer",
+        UserId = "100",
+        AvatarUrl = "https://cdn.example/avatar.png",
+        IsMod = true,
+        Message = "hello overlay",
+        Timestamp = "2026-08-27T12:00:00Z",
+    };
+    AssertTrue(await bridge.PublishChatMessageAsync(message), "chat publish result");
+    using (var chatEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
+    {
+        var payload = chatEvent.RootElement.GetProperty("payload");
+        AssertEqual("chat-message", chatEvent.RootElement.GetProperty("kind").GetString(), "chat event kind");
+        AssertEqual("task4-message", payload.GetProperty("id").GetString(), "chat message ID");
+        AssertEqual("viewer", payload.GetProperty("username").GetString(), "chat username");
+        AssertEqual("100", payload.GetProperty("userId").GetString(), "chat user ID");
+        AssertEqual("https://cdn.example/avatar.png", payload.GetProperty("avatarUrl").GetString(), "chat avatar");
+        AssertTrue(payload.GetProperty("isMod").GetBoolean(), "chat role");
+        AssertEqual("hello overlay", payload.GetProperty("message").GetString(), "chat text");
+    }
+
+    await bridge.SetConnectedAsync(false);
+    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "disconnected transition");
+    Console.WriteLine("All Task 4 native host bridge tests passed.");
+}
+finally
+{
+    try { Directory.Delete(root, recursive: true); } catch { }
+}
+
+static async Task<string> ReceiveAsync(ClientWebSocket socket)
+{
+    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
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
+static string Kind(string json)
+{
+    using var document = JsonDocument.Parse(json);
+    return document.RootElement.GetProperty("kind").GetString() ?? string.Empty;
+}
+
+static void AssertTrue(bool value, string label)
+{
+    if (!value) throw new InvalidOperationException($"{label}: expected true");
+}
+
+static void AssertEqual<T>(T expected, T actual, string label)
+{
+    if (!EqualityComparer<T>.Default.Equals(expected, actual))
+        throw new InvalidOperationException($"{label}: expected {expected}, got {actual}");
+}
\ No newline at end of file
diff --git a/tests/StreamerHub.Task4Tests/StreamerHub.Task4Tests.csproj b/tests/StreamerHub.Task4Tests/StreamerHub.Task4Tests.csproj
new file mode 100644
index 0000000..51dc087
--- /dev/null
+++ b/tests/StreamerHub.Task4Tests/StreamerHub.Task4Tests.csproj
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
\ No newline at end of file
