using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Host;
using StreamerHub.Core.Overlay;
using StreamerHub.Core.Rpc;
using StreamerHub.Core.Storage;
using StreamerHub.Core.Twitch;

using (var release = JsonDocument.Parse("""
{
  "assets": [
    { "name": "StreamerHub-v0.2.3-win-x64.zip", "browser_download_url": "https://github.com/Zeen1th/streamer-hub/releases/download/v0.2.3/StreamerHub-v0.2.3-win-x64.zip" },
    { "name": "StreamerHub-Setup-v0.2.3.exe", "browser_download_url": "https://github.com/Zeen1th/streamer-hub/releases/download/v0.2.3/StreamerHub-Setup-v0.2.3.exe" }
  ]
}
"""))
{
    AssertEqual(
        "https://github.com/Zeen1th/streamer-hub/releases/download/v0.2.3/StreamerHub-Setup-v0.2.3.exe",
        UpdateSupport.SelectInstallerDownloadUrl(release.RootElement),
        "installer asset selection");
    AssertTrue(
        UpdateSupport.BuildInstallerArguments(@"R:\Apps\Streamer Hub").Contains("/DIR=\"R:\\Apps\\Streamer Hub\"", StringComparison.Ordinal),
        "installer targets the running app directory");
}

// Streamer chat slash commands: parsing, durations
{
    var timeout = ChatCommandProcessor.Parse("/to @Bob 10m spamming links");
    AssertTrue(timeout is not null, "slash command parses");
    AssertEqual("to", timeout!.Name, "slash command name");
    AssertEqual(4, timeout.Args.Count, "slash command args");
    AssertEqual("@Bob", timeout.Args[0], "slash command first arg");
    AssertTrue(ChatCommandProcessor.Parse("hello world") is null, "plain text is not a command");
    AssertTrue(ChatCommandProcessor.Parse("//wave") is null, "double slash is plain text");
    AssertTrue(ChatCommandProcessor.Parse("/ ") is null, "a lone slash is plain text");
    AssertEqual("clear", ChatCommandProcessor.Parse("  /CLEAR  ")!.Name, "command names are case-insensitive");
    AssertEqual(90, ChatCommandProcessor.ParseDuration("90"), "plain seconds");
    AssertEqual(600, ChatCommandProcessor.ParseDuration("10m"), "minutes");
    AssertEqual(7200, ChatCommandProcessor.ParseDuration("2h"), "hours");
    AssertEqual(86400, ChatCommandProcessor.ParseDuration("1d"), "days");
    AssertTrue(ChatCommandProcessor.ParseDuration("abc") is null, "garbage is not a duration");
    AssertTrue(ChatCommandProcessor.ParseDuration("0") is null, "zero is not a duration");
    AssertEqual(14 * 24 * 60 * 60, ChatCommandProcessor.ParseDuration("999d"), "durations are capped at 14 days");
    AssertEqual("10m", ChatCommandProcessor.FormatDuration(600), "format minutes");
    AssertEqual("bob", ChatCommandProcessor.CleanUser("@bob,"), "usernames are cleaned");
}

