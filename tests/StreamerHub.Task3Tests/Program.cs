using System.Net;
using System.Net.Sockets;
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
await RunAsync("overlay_bootstrap_installs_offline_recovery", OverlayBootstrapInstallsOfflineRecoveryAsync);
await RunAsync("static_routes_only_serve_overlay_manifest_assets", StaticRoutesOnlyServeOverlayManifestAssetsAsync);
await RunAsync("existing_obs_url_recovers_after_server_restart", ExistingObsUrlRecoversAfterServerRestartAsync);

if (failures.Count > 0)
{
    Console.Error.WriteLine($"{failures.Count} test(s) failed:");
    foreach (var failure in failures) Console.Error.WriteLine($"- {failure}");
    Environment.ExitCode = 1;
}
else
{
    Console.WriteLine("All Task 3 overlay server tests passed.");
}

async Task ProtocolMessagesAreVersionedAndIdentifiedAsync()
{
    using var hello = JsonDocument.Parse(ChatOverlayProtocol.Hello(new ChatOverlaySettings(), connected: false));
    AssertEnvelope(hello.RootElement, "hello");
    AssertEqual(false, hello.RootElement.GetProperty("payload").GetProperty("connected").GetBoolean(), "hello connection state");

    var message = SampleMessage("message-1");
    using var chat = JsonDocument.Parse(ChatOverlayProtocol.ChatMessage(message));
    AssertEnvelope(chat.RootElement, "chat-message");
    AssertEqual("message-1", chat.RootElement.GetProperty("payload").GetProperty("id").GetString(), "chat payload ID");
    await Task.CompletedTask;
}

async Task HttpBootstrapIsLoopbackOnlyAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    AssertEqual("127.0.0.1", fixture.Server.OverlayUrl.Host, "overlay host");
    AssertTrue(fixture.Server.Port > 0, "available local port");

    using var response = await fixture.Http.GetAsync(fixture.Server.OverlayUrl);
    AssertEqual(HttpStatusCode.OK, response.StatusCode, "overlay HTTP status");
    AssertContains(await response.Content.ReadAsStringAsync(), "overlay-bootstrap", "overlay bootstrap body");

    using var missing = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/not-found"));
    AssertEqual(HttpStatusCode.NotFound, missing.StatusCode, "unsupported path");

    using var post = await fixture.Http.PostAsync(fixture.Server.OverlayUrl, new StringContent("ignored"));
    AssertEqual(HttpStatusCode.MethodNotAllowed, post.StatusCode, "unsupported method");
}

async Task WebSocketConnectReceivesCurrentStateAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using var socket = await fixture.ConnectAsync();

    AssertEqual("hello", Kind(await ReceiveAsync(socket)), "first websocket message");
    AssertEqual("settings", Kind(await ReceiveAsync(socket)), "settings bootstrap");
    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "connection bootstrap");
}

async Task BroadcastsChatSettingsAndConnectionChangesAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using var socket = await fixture.ConnectAsync();
    await DrainBootstrapAsync(socket);

    var settings = new ChatOverlaySettings { Enabled = true, MaxMessages = 4, Theme = "transparent" };
    await fixture.Server.UpdateSettingsAsync(settings);
    using var settingsEnvelope = JsonDocument.Parse(await ReceiveAsync(socket));
    AssertEqual("settings", KindDocument(settingsEnvelope), "settings event");
    AssertEqual(4, settingsEnvelope.RootElement.GetProperty("payload").GetProperty("maxMessages").GetInt32(), "updated maximum");

    await fixture.Server.SetConnectedAsync(true);
    AssertEqual("connected", Kind(await ReceiveAsync(socket)), "connected event");

    await fixture.Server.PublishChatMessageAsync(SampleMessage("message-2"));
    using var chatEnvelope = JsonDocument.Parse(await ReceiveAsync(socket));
    AssertEqual("chat-message", KindDocument(chatEnvelope), "chat event");
    AssertEqual("viewer", chatEnvelope.RootElement.GetProperty("payload").GetProperty("username").GetString(), "chat username");

    await fixture.Server.SetConnectedAsync(false);
    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "disconnected event");
}

async Task ReconnectGetsStateWithoutReplayingMessagesAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using (var first = await fixture.ConnectAsync())
    {
        await DrainBootstrapAsync(first);
        await fixture.Server.PublishChatMessageAsync(SampleMessage("message-3"));
        AssertEqual("chat-message", Kind(await ReceiveAsync(first)), "first connection chat event");
        await first.CloseAsync(WebSocketCloseStatus.NormalClosure, "test reconnect", CancellationToken.None);
    }

    using var second = await fixture.ConnectAsync();
    await DrainBootstrapAsync(second);
    await fixture.Server.PublishChatMessageAsync(SampleMessage("message-4"));
    using var envelope = JsonDocument.Parse(await ReceiveAsync(second));
    AssertEqual("chat-message", KindDocument(envelope), "new message after reconnect");
    AssertEqual("message-4", envelope.RootElement.GetProperty("payload").GetProperty("id").GetString(), "old messages are not replayed");
}

