using StreamerHub.Core.Rpc;
using StreamerHub.Core.Twitch;

var failures = new List<string>();

await RunAsync("parse_privmsg_extracts_user_id_and_preserves_flags_and_message", ParsePrivmsgExtractsUserIdAndPreservesFlagsAndMessageAsync);
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

Console.WriteLine("PASS 4/4");

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

    AssertEqual("streamer", message.Username, "username");
    AssertEqual("424242", message.UserId, "user-id");
    AssertEqual("hello there :wave", message.Message, "message");
    AssertTrue(message.IsBroadcaster, "broadcaster flag");
    AssertTrue(message.IsMod, "moderator flag");
    AssertTrue(message.IsVip, "vip flag");
    AssertTrue(message.IsSubscriber, "subscriber flag");
    AssertEqual(timestamp.ToString("O"), message.Timestamp, "timestamp");

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
