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
await RunAsync("echo_tracker_detects_and_consumes_host_echoes", EchoTrackerDetectsAndConsumesHostEchoesAsync);
await RunAsync("echo_tracker_ignores_non_host_or_untracked_messages", EchoTrackerIgnoresNonHostOrUntrackedMessagesAsync);
await RunAsync("echo_tracker_expires_stale_entries", EchoTrackerExpiresStaleEntriesAsync);
await RunAsync("echo_tracker_handles_multiple_identical_messages", EchoTrackerHandlesMultipleIdenticalMessagesAsync);
await RunAsync("parse_usernotice_raid_extracts_raider_and_viewers", ParseUsernoticeRaidExtractsRaiderAndViewersAsync);
await RunAsync("single_instance_coordinator_enforces_single_instance_and_notifies_primary", SingleInstanceCoordinatorEnforcesSingleInstanceAndNotifiesPrimaryAsync);
await RunAsync("pending_remod_manager_persists_and_restores_queue", PendingRemodManagerPersistsAndRestoresQueueAsync);
await RunAsync("pending_remod_manager_calculates_backoff_and_records_retries", PendingRemodManagerCalculatesBackoffAndRecordsRetriesAsync);
await RunAsync("parse_privmsg_extracts_lead_moderator_badge", ParsePrivmsgExtractsLeadModeratorBadgeAsync);

if (failures.Count > 0)
{
    foreach (var failure in failures)
    {
        Console.Error.WriteLine(failure);
    }

    Environment.ExitCode = 1;
    return;
}

Console.WriteLine("PASS 15/15");

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

    // A CLEARCHAT without target-user-id tag but with a trailing target user name
    const string timeoutWithoutTargetTag = "@ban-duration=600;room-id=999;tmi-sent-ts=1 :tmi.twitch.tv CLEARCHAT #room :troll";
    if (!TwitchClearParser.TryParse(timeoutWithoutTargetTag, out ChatClear? bannedWithoutTag))
    {
        throw new InvalidOperationException("expected CLEARCHAT without target-user-id tag to parse");
    }
    AssertEqual(ChatClearScope.User, bannedWithoutTag.Scope, "CLEARCHAT without tag user scope");
    AssertEqual("troll", bannedWithoutTag.Id, "CLEARCHAT target user name");

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

Task EchoTrackerDetectsAndConsumesHostEchoesAsync()
{
    var tracker = new HostMessageEchoTracker(TimeSpan.FromSeconds(25));

    tracker.TrackSent("Streamer", "Welcome everyone to the stream!");
    AssertEqual(1, tracker.TrackedCount, "tracked count after 1 message");

    // Broadcaster IRC echo arrives
    var consumed = tracker.IsEchoAndConsume("streamer", "Welcome everyone to the stream!", channelLogin: "streamer");
    AssertTrue(consumed, "should consume first matching echo");
    AssertEqual(0, tracker.TrackedCount, "tracked count after consumption");

    // Second echo of the same message should not be consumed
    var secondEcho = tracker.IsEchoAndConsume("streamer", "Welcome everyone to the stream!", channelLogin: "streamer");
    AssertFalse(secondEcho, "second echo should not match any tracked message");

    // Bot message test
    tracker.TrackSent("mybot", "!song current playing song");
    var botConsumed = tracker.IsEchoAndConsume("mybot", "!song current playing song", channelLogin: "streamer", botLogin: "mybot");
    AssertTrue(botConsumed, "bot echo should be consumed");

    return Task.CompletedTask;
}

Task EchoTrackerIgnoresNonHostOrUntrackedMessagesAsync()
{
    var tracker = new HostMessageEchoTracker(TimeSpan.FromSeconds(25));

    // Message sent via web browser by streamer (not tracked via TrackSent)
    var webMessageConsumed = tracker.IsEchoAndConsume("streamer", "Message typed in web browser", channelLogin: "streamer");
    AssertFalse(webMessageConsumed, "messages not sent through TrackSent must not be consumed");

    // Host tracked a message, but another viewer chats the same message
    tracker.TrackSent("streamer", "GG");
    var viewerConsumed = tracker.IsEchoAndConsume("viewer123", "GG", channelLogin: "streamer", botLogin: "mybot");
    AssertFalse(viewerConsumed, "viewer message must not consume host echo");
    AssertEqual(1, tracker.TrackedCount, "host tracked message must remain intact");

    return Task.CompletedTask;
}

Task EchoTrackerExpiresStaleEntriesAsync()
{
    var tracker = new HostMessageEchoTracker(TimeSpan.FromSeconds(10));
    var past = DateTime.UtcNow - TimeSpan.FromSeconds(15);

    tracker.TrackSent("streamer", "old message", sentAt: past);
    var consumed = tracker.IsEchoAndConsume("streamer", "old message", channelLogin: "streamer");
    AssertFalse(consumed, "stale message past window should be pruned and not consumed");

    return Task.CompletedTask;
}