async Task DuplicateChatMessageIdsAreSuppressedAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using var socket = await fixture.ConnectAsync();
    await DrainBootstrapAsync(socket);

    var message = SampleMessage("duplicate-id");
    AssertTrue(await fixture.Server.PublishChatMessageAsync(message), "first message accepted");
    AssertFalse(await fixture.Server.PublishChatMessageAsync(message), "duplicate message rejected");
    AssertEqual("chat-message", Kind(await ReceiveAsync(socket)), "first message delivered");
    await AssertNoMessageAsync(socket, "duplicate must not be delivered");
}

async Task ServerStopsAcceptingRequestsAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    var url = fixture.Server.OverlayUrl;
    await fixture.Server.StopAsync();
    AssertEqual(0, fixture.Server.Port, "stopped server port");
    try
    {
        using var timeout = new CancellationTokenSource(1000);
        _ = await fixture.Http.GetAsync(url, timeout.Token);
        throw new InvalidOperationException("stopped server still accepted an HTTP request");
    }
    catch (HttpRequestException)
    {
    }
    catch (OperationCanceledException)
    {
    }
}

async Task OverlayBootstrapInstallsOfflineRecoveryAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using var overlay = await fixture.Http.GetAsync(fixture.Server.OverlayUrl);
    var overlayHtml = await overlay.Content.ReadAsStringAsync();
    AssertContains(overlayHtml, "navigator.serviceWorker.register('/chat-overlay-sw.js')", "service worker registration");

    using var worker = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/chat-overlay-sw.js"));
    AssertEqual(HttpStatusCode.OK, worker.StatusCode, "recovery service worker status");
    var workerScript = await worker.Content.ReadAsStringAsync();
    AssertContains(workerScript, "Streamer Hub is not running", "offline recovery message");
    AssertContains(workerScript, "/chat-overlay-health", "recovery health probe");
    AssertContains(workerScript, "event.request.mode === 'navigate'", "navigation fallback");

    using var health = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/chat-overlay-health"));
    AssertEqual(HttpStatusCode.NoContent, health.StatusCode, "recovery health status");
}

async Task StaticRoutesOnlyServeOverlayManifestAssetsAsync()
{
    await using var fixture = await ServerFixture.StartAsync();
    using var requiredAsset = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/assets/chatOverlay-required.js"));
    AssertEqual(HttpStatusCode.OK, requiredAsset.StatusCode, "required overlay asset");

    using var appIndex = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/index.html"));
    AssertEqual(HttpStatusCode.NotFound, appIndex.StatusCode, "main app index must not be exposed");

    using var unrelatedAsset = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/assets/unrelated.js"));
    AssertEqual(HttpStatusCode.NotFound, unrelatedAsset.StatusCode, "unrelated asset must not be exposed");

    using var manifest = await fixture.Http.GetAsync(new Uri(fixture.Server.OverlayUrl, "/.vite/manifest.json"));
    AssertEqual(HttpStatusCode.NotFound, manifest.StatusCode, "build manifest must not be exposed");
}

async Task ExistingObsUrlRecoversAfterServerRestartAsync()
{
    var preferredPort = FindAvailableTestPort();
    await using var fixture = await ServerFixture.StartAsync(preferredPort);
    var originalUrl = fixture.Server.OverlayUrl;
    AssertEqual(preferredPort, fixture.Server.Port, "preferred loopback port");
    await fixture.Server.StopAsync();

    await using var restarted = new ChatOverlayServer(
        fixture.AssetRoot,
        new ChatOverlaySettings(),
        preferredPort: preferredPort);
    await restarted.StartAsync();
    AssertEqual(originalUrl, restarted.OverlayUrl, "OBS overlay URL after app restart");

    using var recoveredOverlay = await fixture.Http.GetAsync(originalUrl);
    AssertEqual(HttpStatusCode.OK, recoveredOverlay.StatusCode, "existing OBS URL after app restart");
    AssertContains(
        await recoveredOverlay.Content.ReadAsStringAsync(),
        "overlay-bootstrap",
        "overlay content after app restart");
}

static int FindAvailableTestPort()
{
    using var listener = new TcpListener(IPAddress.Loopback, 0);
    listener.Start();
    return ((IPEndPoint)listener.LocalEndpoint).Port;
}

static ChatMessage SampleMessage(string id) => new()
{
    Id = id,
    Username = "viewer",
    UserId = "100",
    AvatarUrl = "https://cdn.example/avatar.png",
    Message = "hello chat",
    Timestamp = "2026-08-27T12:00:00Z",
};

static async Task DrainBootstrapAsync(ClientWebSocket socket)
{
    AssertEqual("hello", Kind(await ReceiveAsync(socket)), "bootstrap hello");
    AssertEqual("settings", Kind(await ReceiveAsync(socket)), "bootstrap settings");
    var state = Kind(await ReceiveAsync(socket));
    AssertTrue(state is "connected" or "disconnected", "bootstrap connection state");
}

