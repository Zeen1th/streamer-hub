# Review package
Base: 6d25e80edf6b61a7093ce6ed2e7c51c602da70f0
Head: 41dac3aba8876a4746a4518a364de7e12825dcdd

## Commits
41dac3a Add Twitch chat identity and avatar enrichment

## Stat
 .gitignore                                         |   2 +
 .superpowers/sdd/chat-overlay/task-2-report.md     |  80 ++++++++++
 core/Host/HostController.cs                        |  34 ++++-
 core/Twitch/ITwitchClient.cs                       |   1 +
 core/Twitch/TwitchIrcClient.cs                     | 150 ++++++++++++-------
 core/Twitch/TwitchUserProfileCache.cs              | 107 +++++++++++++
 tests/StreamerHub.Task2Tests/Program.cs            | 166 +++++++++++++++++++++
 .../StreamerHub.Task2Tests.csproj                  |  14 ++
 8 files changed, 502 insertions(+), 52 deletions(-)

## Diff
diff --git a/.gitignore b/.gitignore
index 2559702..7364c06 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,13 +1,15 @@
 node_modules/
 dist/
 core/bin/
 core/obj/
+tests/**/bin/
+tests/**/obj/
 *.user
 *.suo
 *.log
 *.bin
 deaths.txt
 
 .impeccable/
 *.tsbuildinfo
 .worktrees/
diff --git a/.superpowers/sdd/chat-overlay/task-2-report.md b/.superpowers/sdd/chat-overlay/task-2-report.md
new file mode 100644
index 0000000..56acc74
--- /dev/null
+++ b/.superpowers/sdd/chat-overlay/task-2-report.md
@@ -0,0 +1,80 @@
+# Task 2 report
+
+## Status
+
+Completed on August 27, 2026.
+
+## Implementation
+
+- Added `TwitchPrivmsgParser` and routed IRC `PRIVMSG` handling through it.
+  - Parses the Twitch `user-id` tag into `ChatMessage.UserId`.
+  - Preserves the existing username extraction, broadcaster/mod/VIP/subscriber badge rules, message text (including additional colons), ID generation, and timestamp format.
+- Added `TwitchUserProfileCache`.
+  - Deduplicates IDs, bounds Helix-compatible batches to at most 100 IDs, and caches both successful and missing profiles for the application session.
+  - Serializes fetches and synchronizes cache reads/writes.
+  - Marks only the first failed or missing lookup per user for logging.
+- Added `ITwitchClient.GetUserProfileImagesAsync` and implemented the bounded Helix `users?id=...` lookup in `TwitchIrcClient`.
+  - Uses the existing broadcaster access token and `TwitchConstants.ClientId` through the unchanged `AddHelixHeaders` path.
+- Updated `HostController` to publish every chat message immediately and exactly once.
+  - A cached avatar is attached synchronously when available.
+  - An uncached user lookup runs in the background; the already-published message keeps its null-avatar fallback, and later messages from that user reuse the cached URL.
+  - Lookup failures keep the fallback and log at most once per user/session.
+  - Bot client and broadcaster/bot authorization behavior were not changed.
+- Added the focused native Task 2 harness and ignored its generated `bin/obj` output.
+
+## Red phase
+
+Command:
+
+`dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj`
+
+Observed before production implementation:
+
+```text
+CS0103: TwitchPrivmsgParser does not exist
+CS0246: TwitchUserProfileCache could not be found
+EXIT=1
+```
+
+A second focused red cycle removed the synchronous cache-read helper after adding its test and produced:
+
+```text
+CS1061: TwitchUserProfileCache does not contain a definition for TryGet
+EXIT=1
+```
+
+## Focused tests
+
+Command:
+
+`dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj`
+
+Output:
+
+```text
+PASS parse_privmsg_extracts_user_id_and_preserves_flags_and_message
+PASS profile_cache_batches_and_reuses_successful_lookups
+PASS profile_cache_exposes_warmed_avatar_synchronously
+PASS profile_cache_logs_failures_once_per_user_session
+PASS 4/4
+EXIT=0
+```
+
+## Native build
+
+Command:
+
+`dotnet build core\StreamerHub.csproj --no-restore -p:OutputPath=bin\ChatOverlayVerify\ -p:UseAppHost=false`
+
+Output:
+
+```text
+Build succeeded.
+    0 Warning(s)
+    0 Error(s)
+EXIT=0
+```
+
+## Tooling note
+
+The normal Windows patch helper still failed with `helper_unknown_error: setup refresh had errors`. The implementation was completed through guarded direct workspace writes that required exact source matches and preserved existing line endings.
diff --git a/core/Host/HostController.cs b/core/Host/HostController.cs
index 8080de2..697807f 100644
--- a/core/Host/HostController.cs
+++ b/core/Host/HostController.cs
@@ -37,20 +37,21 @@ public sealed class HostController : IDisposable
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
+    private readonly TwitchUserProfileCache _twitchUserProfiles = new();
     private readonly RpcDispatcher _dispatcher = new();
     private readonly string _logPath;
 
     private volatile bool _authRequired;
     private int _authorizeInProgress;
     private int _botAuthorizeInProgress;
     private string _twitchChannel = string.Empty;
     private string _botLogin = string.Empty;
     private int _chatBurst;
     private DateTime _chatWindow = DateTime.UtcNow;