Task EchoTrackerHandlesMultipleIdenticalMessagesAsync()
{
    var tracker = new HostMessageEchoTracker(TimeSpan.FromSeconds(25));

    // Two identical auto-replies sent in succession
    tracker.TrackSent("streamer", "Check out my discord: https://discord.gg");
    tracker.TrackSent("streamer", "Check out my discord: https://discord.gg");
    AssertEqual(2, tracker.TrackedCount, "both identical messages tracked");

    var echo1 = tracker.IsEchoAndConsume("streamer", "Check out my discord: https://discord.gg", channelLogin: "streamer");
    AssertTrue(echo1, "first echo consumed");
    AssertEqual(1, tracker.TrackedCount, "one tracked entry remaining");

    var echo2 = tracker.IsEchoAndConsume("streamer", "Check out my discord: https://discord.gg", channelLogin: "streamer");
    AssertTrue(echo2, "second echo consumed");
    AssertEqual(0, tracker.TrackedCount, "all entries consumed");

    var echo3 = tracker.IsEchoAndConsume("streamer", "Check out my discord: https://discord.gg", channelLogin: "streamer");
    AssertFalse(echo3, "third echo not consumed");

    return Task.CompletedTask;
}

Task ParseUsernoticeRaidExtractsRaiderAndViewersAsync()
{
    const string raidLine = "@badge-info=;badges=crowd-chant/1;color=#FF69B4;display-name=SuperRaider;emotes=;flags=;id=12345-abc;login=superraider;mod=0;msg-id=raid;msg-param-displayName=SuperRaider;msg-param-login=superraider;msg-param-viewerCount=42;room-id=999;subscriber=0;system-msg=42\\sraiders\\sfrom\\sSuperRaider\\shave\\sjoined!;tmi-sent-ts=1724716800000;user-id=987654;user-type= :tmi.twitch.tv USERNOTICE #room";

    if (!TwitchUsernoticeParser.TryParseRaid(raidLine, out var raid))
    {
        throw new InvalidOperationException("expected TwitchUsernoticeParser to parse raid");
    }

    AssertEqual("987654", raid.FromUserId, "FromUserId");
    AssertEqual("SuperRaider", raid.FromUserName, "FromUserName");
    AssertEqual("superraider", raid.FromUserLogin, "FromUserLogin");
    AssertEqual(42, raid.Viewers, "Viewers");

    // Non-raid USERNOTICE should return false
    const string subLine = "@badge-info=;badges=subscriber/1;color=#00FF00;display-name=Viewer;msg-id=sub :tmi.twitch.tv USERNOTICE #room";
    AssertFalse(TwitchUsernoticeParser.TryParseRaid(subLine, out _), "non-raid msg-id should return false");

    return Task.CompletedTask;
}

async Task SingleInstanceCoordinatorEnforcesSingleInstanceAndNotifiesPrimaryAsync()
{
    var testMutexName = $"StreamerHub_Test_Mutex_{Guid.NewGuid():N}";
    var testEventName = $"StreamerHub_Test_Event_{Guid.NewGuid():N}";

    var showInvokedTcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

    using (var primary = new SingleInstanceCoordinator(testMutexName, testEventName))
    {
        AssertTrue(primary.IsPrimary, "primary coordinator must acquire mutex and be primary");

        primary.RegisterShowHandler(() =>
        {
            showInvokedTcs.TrySetResult(true);
        });

        // Launch secondary instance with same mutex/event
        using (var secondary = new SingleInstanceCoordinator(testMutexName, testEventName))
        {
            AssertFalse(secondary.IsPrimary, "secondary coordinator must detect running instance and not be primary");

            var notified = SingleInstanceCoordinator.NotifyPrimary(testEventName);
            AssertTrue(notified, "secondary must successfully signal primary via named event");

            var completedTask = await Task.WhenAny(showInvokedTcs.Task, Task.Delay(3000)).ConfigureAwait(false);
            AssertTrue(completedTask == showInvokedTcs.Task && await showInvokedTcs.Task.ConfigureAwait(false), "primary show handler must be triggered by secondary notification");
        }
    }

    // Now that primary is disposed, another instance should be able to become primary
    using (var nextPrimary = new SingleInstanceCoordinator(testMutexName, testEventName))
    {
        AssertTrue(nextPrimary.IsPrimary, "subsequent instance must become primary after prior primary is disposed");
    }
}