// Gifted subs from USERNOTICE lines
{
    const string tail = " :tmi.twitch.tv USERNOTICE #channel";
    AssertTrue(TwitchUsernoticeParser.TryParseGift("@display-name=Alice;id=g1;login=alice;msg-id=subgift;msg-param-recipient-display-name=Bob;msg-param-sub-plan=2000;msg-param-sender-count=7" + tail, out var single), "single gift parses");
    AssertEqual("Alice", single!.GifterName, "gifter name");
    AssertEqual(1, single.Count, "single gift count");
    AssertEqual("Bob", single.RecipientName, "recipient");
    AssertEqual("2000", single.Tier, "tier");
    AssertEqual(7, single.TotalGifted, "total gifted");

    AssertTrue(TwitchUsernoticeParser.TryParseGift("@display-name=Dana;id=m1;login=dana;msg-id=submysterygift;msg-param-mass-gift-count=5;msg-param-sub-plan=1000;msg-param-community-gift-id=c9" + tail, out var bundle), "bundle parses");
    AssertEqual(5, bundle!.Count, "bundle count");

    AssertTrue(!TwitchUsernoticeParser.TryParseGift("@display-name=Dana;id=s1;login=dana;msg-id=subgift;msg-param-recipient-display-name=Eve;msg-param-community-gift-id=c9" + tail, out _), "per-recipient notices of a bundle are skipped");
    AssertTrue(TwitchUsernoticeParser.TryParseGift("@display-name=ananonymousgifter;id=a1;login=ananonymousgifter;msg-id=anonsubmysterygift;msg-param-mass-gift-count=10" + tail, out var anon), "anonymous bundle parses");
    AssertTrue(anon!.Anonymous && anon.GifterName == "Anonymous" && anon.Count == 10, "anonymous gifts are hidden");
    AssertTrue(!TwitchUsernoticeParser.TryParseGift("@display-name=Zed;id=r1;login=zed;msg-id=raid" + tail, out _), "other notices are not gifts");
    AssertTrue(TwitchUsernoticeParser.TryParseGift("@display-name=Sp\\sace;id=g2;login=space;msg-id=subgift;msg-param-recipient-display-name=A\\sB" + tail, out var spaced) && spaced!.GifterName == "Sp ace" && spaced.RecipientName == "A B", "escaped spaces in names are decoded");
}

// 7TV: global and channel sets share one reader
{
    using var set = JsonDocument.Parse("""{ "emotes": [ { "id": "01ABC", "name": "KEKW" }, { "id": "", "name": "bad" }, { "name": "noid" } ] }""");
    var map = new Dictionary<string, string>();
    StreamerHub.Core.Twitch.EmoteRegistry.AddSevenTvEmotes(set.RootElement, map);
    AssertEqual(1, map.Count, "only complete 7TV emotes are kept");
    AssertEqual("https://cdn.7tv.app/emote/01ABC/2x.webp", map["KEKW"], "7TV emote url");
}

