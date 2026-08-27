# Task 1 report

## Scope
Implemented only Task 1: chat overlay contracts, persisted settings defaults/normalization, and pure frontend normalization helpers/tests.

## Files changed
- core/Rpc/Contracts.cs
- core/Storage/SettingsStore.cs
- src/rpc/contracts.ts
- src/lib/chatOverlay.ts
- src/lib/chatOverlay.test.mjs
- .superpowers/sdd/chat-overlay/task-1-report.md

## Decisions
- Added a shared ChatOverlaySettings contract on both native and TypeScript sides with one field vocabulary: enabled, maxMessages, durationSeconds, displayMode, fontSize, avatarSize, spacing, showUsernames, showAvatars, theme, messageStyle, animation.
- Kept ChatMessage identity additions optional by adding nullable/optional userId and avatarUrl only; population is deferred to later tasks.
- Implemented pure frontend helpers in src/lib/chatOverlay.ts for:
  - default overlay settings
  - bounded/clamped settings normalization
  - trimmed/capped message normalization
  - safe avatar URL normalization with a neutral embedded SVG fallback
- Added SettingsStore.ChatOverlay persistence with immutable get/set behavior and native-side normalization so older settings files hydrate safely when chatOverlay is absent or partial.
- Avoided unrelated behavior drift by leaving existing language hydration behavior intact after review.
- Used workspace context-mode file mutation as a fallback because the terminal/apply_patch helper was intermittently failing with setup refresh errors in this worktree.

## Test and command log
1. Added failing test first:
   - Command: node --test src/lib/chatOverlay.test.mjs
   - Result: failed as expected with ERR_MODULE_NOT_FOUND because src/lib/chatOverlay.ts did not exist yet.
2. Focused Task 1 test after implementation:
   - Command: node --test src/lib/chatOverlay.test.mjs
   - Result: PASS, 4/4 tests passed.
3. Existing frontend lib tests:
   - Command: node --test src/lib/*.test.mjs
   - Result: PASS, 19/19 tests passed.
4. Native build without restore:
   - Command: dotnet build core/StreamerHub.csproj --no-restore -p:OutputPath=bin/ChatOverlayBuild/ -p:UseAppHost=false
   - Result: failed with NETSDK1004 because core/obj/project.assets.json was missing in this worktree.
5. Native restore:
   - Command: dotnet restore core/StreamerHub.csproj
   - Result: PASS.
6. Native build after restore:
   - Command: dotnet build core/StreamerHub.csproj -p:OutputPath=bin/ChatOverlayBuild/ -p:UseAppHost=false
   - Result: PASS, 0 warnings, 0 errors.
7. Final re-verification after tightening SettingsStore load behavior:
   - Command: node --test src/lib/chatOverlay.test.mjs
   - Result: PASS, 4/4 tests passed.
   - Command: node --test src/lib/*.test.mjs
   - Result: PASS, 19/19 tests passed.
   - Command: dotnet build core/StreamerHub.csproj -p:OutputPath=bin/ChatOverlayBuild/ -p:UseAppHost=false
   - Result: PASS, 0 warnings, 0 errors.

## Output summary
- Focused Node tests: 4 passed, 0 failed.
- Existing Node lib tests: 19 passed, 0 failed.
- Native build: succeeded after restore; output at core/bin/ChatOverlayBuild/StreamerHub.dll.

## Concerns
- No functional blockers remain for Task 1.
- Bounds for overlay settings were inferred from the Task 1 tests/spec language because the spec names the settings but does not prescribe exact numeric ranges. Native and frontend normalization use the same ranges to keep behavior consistent.

## Review Round 1
- Reviewer finding: missing or blank chat message IDs collapsed to the shared fallback `chat-message`, which could collide across distinct overlay messages.
- Fix: preserve supplied IDs, derive deterministic fallback IDs from normalized user/content/timestamp data, and use `crypto.randomUUID()` only when there is no usable identity signal at all.
- Focused regression test added: `does not reuse fallback ids for distinct missing-id messages`.
- Command: `node --test src/lib/chatOverlay.test.mjs`
- Output:

```text
TAP version 13
# Subtest: exposes stable default chat overlay settings
ok 1 - exposes stable default chat overlay settings
# Subtest: clamps and sanitizes overlay settings
ok 2 - clamps and sanitizes overlay settings
# Subtest: falls back to defaults for invalid overlay settings
ok 3 - falls back to defaults for invalid overlay settings
# Subtest: normalizes chat messages and uses a neutral avatar fallback
ok 4 - normalizes chat messages and uses a neutral avatar fallback
# Subtest: does not reuse fallback ids for distinct missing-id messages
ok 5 - does not reuse fallback ids for distinct missing-id messages
1..5
# tests 5
# pass 5
# fail 0
```

## Review Round 2
- Reviewer finding: the prior fix still let identical missing-ID messages collide because fallback IDs were derived from normalized content, and the UUID branch was effectively unreachable.
- Fix: preserve any nonblank supplied ID exactly as provided, and generate a fresh `chat-<uuid>` fallback for every normalization call when the ID is missing or blank.
- Focused regression test updated: `does not reuse fallback ids for otherwise-identical missing-id messages`.
- Command: `node --test src/lib/chatOverlay.test.mjs`
- Output:

```text
TAP version 13
# Subtest: exposes stable default chat overlay settings
ok 1 - exposes stable default chat overlay settings
# Subtest: clamps and sanitizes overlay settings
ok 2 - clamps and sanitizes overlay settings
# Subtest: falls back to defaults for invalid overlay settings
ok 3 - falls back to defaults for invalid overlay settings
# Subtest: normalizes chat messages and uses a neutral avatar fallback
ok 4 - normalizes chat messages and uses a neutral avatar fallback
# Subtest: does not reuse fallback ids for otherwise-identical missing-id messages
ok 5 - does not reuse fallback ids for otherwise-identical missing-id messages
1..5
# tests 5
# pass 5
# fail 0
```
