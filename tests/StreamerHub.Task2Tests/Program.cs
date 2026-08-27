using StreamerHub.Core.Rpc;
using StreamerHub.Core.Host;
using StreamerHub.Core.Twitch;

var failures = new List<string>();

await RunAsync("parse_privmsg_extracts_user_id_and_preserves_flags_and_message", ParsePrivmsgExtractsUserIdAndPreservesFlagsAndMessageAsync);
await RunAsync("parse_privmsg_extracts_emote_ranges", ParsePrivmsgExtractsEmoteRangesAsync);
await RunAsync("parse_clear_commands", ParseClearCommandsAsync);
await RunAsync("shutdown_policy_only_diverts_a_user_window_close_to_tray", ShutdownPolicyOnlyDivertsUserCloseAsync);
await RunAsync("profile_cache_batches_and_reuses_successful_lookups", ProfileCacheBatchesAndReusesSuccessfulLookupsAsync);
await RunAsync("profile_cache_exposes_warmed_avatar_synchronously", ProfileCacheExposesWarmedAvatarSynchronouslyAsync);
await RunAsync("profile_cache_logs_failures_once_per_user_session", ProfileCacheLogsFailuresOncePerUserSessionAsync);

if (failures.Count > 0)
{
    foreach (var failure in failures)
    {
        Console.Error.WriteLine(failure);
    }

    Environment.ExitCode = 1;
    return;
}

Console.WriteLine("PASS 7/7");

async Task RunAsync(string name, Func<Task> test)
{
    try
    {
        await test().ConfigureAwait(false);
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception ex)
    {
        failures.Add($"FAIL {name}: {ex.Message}");
    }
}

Task ParsePrivmsgExtractsUserIdAndPreservesFlagsAndMessageAsync()
{
    const string line = "@badge-info=subscriber/12;badges=broadcaster/1,moderator/1,vip/1,subscriber/12;color=#FF0000;display-name=Streamer;emotes=;first-msg=0;flags=;id=abc;mod=1;room-id=999;subscriber=1;tmi-sent-ts=1724716800000;turbo=0;user-id=424242;user-type=mod :streamer!streamer@streamer.tmi.twitch.tv PRIVMSG #room :hello there :wave";
    var timestamp = new DateTime(2026, 8, 26, 12, 0, 0, DateTimeKind.Utc);

    if (!TwitchPrivmsgParser.TryParse(line, timestamp, out ChatMessage? message))
    {
        throw new InvalidOperationException("expected the parser to recognize the PRIVMSG line");
    }

    // display-name wins over the raw login, so viewers see the casing and
    // script the user chose rather than the lowercased IRC nick.
    AssertEqual("Streamer", message.Username, "username");
    AssertEqual("424242", message.UserId, "user-id");
    AssertEqual("hello there :wave", message.Message, "message");
    AssertEqual("#FF0000", message.Color, "chat colour");
    AssertTrue(message.IsBroadcaster, "broadcaster flag");
    AssertTrue(message.IsMod, "moderator flag");
    AssertTrue(message.IsVip, "vip flag");
    AssertTrue(message.IsSubscriber, "subscriber flag");
    AssertEqual(timestamp.ToString("O"), message.Timestamp, "timestamp");
    AssertEqual(0, message.Emotes.Count, "empty emotes tag yields no ranges");

    return Task.CompletedTask;
}

Task ParsePrivmsgExtractsEmoteRangesAsync()
{
    const string line = "@display-name=Viewer;emotes=25:0-4,12-16/1902:6-10;id=xyz;user-id=7 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #room :Kappa Keepo Kappa";

    if (!TwitchPrivmsgParser.TryParse(line, DateTime.UtcNow, out ChatMessage? message))
    {
        throw new InvalidOperationException("expected the parser to recognize the PRIVMSG line");
    }

    AssertEqual(3, message.Emotes.Count, "emote range count");
    // Ranges arrive grouped by emote id but must come out ordered by position.
    AssertEqual("25", message.Emotes[0].Id, "first emote id");
    AssertEqual(0, message.Emotes[0].Start, "first emote start");
    AssertEqual(4, message.Emotes[0].End, "first emote end");
    AssertEqual("1902", message.Emotes[1].Id, "second emote id");
    AssertEqual(6, message.Emotes[1].Start, "second emote start");
    AssertEqual("25", message.Emotes[2].Id, "third emote id");
    AssertEqual(12, message.Emotes[2].Start, "third emote start");

    return Task.CompletedTask;
}

Task ParseClearCommandsAsync()
{
    const string clearMsg = "@login=viewer;room-id=;target-msg-id=abc-123;tmi-sent-ts=1 :tmi.twitch.tv CLEARMSG #room :bad message";
    if (!TwitchClearParser.TryParse(clearMsg, out ChatClear? deleted))
    {
        throw new InvalidOperationException("expected CLEARMSG to parse");
    }
    AssertEqual(ChatClearScope.Message, deleted.Scope, "CLEARMSG scope");
    AssertEqual("abc-123", deleted.Id, "CLEARMSG target");

    const string timeout = "@ban-duration=600;room-id=999;target-user-id=424242;tmi-sent-ts=1 :tmi.twitch.tv CLEARCHAT #room :troll";
    if (!TwitchClearParser.TryParse(timeout, out ChatClear? banned))
    {
        throw new InvalidOperationException("expected CLEARCHAT to parse");
    }
    AssertEqual(ChatClearScope.User, banned.Scope, "CLEARCHAT user scope");
    AssertEqual("424242", banned.Id, "CLEARCHAT target user");

    // A CLEARCHAT with no target clears the whole room.
    const string clearAll = "@room-id=999;tmi-sent-ts=1 :tmi.twitch.tv CLEARCHAT #room";
    if (!TwitchClearParser.TryParse(clearAll, out ChatClear? all))
    {
        throw new InvalidOperationException("expected a targetless CLEARCHAT to parse");
    }
    AssertEqual(ChatClearScope.All, all.Scope, "CLEARCHAT full scope");

    AssertTrue(!TwitchClearParser.TryParse(":tmi.twitch.tv PRIVMSG #room :hello", out _), "PRIVMSG is not a clear");

    return Task.CompletedTask;
}

