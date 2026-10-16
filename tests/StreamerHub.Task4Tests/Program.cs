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

// Raider clip sub-action: which clip is picked and how it is played
{
    var now = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero);
    TwitchClipInfo Clip(string id, double seconds, int views, int daysAgo) =>
        new(id, $"clip {id}", seconds, views, now.AddDays(-daysAgo), "viewer", "Raider", null);
    var clips = new List<TwitchClipInfo>
    {
        Clip("long-hit", 55, 900, 3),
        Clip("short-top", 20, 400, 10),
        Clip("short-new", 12, 50, 1),
        Clip("short-mid", 25, 100, 5),
    };

    AssertEqual("short-top", ClipSelector.Pick(clips, "top", 30)!.Id, "top picks the most viewed clip that fits the cap");
    AssertEqual("short-new", ClipSelector.Pick(clips, "recent", 30)!.Id, "recent picks the newest clip that fits the cap");
    AssertEqual("long-hit", ClipSelector.Pick(clips, "top", 60)!.Id, "a longer cap lets the long clip win");
    AssertEqual("long-hit", ClipSelector.Pick(new[] { clips[0] }, "random", 30)!.Id, "when nothing fits, any clip is used");
    AssertTrue(ClipSelector.Pick(Array.Empty<TwitchClipInfo>(), "top", 30) is null, "no clips picks nothing");
    var seen = new HashSet<string>();
    var rng = new Random(7);
    for (var i = 0; i < 60; i++) seen.Add(ClipSelector.Pick(clips, "random", 30, rng)!.Id);
    AssertEqual(3, seen.Count, "random only uses clips that fit the cap, and reaches all of them");

    AssertEqual(now.AddDays(-7), ClipSelector.PeriodStart("week", now)!.Value, "week window");
    AssertEqual(now.AddDays(-30), ClipSelector.PeriodStart(null, now)!.Value, "month is the default window");
    AssertTrue(ClipSelector.PeriodStart("all", now) is null, "all time has no start");

    AssertEqual(
        "https://clips-media-assets2.twitch.tv/AT-cm%7C123.mp4",
        ClipSelector.DirectVideoUrl("https://clips-media-assets2.twitch.tv/AT-cm%7C123-preview-480x272.jpg"),
        "legacy thumbnail maps to the mp4");
    AssertTrue(
        ClipSelector.DirectVideoUrl("https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/Slug/abc/preview.jpg") is null,
        "unknown thumbnail shapes fall back to the embedded player");
    AssertTrue(ClipSelector.DirectVideoUrl(null) is null, "no thumbnail, no direct video");
    AssertEqual(
        "https://cdn.example/clip/landscape/1080.mp4?sig=abc&token=%7B%22a%22%3A1%7D",
        ClipVideoResolver.BestVideoUrl("""
        [{"data":{"clip":{"playbackAccessToken":{"signature":"abc","value":"{\"a\":1}"},"videoQualities":[
          {"quality":"360","sourceURL":"https://cdn.example/clip/landscape/360.mp4"},
          {"quality":"1080","sourceURL":"https://cdn.example/clip/landscape/1080.mp4"},
          {"quality":"720","sourceURL":"https://cdn.example/clip/landscape/720.mp4"}]}}}]
        """),
        "best quality file is chosen and signed");
    AssertTrue(ClipVideoResolver.BestVideoUrl("""[{"data":{"clip":null}}]""") is null, "a clip with no access token has no best file");
    AssertEqual("show-clip", Kind(ChatOverlayProtocol.ShowClip(new { clipId = "x" })), "show-clip envelope kind");
}

// Counter "set to a number" command: survives a save and load, and counters saved before it existed load as off
{
    var withSet = new Counter { Id = "c1", Name = "Deaths", Commands = new CounterConfig { Set = new CounterSetCommandConfig { Enabled = true, CommandName = "set", Permission = "broadcaster", CooldownSeconds = 5 } } };
    var reloaded = JsonSerializer.Deserialize<Counter>(JsonSerializer.Serialize(withSet, Json.Options), Json.Options)!;
    AssertTrue(reloaded.Commands.Set.Enabled, "set command stays enabled after a round trip");
    AssertEqual("set", reloaded.Commands.Set.CommandName, "set command name after a round trip");
    AssertEqual("broadcaster", reloaded.Commands.Set.Permission, "set command rank after a round trip");
    AssertEqual(5, reloaded.Commands.Set.CooldownSeconds, "set command cooldown after a round trip");

    var old = JsonSerializer.Deserialize<Counter>("""{"id":"c0","name":"Old","count":3,"commands":{"increase":{"commandName":"deaths","permission":"everyone","cooldownSeconds":10}}}""", Json.Options)!;
    AssertTrue(!old.Commands.Set.Enabled, "a counter saved before the set command existed has it off");
    AssertEqual("mod", old.Commands.Set.Permission, "the set command is mods-only until chosen otherwise");
}

