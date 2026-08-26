# Task 2 report

## Status

Completed on August 27, 2026.

## Implementation

- Added `TwitchPrivmsgParser` and routed IRC `PRIVMSG` handling through it.
  - Parses the Twitch `user-id` tag into `ChatMessage.UserId`.
  - Preserves the existing username extraction, broadcaster/mod/VIP/subscriber badge rules, message text (including additional colons), ID generation, and timestamp format.
- Added `TwitchUserProfileCache`.
  - Deduplicates IDs, bounds Helix-compatible batches to at most 100 IDs, and caches both successful and missing profiles for the application session.
  - Serializes fetches and synchronizes cache reads/writes.
  - Marks only the first failed or missing lookup per user for logging.
- Added `ITwitchClient.GetUserProfileImagesAsync` and implemented the bounded Helix `users?id=...` lookup in `TwitchIrcClient`.
  - Uses the existing broadcaster access token and `TwitchConstants.ClientId` through the unchanged `AddHelixHeaders` path.
- Updated `HostController` to publish every chat message immediately and exactly once.
  - A cached avatar is attached synchronously when available.
  - An uncached user lookup runs in the background; the already-published message keeps its null-avatar fallback, and later messages from that user reuse the cached URL.
  - Lookup failures keep the fallback and log at most once per user/session.
  - Bot client and broadcaster/bot authorization behavior were not changed.
- Added the focused native Task 2 harness and ignored its generated `bin/obj` output.

## Red phase

Command:

`dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj`

Observed before production implementation:

```text
CS0103: TwitchPrivmsgParser does not exist
CS0246: TwitchUserProfileCache could not be found
EXIT=1
```

A second focused red cycle removed the synchronous cache-read helper after adding its test and produced:

```text
CS1061: TwitchUserProfileCache does not contain a definition for TryGet
EXIT=1
```

## Focused tests

Command:

`dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj`

Output:

```text
PASS parse_privmsg_extracts_user_id_and_preserves_flags_and_message
PASS profile_cache_batches_and_reuses_successful_lookups
PASS profile_cache_exposes_warmed_avatar_synchronously
PASS profile_cache_logs_failures_once_per_user_session
PASS 4/4
EXIT=0
```

## Native build

Command:

`dotnet build core\StreamerHub.csproj --no-restore -p:OutputPath=bin\ChatOverlayVerify\ -p:UseAppHost=false`

Output:

```text
Build succeeded.
    0 Warning(s)
    0 Error(s)
EXIT=0
```

## Tooling note

The normal Windows patch helper still failed with `helper_unknown_error: setup refresh had errors`. The implementation was completed through guarded direct workspace writes that required exact source matches and preserved existing line endings.