@@ -371,27 +372,56 @@ public sealed class HostController : IDisposable
                     : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED");
             }
             if (!shouldSend) return new GenerateAutoReplyResponse(true, generated.Message);
             var sent = await SendChatMessageCoreAsync(generated.Message).ConfigureAwait(false);
             return sent
                 ? new GenerateAutoReplyResponse(true, generated.Message)
                 : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED");
         });
     }
 
+    private async Task ResolveTwitchUserProfileAsync(string userId, string username)
+    {
+        try
+        {
+            var results = await _twitchUserProfiles.ResolveAsync(
+                    new[] { userId },
+                    _twitch.GetUserProfileImagesAsync,
+                    _shutdown)
+                .ConfigureAwait(false);
+            if (results.Count == 1 && results[0].ShouldLogFailure)
+            {
+                Log("system", $"TWITCH AVATAR LOOKUP FAILED · {username}");
+            }
+        }
+        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
+        {
+        }
+    }
+
     private void WireTwitch()
     {
         _twitch.ChatMessageReceived += message =>
         {
             if (!AllowChatRelay()) return;
-            Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{message.Username}: {message.Message}");
-            PostEvent(Events.TwitchChatMessage, message);
+            var publishedMessage = message;
+            if (!string.IsNullOrWhiteSpace(message.UserId) && _twitchUserProfiles.TryGet(message.UserId, out var avatarUrl))
+            {
+                publishedMessage = message with { AvatarUrl = avatarUrl };
+            }
+
+            Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{publishedMessage.Username}: {publishedMessage.Message}");
+            PostEvent(Events.TwitchChatMessage, publishedMessage);
+            if (!string.IsNullOrWhiteSpace(message.UserId) && !_twitchUserProfiles.TryGet(message.UserId, out _))
+            {
+                _ = ResolveTwitchUserProfileAsync(message.UserId, message.Username);
+            }
         };
         _twitch.Info += info =>
         {
             var message = info.Key switch
             {
                 "chat-joined" => CoreStrings.LF(Lang, "chat-joined", $"#{info.Arg}"),
                 "notice" => CoreStrings.L(Lang, "notice") + ": " + info.Arg,
                 "connect-failed" => CoreStrings.L(Lang, "connect-failed") + ": " + info.Arg,
                 _ => CoreStrings.L(Lang, info.Key),
             };
diff --git a/core/Twitch/ITwitchClient.cs b/core/Twitch/ITwitchClient.cs
index f319a11..f28dd1d 100644
--- a/core/Twitch/ITwitchClient.cs
+++ b/core/Twitch/ITwitchClient.cs
@@ -7,11 +7,12 @@ public sealed record TwitchInfo(string Key, string? Arg);
 public interface ITwitchClient : IAsyncDisposable
 {
     event Action<ChatMessage>? ChatMessageReceived;
     event Action<TwitchState>? StateChanged;
     event Action<TwitchInfo>? Info;
     TwitchState State { get; }
     void Connect(string accessToken, string login, string? channel = null);
     void Disconnect();
     Task<bool> SendChatMessageAsync(string message);
     Task<(bool Ok, string? Error)> UpdateChannelTitleAsync(string title);
+    Task<IReadOnlyDictionary<string, string?>> GetUserProfileImagesAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken);
 }
diff --git a/core/Twitch/TwitchIrcClient.cs b/core/Twitch/TwitchIrcClient.cs
index cd908db..f123211 100644
--- a/core/Twitch/TwitchIrcClient.cs
+++ b/core/Twitch/TwitchIrcClient.cs
@@ -1,10 +1,11 @@
+using System.Diagnostics.CodeAnalysis;
 using System.Net.Security;
 using System.Net.Sockets;
 using System.Text;
 using System.Text.Json;
 using StreamerHub.Core.Rpc;
 
 namespace StreamerHub.Core.Twitch;
 
 public enum TwitchState
 {
@@ -112,20 +113,48 @@ public sealed class TwitchIrcClient : ITwitchClient
             return updateResponse.IsSuccessStatusCode
                 ? (true, null)
                 : (false, await ReadHelixErrorAsync(updateResponse).ConfigureAwait(false));
         }
         catch (Exception ex)
         {
             return (false, ex.Message);
         }
     }
 
