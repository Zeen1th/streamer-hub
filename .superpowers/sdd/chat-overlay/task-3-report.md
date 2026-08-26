# Task 3 Implementation Report: Local OBS Chat Overlay Server

Date: 2026-08-27

## Status

COMPLETE. Task 3 is implemented and verified in the `chat-overlay` worktree.

## Scope delivered

- Added a loopback-only `HttpListener` server that binds to `127.0.0.1` on an available ephemeral port.
- Added a local overlay URL and WebSocket URL, with the overlay URL exposed through the native `chat-overlay/get-url` RPC channel.
- Added HTTP routing for the overlay bootstrap and generated static assets.
- Rejected non-loopback clients, unsupported HTTP methods, non-WebSocket `/ws` requests, missing paths, and paths that resolve outside the asset root.
- Added a version 1 overlay protocol. Every envelope has `v`, `id`, `kind`, and `payload`.
- Added `hello`, `chat-message`, `settings`, `connected`, and `disconnected` protocol messages.
- Added multi-client WebSocket broadcasting with per-client send serialization and disconnected-client cleanup.
- Added bounded server-side chat message ID suppression (2,048 IDs) so duplicate messages are not delivered.
- Added reconnect behavior that sends current settings/connection state without replaying old chat messages.
- Added server stop/dispose behavior that closes the listener and active WebSockets.
- Wired server ownership into `MainForm`: startup occurs after native `wwwroot` is resolved, and shutdown is independent of host-controller disposal failures.
- Added a standalone React/Vite overlay page with no WebView RPC dependency.
- Added automatic WebSocket reconnection, client-side duplicate suppression, timed message expiry, stacked/latest modes, all persisted appearance settings, role accents, avatar fallback, reduced-motion support, and clear app-disabled/Twitch-disconnected/app-not-running recovery states.
- Added a Vite multi-page input and native content mapping that copies the generated overlay entry to `wwwroot/chat-overlay.html` while retaining generated assets under `wwwroot/assets`.

## Protocol shape

All WebSocket messages use this envelope:

```json
{
  "v": 1,
  "id": "stable-or-generated-message-id",
  "kind": "hello | chat-message | settings | connected | disconnected",
  "payload": {}
}
```

- `hello` carries current overlay settings and Twitch connection state.
- `chat-message` carries the existing normalized native `ChatMessage`; its envelope and payload retain the Twitch/fallback message ID.
- `settings` carries the current `ChatOverlaySettings` snapshot.
- `connected` and `disconnected` carry a boolean connection state.

## TDD evidence

### RED

The Task 3 native test project was created before implementation. After its one-time restore, the required failing run was:

```text
dotnet run --project tests\StreamerHub.Task3Tests\StreamerHub.Task3Tests.csproj --no-restore
CS0234: StreamerHub.Core.Overlay does not exist
CS0246: ChatOverlayServer could not be found
```

This confirmed the tests failed because the requested protocol/server implementation was absent.

### GREEN

Final server test result:

```text
PASS protocol_messages_are_versioned_and_identified
PASS http_bootstrap_is_loopback_only
PASS websocket_connect_receives_current_state
PASS broadcasts_chat_settings_and_connection_changes
PASS reconnect_gets_state_without_replaying_messages
PASS duplicate_chat_message_ids_are_suppressed
PASS server_stops_accepting_requests
All Task 3 overlay server tests passed.
```

The shutdown test accepts either immediate connection refusal or an intentionally cancelled pending Windows HTTP connection after `StopAsync`; in both cases the listener is no longer accepting requests and `Port` has reset to zero.

## Verification evidence

### Server tests

Command:

```text
dotnet run --project tests\StreamerHub.Task3Tests\StreamerHub.Task3Tests.csproj --no-restore
```

Result: 7 passed, 0 failed, no warnings.

### Existing chat overlay normalization regression tests

Command:

```text
node --test src\lib\chatOverlay.test.mjs
```

Result: 5 passed, 0 failed.

### Frontend production build

Command:

```text
npm run build
```

Result: success; Vite transformed 1,624 modules and emitted `dist/src/chat-overlay.html` plus the standalone overlay JavaScript, CSS, and local font assets.

### Native build

Command:

```text
dotnet build core\StreamerHub.csproj --no-restore -p:OutputPath=bin\ChatOverlayBuild\ -p:UseAppHost=false
```

Result:

```text
Build succeeded.
0 Warning(s)
0 Error(s)
```

The native output contains `core/bin/ChatOverlayBuild/wwwroot/chat-overlay.html` and the generated `chatOverlay-*` assets under `wwwroot/assets`.

## Files added

- `core/Overlay/ChatOverlayProtocol.cs`
- `core/Overlay/ChatOverlayServer.cs`
- `src/chat-overlay.html`
- `src/chat-overlay.tsx`
- `tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj`
- `tests/StreamerHub.Task3Tests/Program.cs`
- `.superpowers/sdd/chat-overlay/task-3-report.md`

## Files updated

- `core/MainForm.cs`
- `core/Host/HostController.cs`
- `core/Rpc/Envelope.cs`
- `core/StreamerHub.csproj`
- `vite.config.ts`

## Scope boundary for Task 4

Task 3 provides the server APIs for chat/settings/connection broadcasts and the native URL RPC. Per the approved plan, Task 4 still owns app-facing typed RPC hydration/settings-save contracts and forwarding live Twitch events into these server APIs.

## Concerns

- A fresh browser navigation cannot render an HTTP recovery page after the desktop process has exited because no process remains to answer the local URL. An already-loaded OBS browser source detects the WebSocket close, shows the explicit recovery message, and reconnects automatically when Streamer Hub returns.
- The workspace editing helper intermittently failed during implementation; the authorized direct-workspace fallback was used. Verification confirms the resulting files and builds are valid.
