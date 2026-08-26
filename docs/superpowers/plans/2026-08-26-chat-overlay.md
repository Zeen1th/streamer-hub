# Chat Overlay Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Add a customizable Twitch chat display inside Streamer Hub and as a local OBS Browser Source, showing usernames, messages, and profile avatars without changing existing feed, trigger, counter, or connection behavior.

Architecture: Extend the Twitch IRC message contract with optional user ID and avatar URL. Resolve avatars through Helix in the native host with an in-memory user-ID cache. Add a loopback-only HTTP/WebSocket overlay server owned by the native host; it serves a bundled overlay page and broadcasts normalized chat messages plus overlay settings. Add a Chat navigation view with a live preview and persisted settings. Keep the overlay disabled until enabled in Chat settings, and keep a recovery shell available when the desktop app is not running.

Tech Stack: .NET 8 WinForms, HttpListener WebSocket server, Twitch IRC/Helix, React 19, Zustand, Vite, TypeScript, existing RPC/event bridge, Node test runner.

Spec: docs/superpowers/specs/2026-08-26-chat-overlay-design.md

## Global Constraints

- Preserve existing Feed, trigger, counter, AI, Twitch authorization, tray, and update behavior.
- Bind the OBS server to loopback only; do not expose it on the LAN.
- Avatar lookup failures must never block delivery of the chat message beyond a short bounded request.
- Use stable Twitch user IDs for avatar caching and a neutral fallback when the URL is absent or invalid.
- Overlay settings must hydrate safely for existing settings files that predate this feature.
- The main app and overlay must avoid duplicating messages after WebSocket reconnects.
- Add tests before implementation for pure normalization, default settings, and WebSocket/reconnect behavior.
- Never put API keys or Twitch secrets in frontend code, overlay URLs, logs, or committed files.

---

## Task 1: Add contracts and persisted overlay settings

Files: core/Rpc/Contracts.cs, core/Storage/SettingsStore.cs, src/rpc/contracts.ts, new src/lib/chatOverlay.ts, new src/lib/chatOverlay.test.mjs