+    public async Task<IReadOnlyDictionary<string, string?>> GetUserProfileImagesAsync(
+        IReadOnlyList<string> userIds,
+        CancellationToken cancellationToken)
+    {
+        ArgumentNullException.ThrowIfNull(userIds);
+        if (userIds.Count is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(userIds), "Helix user lookups accept between 1 and 100 IDs.");
+        if (string.IsNullOrWhiteSpace(_accessToken)) throw new InvalidOperationException("TWITCH SESSION IS NOT READY");
+
+        var query = string.Join("&", userIds.Select(userId => $"id={Uri.EscapeDataString(userId)}"));
+        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/users?{query}");
+        AddHelixHeaders(request);
+        using var response = await Helix.SendAsync(request, cancellationToken).ConfigureAwait(false);
+        if (!response.IsSuccessStatusCode) throw new HttpRequestException(await ReadHelixErrorAsync(response).ConfigureAwait(false));
+
+        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
+        var profiles = new Dictionary<string, string?>(StringComparer.Ordinal);
+        foreach (var user in document.RootElement.GetProperty("data").EnumerateArray())
+        {
+            var userId = user.GetProperty("id").GetString();
+            if (string.IsNullOrWhiteSpace(userId)) continue;
+            profiles[userId] = user.TryGetProperty("profile_image_url", out var avatar)
+                ? avatar.GetString()
+                : null;
+        }
+
+        return profiles;
+    }
+
     private static async Task<string> ReadHelixErrorAsync(HttpResponseMessage response)
     {
         var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
         return $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {body.Replace('\n', ' ').Replace('\r', ' ').Trim()}";
     }
 
     private void AddHelixHeaders(HttpRequestMessage request)
     {
         request.Headers.TryAddWithoutValidation("Client-Id", TwitchConstants.ClientId);
         request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_accessToken}");
