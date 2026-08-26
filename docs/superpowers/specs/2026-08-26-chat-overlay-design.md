# Chat Read Overlay Design

## Goal

Add a customizable live chat display that shows Twitch messages with the viewer's username, message, and Twitch profile avatar. Streamers can view it inside Streamer Hub and add a transparent local URL to OBS as a Browser Source.

## User experience

- Add a Chat section to the app navigation.
- Show recent live messages with avatar, username, and message.
- Add an Overlay settings area with a copyable OBS URL.
- Provide an empty/disconnected state when Twitch is not connected.
- Preserve the existing Feed, trigger, counter, and Twitch connection behavior.

## Customization

Persist overlay settings with safe defaults:

- Maximum visible messages
- Message duration
- Display mode: stacked recent messages or newest message only
- Font size
- Avatar size
- Message spacing
- Show/hide usernames
- Show/hide avatars
- Theme: light, dark, or transparent
- Message shape: rounded or square
- Optional enter/exit animation

The overlay is disabled until the streamer opens or enables it, and it must not alter existing chat automation.

## Architecture

- The native host serves a local HTTP endpoint for the overlay page and a WebSocket channel for live message events.
- The existing Twitch IRC client supplies message text, username, and Twitch user ID.
- The native host resolves profile avatars through Twitch's users endpoint using the existing authenticated Twitch connection.
- Avatars are cached by Twitch user ID for the current session and reused by the overlay.
- The overlay receives normalized chat messages through the WebSocket channel.
- If avatar lookup fails or no avatar is available, the UI uses a neutral placeholder.
- The local endpoint binds to loopback only and does not expose the streamers chat publicly.

## Data and persistence

- Add optional avatar/user-id fields to the chat message contract.
- Add persisted chat overlay settings to the existing settings document and RPC hydration/save flow.
- Existing settings files without overlay settings hydrate with defaults.
- Settings changes update the in-app preview and future overlay messages.

## Error and lifecycle behavior

- If Twitch disconnects, the overlay keeps its shell and shows a disconnected state.
- If the WebSocket reconnects, it resumes receiving new messages without duplicating old messages.
- Avatar failures never prevent a chat message from appearing.
- Closing Streamer Hub stops the local overlay server.
- The overlay URL must show a clear recovery message if the app is not running.

## Verification

- Test chat message normalization and avatar fallback.
- Test overlay settings persistence and default hydration.
- Test WebSocket message delivery and reconnect behavior.
- Verify the Chat page and overlay at narrow and wide window sizes.
- Verify the OBS URL can load from the same Windows machine.
- Run frontend tests/build and native build before release.