- [ ] Write failing tests for default settings, bounds/clamping, message normalization, and avatar fallback.
- [ ] Run node --test src/lib/chatOverlay.test.mjs and confirm failure.
- [ ] Add ChatOverlaySettings with enabled, maxMessages, durationSeconds, displayMode, fontSize, avatarSize, spacing, showUsernames, showAvatars, theme, messageStyle, and animation.
- [ ] Add optional UserId and AvatarUrl to native and TypeScript ChatMessage contracts.
- [ ] Add safe defaults and immutable get/set methods to SettingsStore; old JSON must deserialize with defaults.
- [ ] Implement pure normalization helpers that trim fields, cap display data, validate settings, and select a neutral avatar fallback.
- [ ] Run the new tests and node --test src/lib/*.test.mjs.
- [ ] Commit: Add chat overlay contracts and settings.

## Task 2: Extend Twitch identity data and avatar resolution

Files: core/Twitch/TwitchIrcClient.cs, core/Twitch/ITwitchClient.cs, core/Host/HostController.cs, new core/Twitch/TwitchUserProfileCache.cs, and native tests or a pure helper test if native test infrastructure is unavailable.

- [ ] Add a failing test for parsing IRC user-id tags while preserving permission flags and message text.
- [ ] Parse user-id from PRIVMSG without changing existing matching or permission behavior.
- [ ] Add a bounded Helix users lookup accepting user IDs, returning profile image URLs, and caching by ID for the current session.
- [ ] Emit normalized messages promptly; avatar enrichment may arrive afterward and failures must use fallback and be logged at most once per user/session.
- [ ] Preserve broadcaster and bot authorization/client-ID behavior.
- [ ] Run parser/cache tests and the native build.
- [ ] Commit: Add Twitch chat identity and avatar enrichment.

## Task 3: Implement the loopback OBS overlay server

Files: new core/Overlay/ChatOverlayServer.cs, new core/Overlay/ChatOverlayProtocol.cs, core/MainForm.cs, core/Host/HostController.cs, core/StreamerHub.csproj, new src/chat-overlay.html, new src/chat-overlay.tsx, vite.config.ts.

- [ ] Write failing protocol/server tests for HTTP bootstrap, loopback binding, WebSocket connect, message delivery, settings update, reconnect, and duplicate suppression.
- [ ] Build a Vite multi-page entry for chat-overlay.html that emits a standalone production bundle copied into native wwwroot.
- [ ] Implement HttpListener on 127.0.0.1 using an available local port; return the overlay URL through RPC.
- [ ] Serve the overlay page and WebSocket endpoint, rejecting non-loopback requests and unsupported paths/methods.
- [ ] Broadcast versioned hello, chat-message, settings, connected, and disconnected messages with message IDs.
- [ ] Stop and dispose the server during app shutdown; when the app is not running, show a clear recovery message.
- [ ] Run server tests, npm run build, and dotnet build core\\StreamerHub.csproj --no-restore -p:OutputPath=bin\\ChatOverlayBuild\\ -p:UseAppHost=false.
- [ ] Commit: Add local OBS chat overlay server.

## Task 4: Connect native events and overlay RPC

Files: core/Host/HostController.cs, core/MainForm.cs, src/rpc/contracts.ts, src/rpc/mockHost.ts.

- [ ] Add failing RPC/event tests for state hydration, settings save, URL retrieval, and live forwarding.
- [ ] Register ChatOverlayGetState, ChatOverlaySaveSettings, and ChatOverlayGetUrl channels with typed payloads.
- [ ] Start the server during host initialization, pass settings and normalized Twitch messages, and broadcast connection state.
- [ ] Preserve existing Feed/log/counter/trigger handling while publishing each chat message to the overlay.
- [ ] Return safe disconnected state and retain the overlay shell during reconnects.
- [ ] Update mock host for browser/dev mode.
- [ ] Run frontend and native tests/builds.
- [ ] Commit: Wire chat overlay into host events and RPC.

## Task 5: Add Chat navigation, preview, and customization UI

Files: src/store/toolStore.ts, src/components/layout/Sidebar.tsx, src/App.tsx, new src/store/chatOverlayStore.ts, new src/components/tools/chat/ChatView.tsx, new src/components/tools/chat/ChatPreview.tsx, new src/components/tools/chat/ChatSettingsPanel.tsx, src/index.css, src/i18n/translations.ts.

- [ ] Add failing store/component tests for hydration, insertion, max-message trimming, duration removal, display mode, and reconnect state.
- [ ] Register Chat without disturbing Feed.
- [ ] Build a clear Chat page with live preview, enable switch, connection state, and copyable OBS URL.
- [ ] Add controls for max messages, duration, stacked/newest-only, font/avatar size, spacing, username/avatar visibility, theme, message shape, and animation.
- [ ] Persist through native RPC and update preview and future overlay clients.
- [ ] Add English and Arabic labels/help text with direction-safe message rendering; preserve title bar/window controls.
- [ ] Include empty, disconnected, avatar-fallback, and server-unavailable states.
- [ ] Run npm run typecheck, npm run build, and node --test src/lib/*.test.mjs.
- [ ] Commit: Add customizable Chat overlay page.

## Task 6: End-to-end verification and release readiness

Files: README.md, PRODUCT.md if feature documentation belongs there, and tests under src/lib and core.

- [ ] Test migration from a settings file without overlay settings; verify defaults and unchanged counters/triggers.
- [ ] Test a real Twitch message with user ID, cache hit/miss, disconnect/reconnect, and duplicate message ID.
- [ ] Test the overlay at narrow and wide sizes, transparent and themed backgrounds, Arabic/English, long usernames/messages, and no-avatar fallback.
- [ ] Test app close/reopen and server shutdown/restart behavior.
- [ ] Run npm run typecheck, npm run build, node --test src/lib/*.test.mjs, and dotnet build core\\StreamerHub.csproj --no-restore -p:OutputPath=bin\\ChatOverlayVerify\\ -p:UseAppHost=false.
- [ ] Document copying the OBS URL, enabling the overlay, and troubleshooting when Streamer Hub is closed.
- [ ] Commit: Document chat overlay setup and verification.

## Verification commands

- npm run typecheck
- npm run build
- node --test src/lib/*.test.mjs
- dotnet build core\\StreamerHub.csproj --no-restore -p:OutputPath=bin\\ChatOverlayVerify\\ -p:UseAppHost=false