@@ -236,72 +265,24 @@ public sealed class TwitchIrcClient : ITwitchClient
             {
                 _sawMessage = true;
                 Info?.Invoke(new TwitchInfo("messages-flowing", null));
             }
             HandlePrivmsg(line);
         }
     }
 
     private void HandlePrivmsg(string line)
     {
-        var idx = line.IndexOf(" PRIVMSG ", StringComparison.Ordinal);
-        if (idx < 0) return;
-        var prefix = line[..idx];
-        var rest = line[(idx + 9)..];
-        var colon = rest.IndexOf(':');
-        if (colon < 0) return;
-        var message = rest[(colon + 1)..];
-
-        var sender = "unknown";
-        var bang = prefix.IndexOf('!');
-        if (bang > 0)
-        {
-            var nameStart = prefix.IndexOf(':');
-            sender = prefix[(nameStart + 1)..bang];
-        }
-
-        var isBroadcaster = false;
-        var isMod = false;
-        var isVip = false;
-        var isSubscriber = false;
-        if (prefix.StartsWith('@'))
+        if (TwitchPrivmsgParser.TryParse(line, DateTime.UtcNow, out var message))
         {
-            foreach (var tag in prefix[1..].Split(';'))
-            {
-                if (!tag.StartsWith("badges=", StringComparison.Ordinal)) continue;
-                foreach (var badge in tag[7..].Split(','))
-                {
-                    var parts = badge.Split('/');
-                    if (parts.Length != 2) continue;
-                    if (!int.TryParse(parts[1], out var version) || version <= 0) continue;
-                    switch (parts[0])
-                    {
-                        case "broadcaster": isBroadcaster = true; break;
-                        case "moderator": isMod = true; break;
-                        case "vip": isVip = true; break;
-                        case "subscriber": isSubscriber = true; break;
-                    }
-                }
-            }
+            ChatMessageReceived?.Invoke(message);
         }
-
-        ChatMessageReceived?.Invoke(new ChatMessage
-        {
-            Id = Guid.NewGuid().ToString(),
-            Username = sender,
-            IsBroadcaster = isBroadcaster,
-            IsMod = isMod,
-            IsVip = isVip,
-            IsSubscriber = isSubscriber,
-            Message = message,
-            Timestamp = DateTime.UtcNow.ToString("O"),
-        });
     }
 
     private async Task<bool> SendAsync(string text)
     {
         var writer = _writer;
         if (writer is null || _cts.IsCancellationRequested) return false;
         try
         {
             await writer.WriteLineAsync(text).ConfigureAwait(false);
             return true;
@@ -334,10 +315,79 @@ public sealed class TwitchIrcClient : ITwitchClient
             {
                 await _loop.ConfigureAwait(false);
             }
             catch
             {
             }
         }
         _cts.Dispose();
     }
 }
