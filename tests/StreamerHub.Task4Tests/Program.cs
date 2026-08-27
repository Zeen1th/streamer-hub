using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Host;
using StreamerHub.Core.Overlay;
using StreamerHub.Core.Rpc;
using StreamerHub.Core.Storage;

var root = Path.Combine(Path.GetTempPath(), $"streamer-hub-task4-{Guid.NewGuid():N}");
Directory.CreateDirectory(root);
try
{
    using var settings = new SettingsStore(Path.Combine(root, "settings.json"));
    await using var server = new ChatOverlayServer(root, settings.ChatOverlay, preferredPort: 0);
    await server.StartAsync();
    var bridge = new ChatOverlayHostBridge(settings, server);

    AssertEqual(settings.ChatOverlay, bridge.GetState(), "initial overlay state");
    AssertEqual(server.OverlayUrl.ToString(), bridge.GetUrl(), "overlay URL");

    using var socket = new ClientWebSocket();
    await socket.ConnectAsync(server.WebSocketUrl, CancellationToken.None);
    await ReceiveAsync(socket);
    await ReceiveAsync(socket);
    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "safe initial disconnected state");

    var requested = new ChatOverlaySettings
    {
        Enabled = true,
        MaxMessages = 99,
        DurationSeconds = 1,
        DisplayMode = "latest",
        FontSize = 18,
        AvatarSize = 28,
        Spacing = 10,
        ShowUsernames = false,
        ShowAvatars = true,
        Theme = "transparent",
        MessageStyle = "square",
        Animation = "fade",
    };
    AssertTrue(await bridge.SaveSettingsAsync(requested), "settings save result");
    AssertEqual(12, bridge.GetState().MaxMessages, "normalized maximum messages");
    AssertEqual(5, bridge.GetState().DurationSeconds, "normalized duration");
    using (var settingsEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        AssertEqual("settings", settingsEvent.RootElement.GetProperty("kind").GetString(), "settings event kind");
        AssertEqual(12, settingsEvent.RootElement.GetProperty("payload").GetProperty("maxMessages").GetInt32(), "broadcast normalized maximum");
    }

    await bridge.SetConnectedAsync(true);
    AssertEqual("connected", Kind(await ReceiveAsync(socket)), "connected transition");

    var message = new ChatMessage
    {
        Id = "task4-message",
        Username = "viewer",
        UserId = "100",
        AvatarUrl = "https://cdn.example/avatar.png",
        IsMod = true,
        Message = "hello overlay",
        Timestamp = "2026-08-27T12:00:00Z",
    };
    AssertTrue(await bridge.PublishChatMessageAsync(message), "chat publish result");
    using (var chatEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        var payload = chatEvent.RootElement.GetProperty("payload");
        AssertEqual("chat-message", chatEvent.RootElement.GetProperty("kind").GetString(), "chat event kind");
        AssertEqual("task4-message", payload.GetProperty("id").GetString(), "chat message ID");
        AssertEqual("viewer", payload.GetProperty("username").GetString(), "chat username");
        AssertEqual("100", payload.GetProperty("userId").GetString(), "chat user ID");
        AssertEqual("https://cdn.example/avatar.png", payload.GetProperty("avatarUrl").GetString(), "chat avatar");
        AssertTrue(payload.GetProperty("isMod").GetBoolean(), "chat role");
        AssertEqual("hello overlay", payload.GetProperty("message").GetString(), "chat text");
    }

    await bridge.SetConnectedAsync(false);
    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "disconnected transition");
    Console.WriteLine("All Task 4 native host bridge tests passed.");
}
finally
{
    try { Directory.Delete(root, recursive: true); } catch { }
}

static async Task<string> ReceiveAsync(ClientWebSocket socket)
{
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
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

static string Kind(string json)
{
    using var document = JsonDocument.Parse(json);
    return document.RootElement.GetProperty("kind").GetString() ?? string.Empty;
}

static void AssertTrue(bool value, string label)
{
    if (!value) throw new InvalidOperationException($"{label}: expected true");
}

static void AssertEqual<T>(T expected, T actual, string label)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new InvalidOperationException($"{label}: expected {expected}, got {actual}");
}