Task ShutdownPolicyOnlyDivertsUserCloseAsync()
{
    // The user closing the window is the only case the tray may swallow.
    AssertTrue(ShutdownPolicy.ShouldHideToTray(CloseTrigger.UserClosedWindow, closeToTrayEnabled: true), "user close with tray enabled hides");
    AssertTrue(!ShutdownPolicy.ShouldHideToTray(CloseTrigger.UserClosedWindow, closeToTrayEnabled: false), "user close with tray disabled exits");

    // An update hands off to a script that waits for this process to exit. If
    // the close were diverted to the tray the process would stay alive, the
    // installer would never run, and the update would silently never apply.
    AssertTrue(!ShutdownPolicy.ShouldHideToTray(CloseTrigger.UpdateRestart, closeToTrayEnabled: true), "update restart must exit even with tray enabled");
    AssertTrue(!ShutdownPolicy.ShouldHideToTray(CloseTrigger.UpdateRestart, closeToTrayEnabled: false), "update restart exits");

    AssertTrue(!ShutdownPolicy.ShouldHideToTray(CloseTrigger.TrayExit, closeToTrayEnabled: true), "tray exit must exit");
    AssertTrue(!ShutdownPolicy.ShouldHideToTray(CloseTrigger.System, closeToTrayEnabled: true), "system shutdown must exit");

    return Task.CompletedTask;
}

async Task ProfileCacheBatchesAndReusesSuccessfulLookupsAsync()
{
    var requestedBatches = new List<string[]>();
    var cache = new TwitchUserProfileCache(maxBatchSize: 2);

    async Task<IReadOnlyDictionary<string, string?>> FetchAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        requestedBatches.Add(userIds.ToArray());
        await Task.Yield();
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["100"] = "https://cdn.example/100.png",
            ["200"] = "https://cdn.example/200.png",
            ["300"] = "https://cdn.example/300.png",
        };
    }

    var first = await cache.ResolveAsync(new[] { "100", "200", "300" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
    AssertEqual(2, requestedBatches.Count, "first lookup batch count");
    AssertSequenceEqual(new[] { "100", "200" }, requestedBatches[0], "first lookup batch");
    AssertSequenceEqual(new[] { "300" }, requestedBatches[1], "second lookup batch");
    AssertEqual("https://cdn.example/200.png", first.Single(result => result.UserId == "200").AvatarUrl, "resolved avatar");

    var second = await cache.ResolveAsync(new[] { "100", "300" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
    AssertEqual(2, requestedBatches.Count, "cached lookups should not refetch successful IDs");
    AssertEqual("https://cdn.example/100.png", second.Single(result => result.UserId == "100").AvatarUrl, "cached avatar");
}

async Task ProfileCacheExposesWarmedAvatarSynchronouslyAsync()
{
    var cache = new TwitchUserProfileCache();
    await cache.ResolveAsync(
        new[] { "100" },
        (userIds, _) => Task.FromResult<IReadOnlyDictionary<string, string?>>(
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                [userIds.Single()] = "https://cdn.example/100.png",
            }),
        CancellationToken.None).ConfigureAwait(false);

    AssertTrue(cache.TryGet("100", out var avatarUrl), "warmed avatar should be available synchronously");
    AssertEqual("https://cdn.example/100.png", avatarUrl, "warmed avatar");
}

async Task ProfileCacheLogsFailuresOncePerUserSessionAsync()
{
    var fetchCount = 0;
    var cache = new TwitchUserProfileCache();

    async Task<IReadOnlyDictionary<string, string?>> FetchAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        fetchCount++;
        await Task.Yield();
        return new Dictionary<string, string?>(StringComparer.Ordinal);
    }

    var first = await cache.ResolveAsync(new[] { "404" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
    var firstResult = first.Single();
    AssertTrue(firstResult.ShouldLogFailure, "first missing avatar should log once");
    AssertEqual(null, firstResult.AvatarUrl, "first missing avatar should fall back");

    var second = await cache.ResolveAsync(new[] { "404" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
    var secondResult = second.Single();
    AssertFalse(secondResult.ShouldLogFailure, "second missing avatar should not log again");
    AssertEqual(1, fetchCount, "missing avatar should be cached for the session");
}

static void AssertEqual<T>(T expected, T actual, string label)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"{label}: expected '{expected}' but got '{actual}'");
    }
}

static void AssertTrue(bool value, string label)
{
    if (!value)
    {
        throw new InvalidOperationException($"{label}: expected true");
    }
}

static void AssertFalse(bool value, string label)
{
    if (value)
    {
        throw new InvalidOperationException($"{label}: expected false");
    }
}

static void AssertSequenceEqual<T>(IReadOnlyList<T> expected, IReadOnlyList<T> actual, string label)
{
    if (expected.Count != actual.Count)
    {
        throw new InvalidOperationException($"{label}: expected {expected.Count} items but got {actual.Count}");
    }

    for (var i = 0; i < expected.Count; i++)
    {
        if (!EqualityComparer<T>.Default.Equals(expected[i], actual[i]))
        {
            throw new InvalidOperationException($"{label}: mismatch at index {i}; expected '{expected[i]}' but got '{actual[i]}'");
        }
    }
}