Task PendingRemodManagerPersistsAndRestoresQueueAsync()
{
    var tempFile = Path.Combine(Path.GetTempPath(), $"streamerhub_remod_test_{Guid.NewGuid():N}.json");
    try
    {
        var manager1 = new PendingRemodManager(tempFile);
        AssertEqual(0, manager1.Count, "initial count");

        var targetTime1 = DateTime.UtcNow.AddMinutes(5);
        var targetTime2 = DateTime.UtcNow.AddMinutes(10);

        manager1.Enqueue("broadcaster1", "mod_user_1", "regular_mod", targetTime1, wasLeadMod: false);
        manager1.Enqueue("broadcaster1", "lead_mod_user", "head_mod", targetTime2, wasLeadMod: true);
        AssertEqual(2, manager1.Count, "count after enqueue");

        // Simulate application restart by creating a new manager with the same storage file
        var manager2 = new PendingRemodManager(tempFile);
        AssertEqual(2, manager2.Count, "restored count after restart");

        var entries = manager2.GetAllEntries();
        var modEntry = entries.FirstOrDefault(e => e.TargetUserId == "mod_user_1");
        var leadModEntry = entries.FirstOrDefault(e => e.TargetUserId == "lead_mod_user");

        AssertTrue(modEntry != null, "mod entry restored");
        AssertFalse(modEntry!.WasLeadMod, "regular mod was not lead mod");
        AssertEqual("regular_mod", modEntry.TargetLogin, "regular mod login");

        AssertTrue(leadModEntry != null, "lead mod entry restored");
        AssertTrue(leadModEntry!.WasLeadMod, "lead mod flagged correctly");
        AssertEqual("head_mod", leadModEntry.TargetLogin, "lead mod login");

        // Remove one
        AssertTrue(manager2.Remove(modEntry.Id), "remove entry");
        AssertEqual(1, manager2.Count, "count after remove");

        // Verify removal persisted
        var manager3 = new PendingRemodManager(tempFile);
        AssertEqual(1, manager3.Count, "persisted count after remove");
    }
    finally
    {
        try { if (File.Exists(tempFile)) File.Delete(tempFile); } catch { }
    }

    return Task.CompletedTask;
}

Task PendingRemodManagerCalculatesBackoffAndRecordsRetriesAsync()
{
    var tempFile = Path.Combine(Path.GetTempPath(), $"streamerhub_retry_test_{Guid.NewGuid():N}.json");
    try
    {
        var manager = new PendingRemodManager(tempFile);

        // Verify backoff progression
        AssertEqual(TimeSpan.FromSeconds(3), manager.CalculateNextBackoff(1), "backoff attempt 1");
        AssertEqual(TimeSpan.FromSeconds(6), manager.CalculateNextBackoff(2), "backoff attempt 2");
        AssertEqual(TimeSpan.FromSeconds(12), manager.CalculateNextBackoff(3), "backoff attempt 3");
        AssertEqual(TimeSpan.FromSeconds(20), manager.CalculateNextBackoff(4), "backoff attempt 4");
        AssertEqual(TimeSpan.FromSeconds(30), manager.CalculateNextBackoff(5), "backoff attempt 5");

        manager.Enqueue("b1", "u1", "chatter", DateTime.UtcNow.AddSeconds(10));
        var entry = manager.GetAllEntries().Single();

        // Simulate retries
        for (var i = 1; i < PendingRemodManager.MaxAttempts; i++)
        {
            var stillActive = manager.RecordRetry(entry.Id, "400 Banned or timed out");
            AssertTrue(stillActive, $"retry attempt {i} should remain active");
        }

        // Next attempt hits max attempts and is abandoned
        var finalRetry = manager.RecordRetry(entry.Id, "400 Banned or timed out");
        AssertFalse(finalRetry, "exceeding max attempts must abandon item");
        AssertEqual(0, manager.Count, "abandoned item removed from queue");
    }
    finally
    {
        try { if (File.Exists(tempFile)) File.Delete(tempFile); } catch { }
    }

    return Task.CompletedTask;
}

Task ParsePrivmsgExtractsLeadModeratorBadgeAsync()
{
    const string line1 = "@badge-info=;badges=lead_moderator/1,subscriber/12;color=#00FF00;display-name=LeadModUser;emotes=;first-msg=0;flags=;id=abc;mod=0;room-id=999;subscriber=1;tmi-sent-ts=1724716800000;turbo=0;user-id=777;user-type= :leadmoduser!leadmoduser@leadmoduser.tmi.twitch.tv PRIVMSG #room :checking in as lead mod";

    if (!TwitchPrivmsgParser.TryParse(line1, DateTime.UtcNow, out var message1))
    {
        throw new InvalidOperationException("expected TwitchPrivmsgParser to parse line with lead_moderator badge");
    }

    AssertTrue(message1.IsMod, "lead_moderator badge must set IsMod to true");
    AssertTrue(message1.IsLeadMod, "lead_moderator badge must set IsLeadMod to true");
    AssertEqual("LeadModUser", message1.Username, "username");
    AssertEqual("777", message1.UserId, "user-id");

    const string line2 = "@badge-info=;badges=lead-moderator/1;color=#00FF00;display-name=LeadModDash;emotes=;id=def;user-id=888 :leadmoddash!leadmoddash@leadmoddash.tmi.twitch.tv PRIVMSG #room :dash variant";

    if (!TwitchPrivmsgParser.TryParse(line2, DateTime.UtcNow, out var message2))
    {
        throw new InvalidOperationException("expected TwitchPrivmsgParser to parse line with lead-moderator badge");
    }

    AssertTrue(message2.IsMod, "lead-moderator badge must set IsMod to true");
    AssertTrue(message2.IsLeadMod, "lead-moderator badge must set IsLeadMod to true");

    return Task.CompletedTask;
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