var root = Path.Combine(Path.GetTempPath(), $"streamer-hub-task4-{Guid.NewGuid():N}");
Directory.CreateDirectory(root);
try
{
    using var settings = new SettingsStore(Path.Combine(root, "settings.json"));
    await using var server = new ChatOverlayServer(root, settings.ChatOverlay, preferredPort: 0);
    await server.StartAsync();
    var bridge = new ChatOverlayHostBridge(settings, server);

    var installedFonts = InstalledFontCatalog.GetFamilies();
    AssertTrue(installedFonts.Count > 0, "installed font catalogue is not empty");
    AssertEqual(
        installedFonts.Count,
        installedFonts.Distinct(StringComparer.OrdinalIgnoreCase).Count(),
        "installed font catalogue is unique");

    AssertEqual(settings.ChatOverlay, bridge.GetState(), "initial overlay state");
    AssertEqual(server.OverlayUrl.ToString(), bridge.GetUrl(), "overlay URL");

    using var socket = new ClientWebSocket();
    await socket.ConnectAsync(server.WebSocketUrl, CancellationToken.None);
    await ReceiveAsync(socket);
    await ReceiveAsync(socket);
    AssertEqual("disconnected", Kind(await ReceiveAsync(socket)), "safe initial disconnected state");

    // Settings are owned and validated by the UI; the host carries them
    // verbatim. What matters here is round-trip fidelity - an arbitrary nested
    // payload must survive save and broadcast with nothing dropped.
    const string settingsJson = """
    {
      "version": 2,
      "enabled": true,
      "block": { "x": 48, "y": 492, "width": 760, "height": 540, "anchor": "bottom-left" },
      "flow": { "maxMessages": 99, "durationSeconds": 0, "displayMode": "latest", "sizeScale": 250 },
      "text": { "wrapMode": "break-anywhere", "color": "#ff00ff" },
      "filters": { "blockedUsernames": ["spam*", "troll"], "hideBots": true },
      "futureFieldTheHostHasNeverHeardOf": { "nested": [1, 2, 3] }
    }
    """;
    var requested = JsonSerializer.Deserialize<ChatOverlaySettings>(settingsJson, Json.Options)!;

    AssertTrue(await bridge.SaveSettingsAsync(requested), "settings save result");

    var stored = bridge.GetState();
    AssertTrue(stored.Values.ContainsKey("version"), "version survives the round trip");
    AssertEqual(99, stored.Values["flow"].GetProperty("maxMessages").GetInt32(), "nested value is untouched");
    AssertEqual(0, stored.Values["flow"].GetProperty("durationSeconds").GetInt32(), "zero duration is not coerced away");
    AssertEqual("break-anywhere", stored.Values["text"].GetProperty("wrapMode").GetString(), "nested string survives");
    AssertEqual(2, stored.Values["filters"].GetProperty("blockedUsernames").GetArrayLength(), "arrays survive");
    AssertTrue(stored.Values.ContainsKey("futureFieldTheHostHasNeverHeardOf"), "unknown fields are not dropped");

    using (var settingsEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        AssertEqual("settings", settingsEvent.RootElement.GetProperty("kind").GetString(), "settings event kind");
        var payload = settingsEvent.RootElement.GetProperty("payload");
        AssertEqual(99, payload.GetProperty("flow").GetProperty("maxMessages").GetInt32(), "broadcast carries nested settings");
        AssertEqual(250, payload.GetProperty("flow").GetProperty("sizeScale").GetInt32(), "broadcast carries sizeScale");
        AssertTrue(payload.TryGetProperty("futureFieldTheHostHasNeverHeardOf", out _), "broadcast keeps unknown fields");
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

    // A profile resolved after its message was published must reach the overlay
    // so the first message from a viewer stops showing the fallback avatar.
    await bridge.PublishProfileAsync("100", "https://cdn.example/real-avatar.png", "#00ff00");
    using (var profileEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        var payload = profileEvent.RootElement.GetProperty("payload");
        AssertEqual("profile", profileEvent.RootElement.GetProperty("kind").GetString(), "profile event kind");
        AssertEqual("100", payload.GetProperty("userId").GetString(), "profile user ID");
        AssertEqual("https://cdn.example/real-avatar.png", payload.GetProperty("avatarUrl").GetString(), "profile avatar");
        AssertEqual("#00ff00", payload.GetProperty("color").GetString(), "profile colour");
    }

    await bridge.PublishClearAsync(new ChatClear(ChatClearScope.Message, "task4-message"));
    using (var clearEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        var payload = clearEvent.RootElement.GetProperty("payload");
        AssertEqual("clear", clearEvent.RootElement.GetProperty("kind").GetString(), "clear event kind");
        AssertEqual("message", payload.GetProperty("scope").GetString(), "clear scope");
        AssertEqual("task4-message", payload.GetProperty("id").GetString(), "clear target");
    }

    await bridge.PublishClearAsync(new ChatClear(ChatClearScope.All, null));
    using (var clearEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        AssertEqual("all", clearEvent.RootElement.GetProperty("payload").GetProperty("scope").GetString(), "full clear scope");
    }

    var emotes = new Dictionary<string, IReadOnlyDictionary<string, string>>
    {
        ["bttv"] = new Dictionary<string, string> { ["catJAM"] = "https://cdn.betterttv.net/emote/x/3x" },
    };
    await bridge.PublishEmotesAsync(emotes);
    using (var emoteEvent = JsonDocument.Parse(await ReceiveAsync(socket)))
    {
        var payload = emoteEvent.RootElement.GetProperty("payload");
        AssertEqual("emotes", emoteEvent.RootElement.GetProperty("kind").GetString(), "emote event kind");
        AssertEqual(
            "https://cdn.betterttv.net/emote/x/3x",
            payload.GetProperty("providers").GetProperty("bttv").GetProperty("catJAM").GetString(),
            "emote map contents");
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