+
+public static class TwitchPrivmsgParser
+{
+    public static bool TryParse(string line, DateTime timestamp, [NotNullWhen(true)] out ChatMessage? message)
+    {
+        message = null;
+        var idx = line.IndexOf(" PRIVMSG ", StringComparison.Ordinal);
+        if (idx < 0) return false;
+        var prefix = line[..idx];
+        var rest = line[(idx + 9)..];
+        var colon = rest.IndexOf(':');
+        if (colon < 0) return false;
+        var messageText = rest[(colon + 1)..];
+
+        var sender = "unknown";
+        var bang = prefix.IndexOf('!');
+        if (bang > 0)
+        {
+            var nameStart = prefix.IndexOf(':');
+            sender = prefix[(nameStart + 1)..bang];
+        }
+
+        string? userId = null;
+        var isBroadcaster = false;
+        var isMod = false;
+        var isVip = false;
+        var isSubscriber = false;
+        if (prefix.StartsWith('@'))
+        {
+            foreach (var tag in prefix[1..].Split(';'))
+            {
+                if (tag.StartsWith("user-id=", StringComparison.Ordinal))
+                {
+                    userId = tag[8..];
+                    continue;
+                }
+
+                if (!tag.StartsWith("badges=", StringComparison.Ordinal)) continue;
+                foreach (var badge in tag[7..].Split(','))
+                {
+                    var parts = badge.Split('/');
+                    if (parts.Length != 2) continue;
+                    if (!int.TryParse(parts[1], out var version) || version <= 0) continue;
+                    switch (parts[0])
+                    {
+                        case "broadcaster": isBroadcaster = true; break;
+                        case "moderator": isMod = true; break;
+                        case "vip": isVip = true; break;
+                        case "subscriber": isSubscriber = true; break;
+                    }
+                }
+            }
+        }
+
+        message = new ChatMessage
+        {
+            Id = Guid.NewGuid().ToString(),
+            Username = sender,
+            UserId = string.IsNullOrWhiteSpace(userId) ? null : userId,
+            IsBroadcaster = isBroadcaster,
+            IsMod = isMod,
+            IsVip = isVip,
+            IsSubscriber = isSubscriber,
+            Message = messageText,
+            Timestamp = timestamp.ToString("O"),
+        };
+        return true;
+    }
+}
diff --git a/core/Twitch/TwitchUserProfileCache.cs b/core/Twitch/TwitchUserProfileCache.cs
new file mode 100644
index 0000000..7242ee2
--- /dev/null
+++ b/core/Twitch/TwitchUserProfileCache.cs
@@ -0,0 +1,107 @@
+namespace StreamerHub.Core.Twitch;
+
+public sealed record TwitchUserProfileResult(string UserId, string? AvatarUrl, bool ShouldLogFailure);
+
+public sealed class TwitchUserProfileCache
+{
+    private const int HelixMaxBatchSize = 100;
+    private readonly Dictionary<string, string?> _avatarUrls = new(StringComparer.Ordinal);
+    private readonly object _cacheLock = new();
+    private readonly HashSet<string> _loggedFailures = new(StringComparer.Ordinal);
+    private readonly SemaphoreSlim _resolveLock = new(1, 1);
+    private readonly int _maxBatchSize;
+
+    public TwitchUserProfileCache(int maxBatchSize = HelixMaxBatchSize)
+    {
+        if (maxBatchSize is < 1 or > HelixMaxBatchSize)
+        {
+            throw new ArgumentOutOfRangeException(nameof(maxBatchSize), $"Batch size must be between 1 and {HelixMaxBatchSize}.");
+        }
+
+        _maxBatchSize = maxBatchSize;
+    }
+
+    public bool TryGet(string userId, out string? avatarUrl)
+    {
+        if (string.IsNullOrWhiteSpace(userId))
+        {
+            avatarUrl = null;
+            return false;
+        }
+
+        lock (_cacheLock)
+        {
+            return _avatarUrls.TryGetValue(userId.Trim(), out avatarUrl);
+        }
+    }
+
+    public async Task<IReadOnlyList<TwitchUserProfileResult>> ResolveAsync(
+        IEnumerable<string> userIds,
+        Func<IReadOnlyList<string>, CancellationToken, Task<IReadOnlyDictionary<string, string?>>> fetchAsync,
+        CancellationToken cancellationToken)
+    {
+        ArgumentNullException.ThrowIfNull(userIds);
+        ArgumentNullException.ThrowIfNull(fetchAsync);
+
+        var requestedIds = userIds
+            .Where(userId => !string.IsNullOrWhiteSpace(userId))
+            .Select(userId => userId.Trim())
+            .Distinct(StringComparer.Ordinal)
+            .ToArray();
+
+        if (requestedIds.Length == 0) return Array.Empty<TwitchUserProfileResult>();
+
+        await _resolveLock.WaitAsync(cancellationToken).ConfigureAwait(false);
+        try
+        {
+            string[] missingIds;
+            lock (_cacheLock)
+            {
+                missingIds = requestedIds.Where(userId => !_avatarUrls.ContainsKey(userId)).ToArray();
+            }
+            foreach (var batch in missingIds.Chunk(_maxBatchSize))
+            {
+                cancellationToken.ThrowIfCancellationRequested();
+                IReadOnlyDictionary<string, string?> resolved;
+                try
+                {
+                    resolved = await fetchAsync(batch, cancellationToken).ConfigureAwait(false);
+                }
+                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
+                {
+                    throw;
+                }
+                catch
+                {
+                    resolved = new Dictionary<string, string?>(StringComparer.Ordinal);
+                }
+
+                lock (_cacheLock)
+                {
+                    foreach (var userId in batch)
+                    {
+                        _avatarUrls[userId] = resolved.TryGetValue(userId, out var avatarUrl) && !string.IsNullOrWhiteSpace(avatarUrl)
+                            ? avatarUrl
+                            : null;
+                    }
+                }
+            }
+
+            lock (_cacheLock)
+            {
+                return requestedIds
+                    .Select(userId =>
+                    {
+                        var avatarUrl = _avatarUrls[userId];
+                        var shouldLogFailure = avatarUrl is null && _loggedFailures.Add(userId);
+                        return new TwitchUserProfileResult(userId, avatarUrl, shouldLogFailure);
+                    })
+                    .ToArray();
+            }
+        }
+        finally
+        {
+            _resolveLock.Release();
+        }
+    }
+}
diff --git a/tests/StreamerHub.Task2Tests/Program.cs b/tests/StreamerHub.Task2Tests/Program.cs
new file mode 100644
index 0000000..a688587
--- /dev/null
+++ b/tests/StreamerHub.Task2Tests/Program.cs
@@ -0,0 +1,166 @@
+using StreamerHub.Core.Rpc;
+using StreamerHub.Core.Twitch;
+
+var failures = new List<string>();
+
+await RunAsync("parse_privmsg_extracts_user_id_and_preserves_flags_and_message", ParsePrivmsgExtractsUserIdAndPreservesFlagsAndMessageAsync);
+await RunAsync("profile_cache_batches_and_reuses_successful_lookups", ProfileCacheBatchesAndReusesSuccessfulLookupsAsync);
+await RunAsync("profile_cache_exposes_warmed_avatar_synchronously", ProfileCacheExposesWarmedAvatarSynchronouslyAsync);
+await RunAsync("profile_cache_logs_failures_once_per_user_session", ProfileCacheLogsFailuresOncePerUserSessionAsync);
+
+if (failures.Count > 0)
+{
+    foreach (var failure in failures)
+    {
+        Console.Error.WriteLine(failure);
+    }
+
+    Environment.ExitCode = 1;
+    return;
+}
+
+Console.WriteLine("PASS 4/4");
+
+async Task RunAsync(string name, Func<Task> test)
+{
+    try
+    {
+        await test().ConfigureAwait(false);
+        Console.WriteLine($"PASS {name}");
+    }
+    catch (Exception ex)
+    {
+        failures.Add($"FAIL {name}: {ex.Message}");
+    }
+}
+
+Task ParsePrivmsgExtractsUserIdAndPreservesFlagsAndMessageAsync()
+{
+    const string line = "@badge-info=subscriber/12;badges=broadcaster/1,moderator/1,vip/1,subscriber/12;color=#FF0000;display-name=Streamer;emotes=;first-msg=0;flags=;id=abc;mod=1;room-id=999;subscriber=1;tmi-sent-ts=1724716800000;turbo=0;user-id=424242;user-type=mod :streamer!streamer@streamer.tmi.twitch.tv PRIVMSG #room :hello there :wave";
+    var timestamp = new DateTime(2026, 8, 26, 12, 0, 0, DateTimeKind.Utc);
+
+    if (!TwitchPrivmsgParser.TryParse(line, timestamp, out ChatMessage? message))
+    {
+        throw new InvalidOperationException("expected the parser to recognize the PRIVMSG line");
+    }
+
+    AssertEqual("streamer", message.Username, "username");
+    AssertEqual("424242", message.UserId, "user-id");
+    AssertEqual("hello there :wave", message.Message, "message");
+    AssertTrue(message.IsBroadcaster, "broadcaster flag");
+    AssertTrue(message.IsMod, "moderator flag");
+    AssertTrue(message.IsVip, "vip flag");
+    AssertTrue(message.IsSubscriber, "subscriber flag");
+    AssertEqual(timestamp.ToString("O"), message.Timestamp, "timestamp");
+
+    return Task.CompletedTask;
+}
+
+async Task ProfileCacheBatchesAndReusesSuccessfulLookupsAsync()
+{
+    var requestedBatches = new List<string[]>();
+    var cache = new TwitchUserProfileCache(maxBatchSize: 2);
+
+    async Task<IReadOnlyDictionary<string, string?>> FetchAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken)
+    {
+        cancellationToken.ThrowIfCancellationRequested();
+        requestedBatches.Add(userIds.ToArray());
+        await Task.Yield();
+        return new Dictionary<string, string?>(StringComparer.Ordinal)
+        {
+            ["100"] = "https://cdn.example/100.png",
+            ["200"] = "https://cdn.example/200.png",
+            ["300"] = "https://cdn.example/300.png",
+        };
+    }
+
+    var first = await cache.ResolveAsync(new[] { "100", "200", "300" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
+    AssertEqual(2, requestedBatches.Count, "first lookup batch count");
+    AssertSequenceEqual(new[] { "100", "200" }, requestedBatches[0], "first lookup batch");
+    AssertSequenceEqual(new[] { "300" }, requestedBatches[1], "second lookup batch");
+    AssertEqual("https://cdn.example/200.png", first.Single(result => result.UserId == "200").AvatarUrl, "resolved avatar");
+
+    var second = await cache.ResolveAsync(new[] { "100", "300" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
+    AssertEqual(2, requestedBatches.Count, "cached lookups should not refetch successful IDs");
+    AssertEqual("https://cdn.example/100.png", second.Single(result => result.UserId == "100").AvatarUrl, "cached avatar");
+}
+
+async Task ProfileCacheExposesWarmedAvatarSynchronouslyAsync()
+{
+    var cache = new TwitchUserProfileCache();
+    await cache.ResolveAsync(
+        new[] { "100" },
+        (userIds, _) => Task.FromResult<IReadOnlyDictionary<string, string?>>(
+            new Dictionary<string, string?>(StringComparer.Ordinal)
+            {
+                [userIds.Single()] = "https://cdn.example/100.png",
+            }),
+        CancellationToken.None).ConfigureAwait(false);
+
+    AssertTrue(cache.TryGet("100", out var avatarUrl), "warmed avatar should be available synchronously");
+    AssertEqual("https://cdn.example/100.png", avatarUrl, "warmed avatar");
+}
+
+async Task ProfileCacheLogsFailuresOncePerUserSessionAsync()
+{
+    var fetchCount = 0;
+    var cache = new TwitchUserProfileCache();
+
+    async Task<IReadOnlyDictionary<string, string?>> FetchAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken)
+    {
+        cancellationToken.ThrowIfCancellationRequested();
+        fetchCount++;
+        await Task.Yield();
+        return new Dictionary<string, string?>(StringComparer.Ordinal);
+    }
+
+    var first = await cache.ResolveAsync(new[] { "404" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
+    var firstResult = first.Single();
+    AssertTrue(firstResult.ShouldLogFailure, "first missing avatar should log once");
+    AssertEqual(null, firstResult.AvatarUrl, "first missing avatar should fall back");
+
+    var second = await cache.ResolveAsync(new[] { "404" }, FetchAsync, CancellationToken.None).ConfigureAwait(false);
+    var secondResult = second.Single();
+    AssertFalse(secondResult.ShouldLogFailure, "second missing avatar should not log again");
+    AssertEqual(1, fetchCount, "missing avatar should be cached for the session");
+}
+
+static void AssertEqual<T>(T expected, T actual, string label)
+{
+    if (!EqualityComparer<T>.Default.Equals(expected, actual))
+    {
+        throw new InvalidOperationException($"{label}: expected '{expected}' but got '{actual}'");
+    }
+}
+
+static void AssertTrue(bool value, string label)
+{
+    if (!value)
+    {
+        throw new InvalidOperationException($"{label}: expected true");
+    }
+}
+
+static void AssertFalse(bool value, string label)
+{
+    if (value)
+    {
+        throw new InvalidOperationException($"{label}: expected false");
+    }
+}
+
+static void AssertSequenceEqual<T>(IReadOnlyList<T> expected, IReadOnlyList<T> actual, string label)
+{
+    if (expected.Count != actual.Count)
+    {
+        throw new InvalidOperationException($"{label}: expected {expected.Count} items but got {actual.Count}");
+    }
+
+    for (var i = 0; i < expected.Count; i++)
+    {
+        if (!EqualityComparer<T>.Default.Equals(expected[i], actual[i]))
+        {
+            throw new InvalidOperationException($"{label}: mismatch at index {i}; expected '{expected[i]}' but got '{actual[i]}'");
+        }
+    }
+}
diff --git a/tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj b/tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj
new file mode 100644
index 0000000..83bd8eb
--- /dev/null
+++ b/tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj
@@ -0,0 +1,14 @@
+<Project Sdk="Microsoft.NET.Sdk">
+
+  <PropertyGroup>
+    <OutputType>Exe</OutputType>
+    <TargetFramework>net8.0-windows</TargetFramework>
+    <ImplicitUsings>enable</ImplicitUsings>
+    <Nullable>enable</Nullable>
+  </PropertyGroup>
+
+  <ItemGroup>
+    <ProjectReference Include="..\..\core\StreamerHub.csproj" />
+  </ItemGroup>
+
+</Project>