// Pictures: a dedicated image source shows them alone; the chat overlay shows them only when there is none
{
    var imageRoot = Path.Combine(Path.GetTempPath(), $"streamer-hub-images-{Guid.NewGuid():N}");
    Directory.CreateDirectory(imageRoot);
    try
    {
        await using var imageServer = new ChatOverlayServer(imageRoot, new ChatOverlaySettings(), preferredPort: 0);
        await imageServer.StartAsync();

        var inbox = new Dictionary<ClientWebSocket, List<string>>();
        ClientWebSocket Listen(ClientWebSocket client)
        {
            // A background reader keeps every message; "nothing arrived" is then a plain check, not a cancelled read
            // (cancelling a read aborts a ClientWebSocket).
            var kinds = new List<string>();
            inbox[client] = kinds;
            _ = Task.Run(async () =>
            {
                var buffer = new byte[16 * 1024];
                try
                {
                    while (client.State == WebSocketState.Open)
                    {
                        var result = await client.ReceiveAsync(buffer, CancellationToken.None);
                        if (result.MessageType == WebSocketMessageType.Close) break;
                        lock (kinds) kinds.Add(Kind(Encoding.UTF8.GetString(buffer, 0, result.Count)));
                    }
                }
                catch (WebSocketException)
                {
                }
            });
            return client;
        }
        async Task<ClientWebSocket> ConnectAsync(string query)
        {
            var client = new ClientWebSocket();
            await client.ConnectAsync(new Uri(imageServer.WebSocketUrl + query), CancellationToken.None);
            for (var i = 0; i < 4; i++) await ReceiveAsync(client); // app-version, hello, settings, disconnected
            return Listen(client);
        }
        async Task<bool> GotAsync(ClientWebSocket client, string kind)
        {
            await Task.Delay(500);
            var kinds = inbox[client];
            lock (kinds) return kinds.Remove(kind);
        }

        using var chatOverlay = await ConnectAsync(string.Empty);
        await imageServer.PublishShowImageAsync(new { imageUrl = "x" });
        AssertTrue(await GotAsync(chatOverlay, "show-image"), "with no image source, the chat overlay shows the picture");

        using var imageSource = await ConnectAsync("?target=image-overlay");
        await imageServer.PublishShowImageAsync(new { imageUrl = "x" });
        AssertTrue(await GotAsync(imageSource, "show-image"), "the image source shows the picture");
        AssertTrue(!await GotAsync(chatOverlay, "show-image"), "the chat overlay does not draw it a second time");

        // Clips: the image source stands in until a dedicated clip source connects, then only that one plays them
        await imageServer.PublishShowClipAsync(new { clipId = "c" });
        AssertTrue(await GotAsync(imageSource, "show-clip"), "with no clip source, the image source plays the clip");
        AssertTrue(!await GotAsync(chatOverlay, "show-clip"), "the chat overlay never plays clips");

        using var clipSource = await ConnectAsync("?target=clip-overlay");
        await imageServer.PublishShowClipAsync(new { clipId = "c" });
        AssertTrue(await GotAsync(clipSource, "show-clip"), "the clip source plays the clip");
        AssertTrue(!await GotAsync(imageSource, "show-clip"), "the image source does not play it a second time");
    }
    finally
    {
        try { Directory.Delete(imageRoot, recursive: true); } catch { }
    }
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

// Settings survive a damaged or missing settings.json (crash or power cut mid-write)
{
    var recoveryRoot = Path.Combine(Path.GetTempPath(), $"streamer-hub-recovery-{Guid.NewGuid():N}");
    Directory.CreateDirectory(recoveryRoot);
    try
    {
        var file = Path.Combine(recoveryRoot, "settings.json");
        using (var first = new SettingsStore(file))
        {
            first.SaveCounter(new Counter { Id = "c1", Name = "Deaths", Count = 7 });
            first.Flush();
            first.SetLanguage("ar");
            first.Flush(); // second write keeps the first as the last good copy
        }
        AssertTrue(File.Exists(file + ".bak"), "a last good copy is kept");
        AssertTrue(Directory.GetFiles(Path.Combine(recoveryRoot, "backups"), "settings-*.json").Length == 1, "a snapshot is taken once there is data");

        // damaged settings.json: restored from the backup, damaged copy kept, one-shot notice
        File.WriteAllText(file, "{ \"counters\": [ { \"id\": \"c1\", \"na");
        using (var restored = new SettingsStore(file))
        {
            AssertEqual(1, restored.Counters.Count, "counters restored from backup");
            AssertEqual(7, restored.Counters[0].Count, "counter value restored");
            var notice = restored.TakeRecoveryNotice();
            AssertTrue(notice is not null, "restore is reported");
            AssertEqual("settings.json.bak", notice!.RestoredFrom, "restored from the last good copy");
            AssertTrue(notice.SavedAs is not null && notice.SavedAs.StartsWith("settings.corrupt-"), "damaged file is kept aside");
            AssertTrue(File.Exists(Path.Combine(recoveryRoot, notice.SavedAs!)), "damaged copy exists");
            AssertTrue(restored.TakeRecoveryNotice() is null, "the notice is reported once");
        }
        AssertTrue(File.ReadAllText(file).Contains("\"counters\""), "settings.json is valid again");

        // missing settings.json: restored silently from the backup
        File.Delete(file);
        using (var missing = new SettingsStore(file))
        {
            AssertEqual(1, missing.Counters.Count, "counters restored when the file is gone");
            var notice = missing.TakeRecoveryNotice();
            AssertTrue(notice is not null && notice.RestoredFrom is not null && notice.SavedAs is null, "missing file restored without a damaged copy");
        }

        // nothing to restore from: starts empty but keeps the damaged file and says so
        var lonely = Path.Combine(recoveryRoot, "lonely");
        Directory.CreateDirectory(lonely);
        File.WriteAllText(Path.Combine(lonely, "settings.json"), "not json at all");
        using (var empty = new SettingsStore(Path.Combine(lonely, "settings.json")))
        {
            AssertEqual(0, empty.Counters.Count, "no data to restore");
            var notice = empty.TakeRecoveryNotice();
            AssertTrue(notice is not null && notice.RestoredFrom is null && notice.SavedAs is not null, "unreadable file is reported");
            AssertTrue(File.Exists(Path.Combine(lonely, notice!.SavedAs!)), "unreadable file is kept");
        }

        // listing and restoring backups on demand (the Settings > Backups card)
        using (var manual = new SettingsStore(file))
        {
            manual.SaveCounter(new Counter { Id = "c2", Name = "Wins", Count = 1 });
            manual.Flush(); // main now has 2 counters; the backup and snapshot hold 1
            var backups = manual.ListBackups();
            AssertTrue(backups.Count >= 2, "backup and snapshot are listed");
            AssertTrue(backups.All(b => b.Counters == 1), "listed copies report their contents");
            AssertTrue(backups.Any(b => b.Kind == "last") && backups.Any(b => b.Kind == "snapshot"), "kinds are reported");
            AssertTrue(!manual.RestoreBackup("../settings.json", out var traversalError) && traversalError == "BACKUP NOT FOUND", "unknown names are rejected");
            AssertTrue(!manual.RestoreBackup(Path.Combine(recoveryRoot, "settings.json"), out _), "paths are rejected");

            var snapshot = backups.First(b => b.Kind == "snapshot");
            AssertTrue(manual.RestoreBackup(snapshot.Name, out var restoreError) && restoreError is null, "restore succeeds");
            AssertEqual(1, manual.Counters.Count, "restored settings are live");
            AssertTrue(Directory.GetFiles(Path.Combine(recoveryRoot, "backups"), "before-restore-*.json").Length == 1, "the previous settings are kept before restoring");
            AssertTrue(manual.ListBackups().Any(b => b.Kind == "before-restore" && b.Counters == 2), "the previous settings can be restored again");
        }
        using (var reopened = new SettingsStore(file))
        {
            AssertEqual(1, reopened.Counters.Count, "the restore survives a restart");
        }

        // a first run is not a problem
        var fresh = Path.Combine(recoveryRoot, "fresh", "settings.json");
        using (var firstRun = new SettingsStore(fresh))
        {
            AssertTrue(firstRun.TakeRecoveryNotice() is null, "first run has no recovery notice");
        }
    }
    finally
    {
        try { Directory.Delete(recoveryRoot, recursive: true); } catch { }
    }
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
    AssertEqual("app-version", Kind(await ReceiveAsync(socket)), "overlay pages are told the app version first");
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