static async Task<string> ReceiveAsync(ClientWebSocket socket, int timeoutMilliseconds = 3000)
{
    using var timeout = new CancellationTokenSource(timeoutMilliseconds);
    var buffer = new byte[16 * 1024];
    using var stream = new MemoryStream();
    WebSocketReceiveResult result;
    do
    {
        result = await socket.ReceiveAsync(buffer, timeout.Token);
        if (result.MessageType == WebSocketMessageType.Close)
            throw new InvalidOperationException("websocket closed before receiving a message");
        stream.Write(buffer, 0, result.Count);
    } while (!result.EndOfMessage);
    return Encoding.UTF8.GetString(stream.ToArray());
}

static async Task AssertNoMessageAsync(ClientWebSocket socket, string label)
{
    try
    {
        _ = await ReceiveAsync(socket, 250);
        throw new InvalidOperationException($"{label}: unexpected websocket message");
    }
    catch (OperationCanceledException)
    {
    }
}

static string Kind(string json)
{
    using var document = JsonDocument.Parse(json);
    return KindDocument(document);
}

static string KindDocument(JsonDocument document) => document.RootElement.GetProperty("kind").GetString() ?? string.Empty;

static void AssertEnvelope(JsonElement element, string expectedKind)
{
    AssertEqual(1, element.GetProperty("v").GetInt32(), $"{expectedKind} protocol version");
    AssertEqual(expectedKind, element.GetProperty("kind").GetString(), $"{expectedKind} kind");
    AssertTrue(!string.IsNullOrWhiteSpace(element.GetProperty("id").GetString()), $"{expectedKind} message ID");
}

async Task RunAsync(string name, Func<Task> test)
{
    try
    {
        await test();
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception ex)
    {
        failures.Add($"{name}: {ex.Message}");
        Console.Error.WriteLine($"FAIL {name}: {ex}");
    }
}

static void AssertContains(string value, string expected, string label)
{
    if (!value.Contains(expected, StringComparison.Ordinal))
        throw new InvalidOperationException($"{label}: expected '{expected}'");
}

static void AssertEqual<T>(T expected, T actual, string label)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new InvalidOperationException($"{label}: expected '{expected}' but got '{actual}'");
}

static void AssertTrue(bool value, string label)
{
    if (!value) throw new InvalidOperationException($"{label}: expected true");
}

static void AssertFalse(bool value, string label)
{
    if (value) throw new InvalidOperationException($"{label}: expected false");
}

sealed class ServerFixture : IAsyncDisposable
{
    private readonly string _assetRoot;

    private ServerFixture(string assetRoot, ChatOverlayServer server)
    {
        _assetRoot = assetRoot;
        Server = server;
        Http = new HttpClient();
    }

    public ChatOverlayServer Server { get; }
    public HttpClient Http { get; }
    public string AssetRoot => _assetRoot;

    public static async Task<ServerFixture> StartAsync(int? preferredPort = null)
    {
        var assetRoot = Path.Combine(Path.GetTempPath(), $"streamer-hub-overlay-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(assetRoot);
        Directory.CreateDirectory(Path.Combine(assetRoot, "assets"));
        Directory.CreateDirectory(Path.Combine(assetRoot, ".vite"));
        await File.WriteAllTextAsync(Path.Combine(assetRoot, "chat-overlay.html"), "<!doctype html><div id=\"overlay-bootstrap\">overlay-bootstrap</div>");
        await File.WriteAllTextAsync(Path.Combine(assetRoot, "index.html"), "<!doctype html><div>main app</div>");
        await File.WriteAllTextAsync(Path.Combine(assetRoot, "assets", "chatOverlay-required.js"), "export const overlay = true;");
        await File.WriteAllTextAsync(Path.Combine(assetRoot, "assets", "unrelated.js"), "export const unrelated = true;");
        await File.WriteAllTextAsync(
            Path.Combine(assetRoot, ".vite", "manifest.json"),
            """
            {
              "src/chat-overlay.html": {
                "file": "assets/chatOverlay-required.js",
                "name": "chatOverlay",
                "src": "src/chat-overlay.html",
                "isEntry": true
              },
              "index.html": {
                "file": "assets/unrelated.js",
                "name": "app",
                "src": "index.html",
                "isEntry": true
              }
            }
            """);
        var server = preferredPort.HasValue
            ? new ChatOverlayServer(assetRoot, new ChatOverlaySettings(), preferredPort: preferredPort.Value)
            : new ChatOverlayServer(assetRoot, new ChatOverlaySettings());
        await server.StartAsync();
        return new ServerFixture(assetRoot, server);
    }

    public async Task<ClientWebSocket> ConnectAsync()
    {
        var socket = new ClientWebSocket();
        await socket.ConnectAsync(Server.WebSocketUrl, CancellationToken.None);
        return socket;
    }

    public async ValueTask DisposeAsync()
    {
        Http.Dispose();
        await Server.DisposeAsync();
        Directory.Delete(_assetRoot, recursive: true);
    }
}
