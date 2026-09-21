# Streamer Hub: Technical & Architecture Handoff

**Version:** `v0.3.6`  
**Repository:** [Zeen1th/streamer-hub](https://github.com/Zeen1th/streamer-hub)  
**Target Platform:** Windows 10/11 (64-bit), Microsoft WebView2 Runtime, OBS Studio 28+  

---

## 1. System Overview & Architecture

Streamer Hub is a local-first desktop companion for Twitch broadcasters. The system consists of two primary layers connected by a typed JSON-RPC communication bridge:

```
┌────────────────────────────────────────────────────────┐
│                   Desktop Host (.NET 8)                │
│                                                        │
│  - Form & WebView2 Shell (MainForm.cs)                 │
│  - Host Controller (HostController.cs)                 │
│  - Twitch IRC & Helix Client (TwitchIrcClient.cs)      │
│  - Local HTTP & WebSocket Server (ChatOverlayServer)   │
│  - Plain-text File Synchronizer & JSON Store           │
└───────────────▲────────────────────────▲───────────────┘
                │ Typed RPC (JSON/IPC)   │ WebSocket / HTTP
┌───────────────▼────────────────────────▼───────────────┐
│               Frontend & Web Endpoints                 │
│                                                        │
│  - In-App UI: React 19 + TypeScript + Tailwind         │
│  - OBS Overlay: http://127.0.0.1:49178/chat-overlay    │
│  - OBS Dock:    http://127.0.0.1:49178/obs-chat.html   │
└────────────────────────────────────────────────────────┘
```

### 1.1 Desktop Host Layer (`core/`)
- **Runtime**: .NET 8 Windows Forms, PerMonitorV2 High DPI mode, C# 12 nullable enabled.
- **WebView2 Browser**: Embedded Edge/Chromium runtime with transparent background support and hardware acceleration.
- **Local HTTP / WebSocket Server (`ChatOverlayServer.cs`)**:
  - Binds strictly to `http://127.0.0.1:49178/`.
  - Serves static build assets from `dist/` (or `wwwroot/`).
  - Broadcasts chat messages, settings changes, and clear events via WebSockets to connected OBS browser sources and custom docks.

### 1.2 Frontend Application (`src/`)
- **Framework**: React 19, TypeScript 5, Vite 6, Tailwind CSS 3.
- **State Management**: Zustand stores with localized localStorage caching:
  - `obsChatStore.ts`: Manages dock messages, dock settings, and moderation commands.
  - `chatOverlayStore.ts`: Manages canvas layers, design tokens, presets, and multi-overlay instances.
  - `autoReplyStore.ts`: Manages automated chat triggers and rule matching.
  - `sequenceStore.ts`: Manages multi-step macro sequences.
  - `connectionStore.ts`: Tracks Twitch broadcaster and bot connection states.

---

## 2. Core Features & Key Subsystems

### 2.1 OBS Streamer Chat Dock (`/obs-chat.html`) & Chat Tab
- **Purpose**: A low-latency chat client designed specifically for streamers to dock inside OBS Studio (**Docks -> Custom Browser Docks...**) or keep on a second monitor.
- **Bottom-to-Up Layout**:
  - Implemented using flex column reverse-flow geometry:
    ```tsx
    <div className="min-h-full flex flex-col justify-end">
      <div className="flex-1 min-h-0" />
      <div className="space-y-1">
        {messages.map((m) => <ChatMessageRow key={m.id} message={m} />)}
      </div>
    </div>
    ```
  - When chat is quiet, messages remain at the bottom above the input box rather than floating at the top.
  - As new messages arrive, they slide upward with `animate-chat-in` (translateY from 6px to 0px over 140ms).
- **Streamer Self-Sent Messages (`PublishSelfChatMessage`)**:
  - Twitch IRC does not echo a client's own `PRIVMSG` back to the sender.
  - In `HostController.cs`, `SendChatMessageCoreAsync` immediately broadcasts the outgoing message locally with `isSelf: true`:
    - Posted to the in-app Chat tab via `Events.TwitchChatMessage`.
    - Pushed to the WebSocket server to update all open OBS docks and overlays.
  - `autoReplyStore` ignores `isSelf: true` messages to prevent automated infinite loops.
- **Username Luminance Scaling**:
  - User-selected Twitch name colors frequently fail contrast checks on dark backgrounds.
  - `ensureReadableColor(hex)` computes relative luminance $Y = 0.2126R + 0.7152G + 0.0722B$.
  - If $Y < 0.35$, RGB values are scaled upward proportionally along their hue vector to guarantee $\ge 4.5:1$ contrast against the dark background.
- **Bilingual Font Rendering**:
  - Arabic text uses `Cairo` (`sans-serif`).
  - English and numbers use `Barlow` (`sans-serif`).
  - Mixed BiDi messages render with natural unicode bidirectional isolation.

### 2.2 Streamer Quick Moderation Tools & Robust Timeout Architecture
- Every message row features a hover action bar with 5 immediate moderation tools:
  1. **Mention** (`#38bdf8`): Copies `@username` into the chat input field.
  2. **Shoutout** (`#a855f7`): Dispatches `POST /helix/chat/shoutouts`.
  3. **Timeout 60s** (`#f59e0b`): Dispatches `POST /helix/moderation/bans` with `duration: 60`.
  4. **Ban** (`#f43f5e`): Dispatches `POST /helix/moderation/bans` without duration.
  5. **Delete** (`#ef4444`): Dispatches `DELETE /helix/moderation/chat` with `message_id`.
- **Direct User ID Resolution & Chatter Mapping**:
  - UI action buttons pass `message.userId || message.userLogin || message.username` directly, avoiding unnecessary username-to-ID network calls.
  - The host maintains an in-memory `_knownChatters` dictionary mapping `userId`, `userLogin`, `displayName`, and normalized Arabic display names from incoming IRC `PRIVMSG` tags. Non-broadcaster chatters with Arabic or non-ASCII names are resolved immediately without relying on `/helix/search/channels` (which only indexes broadcasters).
- **Automatic OAuth Token Refresh on HTTP 401**:
  - Twitch user access tokens expire after ~4 hours. While the IRC TCP connection stays open via PING/PONG, Helix HTTP calls would fail with HTTP 401 Unauthorized.
  - All Helix requests are executed through `SendHelixWithRetryAsync`, catching 401 responses, invoking `TokenRefreshRequested`, persisting the refreshed token to disk via DPAPI, updating the in-memory bearer token, and retrying the request seamlessly.
- **Resilient Moderator Timeout (`SmartModTimeoutAsync`)**:
  - Direct timeout is attempted first. If Twitch reports the user is a moderator, they are temporarily unmodded.
  - A 4-step progressive propagation delay (`[1000, 1200, 1500, 2000] ms`) accommodates Twitch edge cluster sync delays before re-attempting timeout.
  - On timeout failure, moderator status is rolled back immediately (or enqueued to `_remodManager` for persistent retry).
  - Once timed out, remodding is scheduled with a safety buffer after the timeout expires.
- **ChatClear Synchronization & CLEARCHAT Tag Fallback**:
  - `TwitchClearParser` supports standard `target-user-id` tags as well as trailing `:targetuser` IRC parameters, preventing whole-room wipes when target tags are omitted by Twitch.
  - Chat clear logic in `obsChatStore.ts` and `chatOverlayStore.ts` matches against `userId`, `username`, `userLogin`, and `displayName`, ensuring timed-out chatter messages are instantly removed regardless of display language or IRC casing.
- **Activity Logging**:
  - Failed moderation calls are logged via `Log("moderation", ...)` in `HostController.cs` and displayed in the UI Activity Log.

### 2.3 Multi-Overlay Profile Manager (`ChatOverlayBar.tsx`)
- Located above the chat overlay canvas editor in the **Overlay** tab.
- Allows streamers to maintain multiple separate overlay designs (e.g. "Default", "Gameplay Minimal", "Just Chatting Box").
- URL format:
  - Default: `http://127.0.0.1:49178/chat-overlay.html`
  - Profile: `http://127.0.0.1:49178/chat-overlay.html?id=<overlayId>`
- Provides 1-click **Copy URL**, **Copy Settings**, **Paste Settings**, **Rename**, and **Delete**.

### 2.4 One-Time Re-authentication Prompt Modal (`ReauthPromptModal.tsx`)
- **Background**: Twitch Helix `POST /helix/moderation/bans` requires the `moderator:manage:banned_users` OAuth scope. Users who authenticated on earlier releases hold tokens lacking this permission, causing bans and timeouts to fail with HTTP 403 Forbidden.
- **Behavior**:
  - Automatically mounts in `App.tsx`.
  - Checks `localStorage.getItem('streamer-hub-reauth-prompt-v0.3.0')`.
  - If missing, presents a clean, informative dialog with a direct **Re-authenticate with Twitch** action (`rpc.invoke(Channels.TwitchAuthorize)`).
  - Sets the storage key to `'true'` upon dismissal or authorization so it is shown only once.

### 2.5 AI Reply Studio & Persona Engine
- **Agent Identity & Persona Customization**:
  - AI replies feature structured persona inputs:
    - `agentName`: Identity acknowledged by the model when replying or mentioning itself.
    - `agentRole`: Personality, style, tone, and character background.
    - `agentContext`: Stream rules, lore, inside jokes, and broadcaster facts.
    - `aiInstructions`: Custom behavioral guidelines and output constraints.
  - Persisted reliably to disk through the `AutoRepliesSave` channel.
- **Arrodes (`🪞 أروديس`) Exclusive Preset**:
  - Features the omniscient silver mirror from *Lord of the Mysteries* as the primary built-in persona preset with rich Arabic and English stream context.
- **Custom Persona Presets**:
  - Saved to persistent local storage (`streamer-hub-ai-custom-presets`).
  - Supports 1-click application, instant disk flushing, and deletion.
- **Integrated AI Global Cooldowns**:
  - Master protection controls (`globalAiCooldownSeconds` and `globalAiUserCooldownSeconds`) are accessible directly inside:
    1. **AI Reply Studio (`AiReplyStudioView.tsx`)**: Full sliders, numeric inputs, and preset chips.
    2. **Reply Inspector (`CommandsView.tsx`)**: Quick-edit card when selecting any AI reply.
    3. **AI Command Toolbar (`CommandsView.tsx`)**: Top header banner when viewing `group === 'ai'`.
- **Anti-Duplicate Multi-Reply Guard**:
  - In-flight message tracking in `AutoRepliesGenerate` and frontend stores rejects duplicate trigger events during message bursts.
- **Bot Account Sender Selection**:
  - Automatic resolution between Broadcaster and Bot account tokens with debug switching support.

### 2.6 Prepared Replies, Commands & Title Changer Execution
- **Broadcaster Command Support**:
  - Previously, incoming broadcaster IRC messages were marked `isSelf = true` in `HostController.cs` and ignored by `isSenderIgnoredForAutoReply`. Broadcasters are now permitted to trigger their own commands, auto-replies, and title changer updates directly from Twitch chat.
- **Robust Command Matching (`matchesAutoReply`)**:
  - **Case-Insensitive**: Matches regardless of chatter casing (e.g. `!Discord` matches `!discord`).
  - **Command Prefix Flexibility**: Allows triggers configured with or without leading `!` (e.g., `discord` matches `!discord`, and `!discord` matches `discord`).
  - **Command Arguments**: Supports trailing parameters and mentions (e.g., `!discord @viewer`).
  - **Counter Deltas**: Supports trailing values (e.g., `!death+ 1`, `!death+1`, `!death- 2`).
- **Loop Prevention**:
  - Only synthetic messages generated locally by the app (`PublishSelfChatMessage`, `id: self-*`, `isSelf: true`) and messages originating from the connected bot account are ignored, preventing echo loops while leaving human chatters and the broadcaster fully operational.

---

## 3. Communication Channels & RPC Reference

| Channel Name | Direction | Payload | Description |
|---|---|---|---|
| `twitch/send-chat-message` | Frontend -> Host | `{ message: string }` | Sends chat message from broadcaster or bot |
| `twitch/moderation/timeout` | Frontend -> Host | `{ target: string, durationSeconds?: number, reason?: string }` | Times out a viewer via Helix API |
| `twitch/moderation/ban` | Frontend -> Host | `{ target: string, reason?: string }` | Bans a viewer via Helix API |
| `twitch/moderation/delete-message` | Frontend -> Host | `{ messageId: string }` | Deletes a message via Helix API |
| `twitch/moderation/shoutout` | Frontend -> Host | `{ target: string }` | Sends Twitch shoutout via Helix API |
| `twitch/chat-message` | Host -> Frontend | `ChatMessage` | Broadcasts incoming (and self-sent) chat messages |
| `twitch/chat-cleared` | Host -> Frontend | `{ scope: 'message' \| 'user' \| 'all', id?: string }` | Notifies clients to clear or hide messages |
| `chat-overlay/get-url` | Frontend -> Host | `{ overlayId?: string }` | Retrieves the loopback URL for an overlay |
| `obs-chat/get-dock-url` | Frontend -> Host | `void` | Retrieves the loopback URL for the OBS chat dock |

---

## 4. Directory Structure

```
├── .github/
│   └── workflows/
│       └── release.yml              # CI/CD: build Windows installer and publish GitHub release
├── assets/                          # Application icons and branding assets
├── core/                            # C# .NET 8 Windows Forms host
│   ├── AI/                          # OpenRouter & Groq API clients
│   ├── Host/
│   │   ├── HostController.cs        # Primary RPC dispatcher and coordinator
│   │   └── ChatOverlayHostBridge.cs # Bridge between storage and overlay server
│   ├── Obs/                         # Text file synchronization logic
│   ├── Overlay/
│   │   ├── ChatOverlayServer.cs     # EmbedIO/Kestrel HTTP & WebSocket server
│   │   └── ChatOverlayProtocol.cs   # WebSocket wire protocol serialization
│   ├── Rpc/                         # JSON-RPC boundary contracts & envelopes
│   ├── Storage/
│   │   └── SettingsStore.cs         # DPAPI-encrypted token store and JSON settings
│   ├── Twitch/
│   │   ├── TwitchAuth.cs            # OAuth PKCE, tokens, and Helix scopes
│   │   ├── TwitchIrcClient.cs       # Twitch IRC socket and Helix moderation client
│   │   └── TwitchUserProfileCache.cs# Avatar & color cache with disk fallback
│   ├── MainForm.cs                  # Frameless Windows Form & WebView2 wrapper
│   └── StreamerHub.csproj           # C# project definition
├── installer/
│   └── StreamerHub.iss              # Inno Setup Windows installer script
├── src/                             # React 19 TypeScript frontend
│   ├── components/
│   │   ├── commands/                # Commands, auto-replies, and sequences views
│   │   ├── layout/                  # Sidebar, action bar, and layout frames
│   │   ├── modals/
│   │   │   └── ReauthPromptModal.tsx# Version upgrade Twitch permissions prompt
│   │   ├── titlebar/                # Frameless titlebar, status, and resize handles
│   │   ├── tools/
│   │   │   ├── chat/
│   │   │   │   ├── ChatCanvas.tsx   # Visual overlay canvas with drag handles
│   │   │   │   ├── ChatOverlayBar.tsx# Multi-overlay profile switcher
│   │   │   │   ├── ChatSettingsPanel.tsx# Overlay visual token properties inspector
│   │   │   │   ├── ChatView.tsx     # Overlay designer tab container
│   │   │   │   └── ObsChatView.tsx  # In-app chat reader mirroring OBS dock
│   │   │   ├── counter/             # Counters view and activity log
│   │   │   ├── home/                # Stream dashboard overview
│   │   │   └── settings/            # Settings, themes, and accounts
│   │   └── ui/                      # Reusable UI primitives (Button, Input, Switch)
│   ├── i18n/
│   │   └── translations.ts          # English & Arabic bilingual translations
│   ├── lib/                         # Pure utility functions and rule engines
│   ├── rpc/                         # Frontend RPC client and mock host harness
│   ├── store/                       # Zustand application state stores
│   ├── App.tsx                      # Root application component
│   ├── chat-overlay.html            # OBS browser source HTML entrypoint
│   ├── chat-overlay.tsx             # OBS browser source overlay renderer
│   ├── obs-chat.html                # OBS custom browser dock HTML entrypoint
│   └── obs-chat.tsx                 # OBS custom browser dock renderer
├── package.json
└── vite.config.ts
```

---

## 5. Development & Testing Workflow

### 5.1 Local Development
```pwsh
# 1. Run frontend in standalone browser mock mode (vite dev server with mock RPC host)
npm run dev

# 2. Run unit tests (Node.js test runner)
npm test

# 3. Typecheck TypeScript codebase
npx tsc -b

# 4. Run C# backend integration test suites
dotnet run --project tests/StreamerHub.Task2Tests/StreamerHub.Task2Tests.csproj
dotnet run --project tests/StreamerHub.Task3Tests/StreamerHub.Task3Tests.csproj
dotnet run --project tests/StreamerHub.Task4Tests/StreamerHub.Task4Tests.csproj
```

### 5.2 Building & Releasing
To create a production desktop build locally:
```pwsh
# Run the automated build script (builds frontend into dist/ then builds .NET solution)
.\run.bat
```

To ship a release to users:
```pwsh
# 1. Bump version in package.json, core/StreamerHub.csproj, and Titlebar.tsx
# 2. Commit and tag:
git commit -m "feat: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# 3. Push commit and tag:
git push origin main
git push origin vX.Y.Z
```
GitHub Actions will automatically build the Windows binaries, compile the Inno Setup installer, and publish the release with assets attached.
