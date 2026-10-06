# Streamer Hub: Technical & Architecture Handoff
 
**Version:** `v0.4.8`  
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

### 2.6c Sequence If / Else Steps
- New step type `if` (`SequenceStep.ifCondition/ifOption/ifThen/ifElse`, mirrored in `core/Rpc/Contracts.cs`). It checks the result of the nearest earlier duel / streamer-duel / poll step and runs the Then (true) or Else (false) list; branches can hold any step except another If.
- The runner (`executeSequence` -> inner `runSteps`) **waits** for the game to finish (cap `IF_WAIT_CAP_MS` = 15 min). Duel outcomes come from `duelGameManager.startDuel().outcome` (win/loser/challengerWon, `no_winner`, or `null` when cancelled); polls use `waitForPollOutcome` + `evaluatePollOutcome` (winner / tie / none). No usable result (no earlier game, cancelled, mismatched condition) skips the If and logs why.
- Conditions: `duel_challenger_won`, `duel_opponent_won` (= streamer won in a streamer duel), `duel_no_winner`, `poll_winner_is` (+`ifOption`), `poll_tie`, `poll_no_votes`.
- UI: `SequenceStudioView.tsx` `EditSubActionModal` (If section + `IfBranchEditor`); Done is disabled until a game step exists above. In the sub-action list the If row shows its Then / Else steps as bullet points underneath (double-click edits). If is also in the Add dropdown and right-click menu. An If directly under a mini game / poll is *attached*: it is indented under it, a newly added If snaps in right under the nearest game, and moving or dragging the game carries its attached Ifs (`src/lib/stepGroups.ts`).

### 2.6d Duel Protected Viewers
- Timeout Duel and Streamer 1v1 steps have a "Protected viewers" editor (roles + named viewers + custom reply): `duelProtectedUsers`, `duelProtectedRoles`, `duelProtectedMessage`. Viewer duel: the *opponent* can't be challenged; Streamer 1v1: protected viewers can't challenge the streamer. The duel does not start and the challenger gets the reply (`DEFAULT_PROTECTED_MESSAGES`, tokens `{challenger}` `{opponent}`). Roles come from the last chat message seen per chatter (`chatterStore`), names match case-insensitively (`src/lib/shield.ts`).
- Viewer duels can no longer target the broadcaster (use the Streamer 1v1 step); the old "Allow challenging broadcaster" option is gone. There is no global shield, Settings card or Timeout/Ban shield.

### 2.6e Commands Table & Inspector
- Table columns: Command (the item's name; counters add their `!command` underneath; reply rows use their trigger word), Type (badge, count / studio button, and trigger icons for sequences: 🪙 channel points, 💬 chat, 🔥 raid, ❤️ follow, ⚡ watch streak, ⚠ no trigger), Who, CD. Writes/Last columns were removed.
- Inspectors show only main controls: Reply = enable, studio launcher, triggers, who can use, cooldown (response type, who replies, per-user cooldown, AI limits and chatter overrides live in the studios). Counter = name, live count, actions launcher and the two output switches; file path, title template/apply/detach and keybind sit under a collapsed `MoreSettings`. Sequence = studio launcher + test run, trigger summary, cooldown (legacy trigger fields under `MoreSettings` only for sequences without a trigger list).

### 2.6b UI Scale & Default Window Size
- Default UI size is 110% (`DEFAULT_UI_SCALE`, custom mode) for anyone without a stored choice; "Reset" returns to 110%. The titlebar no longer shows the scale %, the theme toggle, and the action bar no longer has the Connected pill (the sidebar shows the account).
- `src/lib/uiScale.ts`: Auto scale is monitor-height based (>=2000px: 1.35x, >=1350px: 1.25x, <900px or <1600 wide: 0.9x, else 1.0x) and capped so the window keeps >=1100 CSS px of layout width (0.05 steps, never below 1.0 on large monitors).
- `MainForm.cs`: first launch opens at ~75% of the screen working area (1280x800 .. 2200x1300). Users whose saved size is still exactly 1280x800 are moved to that default once (`WindowSettings.SizeUpgraded`).

### 2.7 Alert Studio: Luma Key Video Editor & Transparent Compressor (`core/Media/AlertCompressorService.cs`)
- **Purpose**: A comprehensive video processing studio providing two dedicated workflows:
  1. **🎬 Luma Key Video Editor**: Adobe Premiere-grade luminance keying to strip solid black or white backgrounds from alerts, memes, overlays, and VFX, outputting transparent video with full alpha channel.
  2. **📦 Alert Compressor (<30MB)**: High-performance constrained quality compression keeping large alert animations under StreamElements' 30MB upload limit without losing alpha or audio.
- **Interactive Real-Time Video Editor (`AlertCompressorView.tsx`)**:
  - **Live HTML5 Canvas Shader Engine**:
    - Video frames are drawn to an interactive `<canvas>` element and processed in real time (<1.5ms per frame) during 60 FPS playback.
    - Computes ITU-R Rec. 601/709 luminance: $Y = (0.299R + 0.587G + 0.114B) / 255.0$.
    - Applies smooth transparency ramp:
      $$|Y - \text{threshold}| \le \text{tolerance} \implies \alpha = 0$$
      $$\text{tolerance} < |Y - \text{threshold}| < \text{tolerance} + \text{softness} \implies \alpha = 255 \times \frac{|Y - \text{threshold}| - \text{tolerance}}{\text{softness}}$$
    - Sliders react instantaneously during playback and when scrubbing or paused.
  - **View Modes**:
    - **Keyed Result**: Full transparency applied with the chosen preview background.
    - **Before / After Split Screen**: Interactive A/B comparison slider (25%, 50%, 75% presets) showing original untouched source on the left and luma-keyed video on the right.
    - **Original Video**: Unmodified source footage.
  - **Transparency Testing Backgrounds**:
    - Checkerboard grid (transparent indicator).
    - Green Screen (`#00FF00` chroma green).
    - Solid Black (`#000000`).
    - Solid White (`#FFFFFF`).
    - Custom Color Picker (e.g. game backdrop emulation).
  - **Playback & Frame Stepping Controls**:
    - Play / Pause (click canvas or button).
    - Timeline scrubber slider with millisecond time display.
    - Precise frame stepping buttons (`-0.1s` and `+0.1s`).
    - Continuous Loop and Audio Mute toggles.
  - **Adobe Premiere-Style Keying Controls & Presets**:
    - **Modes**: Key Out Dark (targets $Y=0.0$), Key Out Bright (targets $Y=1.0$), Custom Luminance Center ($0.0 \dots 1.0$).
    - **Threshold / Cutoff**: Luminance tolerance range made 100% transparent.
    - **Feather / Softness**: Edge blend width preventing jagged artifacts.
    - **Invert Transparency**: Flips keying mask.
    - **Key Type** (`keyType`): `luma` (brightness) or `color` (chroma, `keyColor` hex, eyedropper-pick from the preview). Color key exports via FFmpeg `colorkey`; Tolerance/Feather sliders drive both types.
    - **Rotate** (`rotation` 0/90/180/270): Lossless pixel remap (`transpose`/`hflip,vflip` before keying); canvas preview uses a matching transform.
    - **Bitrate** (`videoBitrateK`, WebM only): Auto = CRF 18; Custom sends `customMaxBitrateK` and the host uses bitrate-targeted VP9 (`-b:v`, `-maxrate 1.5x`, no CRF). ProRes ignores it.
    - **Checkerboard**: two-tone `repeating-conic-gradient` with selectable square size (8/12/20/32px).
    - **My Presets**: user-named snapshots of all keying values, rotation, format and bitrate, saved to `localStorage` (`streamerhub.alertStudio.userPresets.v1`); same name overwrites, × deletes.
    - **Compress on export** (`editorCompress`, `editorTargetMb`, WebM only): sends `targetSizeMb` with no CRF so the host computes bitrate/CRF in the same single encode as the key; custom bitrate controls hide while it is on. Export stays available after a successful export so users can tweak and re-export without re-importing; "Edit Another Video" resets.
    - **Save prompt**: every export (editor and compressor tabs) opens the native Save dialog first so the user picks the folder and can rename the file; it opens in the last used folder (`initialDirectory`) and cancelling aborts. There is no path field or opt-out.
    - **Output resolution** (`outputHeight`, null = original): presets 2160p–360p or custom height; width is derived (aspect kept, even). Host applies `scale=-2:H:flags=lanczos` after rotation and before keying.
    - **Temporary files** (`core/Media/AlertTempStore.cs`): dropped videos are staged as `{guid32}_{name}` in `%LocalAppData%/StreamerHub/TempAlerts` (or a user-chosen folder via `dialog/pick-folder`). Deleted by default (on Edit Another Video / replacing the file via `alerts/discard-temp`, on startup and on exit); "Keep temporary files" disables deletion. Settings persist host-side in `alert-temp.json` (`alerts/get-temp-settings`, `alerts/set-temp-settings`). Only guid-prefixed files are ever deleted, and exports never default into the staging folder (falls back to Videos).
    - **Seeking**: `/media` in `ChatOverlayServer.cs` honours HTTP `Range` (206/416) so the preview scrubber can seek; without it Chromium treats the video as non-seekable.
    - **Choke / Shrink Matte** (`lumaChoke`, 0–0.9): Cuts low-alpha fringe to remove halos.
    - **Matte Gamma** (`lumaGamma`, 0.3–3): Curve on the alpha edge (<1 fattens glow, >1 tightens).
    - **Overall Opacity** (`lumaOpacity`, 0–1): Scales final alpha for ghost overlays.
    - Shaping is applied after invert: $\alpha' = \text{opacity} \cdot \text{clamp}\left(\frac{\alpha - \text{choke}}{1 - \text{choke}}\right)^{\gamma}$. FFmpeg export mirrors the canvas via a single `lut=a=...` filter.
    - **1-Click Presets**: Clean Black Screen, Aggressive Dark Key, Subtle Fine Edge, Clean White Screen, Reset Defaults.
- **Custom Save Destination & Native Windows File Dialog**:
  - **Native SaveFileDialog Integration**: `Channels.DialogSaveFile` supports custom `filter` and `title`, opening Windows File Explorer to pick any destination folder and filename.
  - Custom file path text input with auto-suggested `{fileName}_lumakey.{ext}` default.
  - **Dual Export Codecs**:
    - **WebM (VP9 + yuva420p)**: Optimal for OBS Studio Browser Sources and StreamElements (<30MB, browser-compatible).
    - **MOV (Apple ProRes 4444 + yuva444p10le)**: 10-bit lossless alpha master for Adobe Premiere, After Effects, and DaVinci Resolve.
  - **Post-Export Actions**:
    - **Play Video** (`Channels.AlertsOpenFile`): Launches exported video in default media player.
    - **Open Folder** (`Channels.AlertsOpenFolder`): Highlights exported file in Windows Explorer.
- **FFmpeg Lifecycle Management**:
  - Automatically scans for `ffmpeg.exe` across application base directory, `%LocalAppData%/StreamerHub/bin`, and the system `PATH`.
  - Zero-setup background downloader (`DownloadFfmpegAsync`) fetches portable essentials build from Gyan's CDN if missing, broadcasting `alerts/download-progress` events.
- **Constrained Quality Optimization (Compressor Tab)**:
  - Automatically computes bitrate ceiling and CRF based on duration to guarantee the file stays under budget (default 28MB preset with customizable 10–50MB slider).
  - Uses `-row-mt 1 -threads 16 -cpu-used 3` for multi-threaded speed on high-core CPUs.
  - Line-buffered stderr reader dispatches `alerts/progress` events with real-time percentage, current FPS, size, encoding speed multiplier, and current seconds.
  - Safe process tree cancellation via `CancelActiveProcess()`.

### 2.8 OBS Image / Picture Action in Sequences (`obs_image`)
- **Purpose**: Triggers image/GIF popups on OBS Studio directly from sequences (channel points, commands, follows, raids).
- **OBS Local Streaming Endpoint**:
  - `ChatOverlayServer.cs` serves local images and videos through `/media?path={encodeURIComponent(path)}` with CORS headers and proper MIME type streaming, avoiding Chromium sandbox restrictions (`file:///` access blocked in HTTP browser sources).
- **Dual Display Modes**:
  - **Auto Overlay Integration**: Automatically renders in existing `/chat-overlay.html` browser sources without requiring new OBS sources.
  - **Dedicated OBS Browser Source**: Standalone `/image-overlay.html` endpoint with 1-click copy URL button.
  - **Native OBS File Copy**: Optional `obsImageDestinationPath` copies the image directly to a disk path for OBS Image Sources.
- **Customizable Dynamics**: Screen positioning (`center`, `top-center`, `bottom-center`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `fullscreen`), animations (`bounce`, `fade`, `zoom`, `slide-up`, `slide-down`, `none`), scale slider (0.2x–3.0x), and auto-dismiss duration timer.

### 2.9 Mini-Game: Timeout Duel Showdown (`duel`)
- **Purpose**: Interactive Twitch chat mini-game where viewers challenge other viewers via commands or channel points. The loser gets timed out for a customizable duration.
- **Two Lose Condition Modes**:
  - **Random (50/50 Coin Flip)**: Instant roulette. Broadcasts challenge in chat, rolls a 50/50 coin flip, announces the winner/loser, and times out the loser.
  - **AI Gaming Trivia**: Groq / OpenRouter AI (with an offline catalog of 50+ bilingual gaming questions) sends a gaming trivia question to chat with a live countdown timer.
    - Whoever answers first in chat wins the duel.
    - Loser gets timed out using `smartModTimeout`.
    - If neither player answers before the timer runs out, **BOTH players get timed out**!
- **Duel Game Engine (`duelGameManager.ts`)**:
  - Normalizes chat messages with bilingual Arabic/English regex (strips diacritics, normalizes alef variants and taa marbuta, removes punctuation, case-insensitive substring tolerance).
  - Anti-spam guard: Rejects concurrent duels until the active showdown concludes.
  - Protection guards: Rejects self-challenges and challenges targeting the broadcaster.

### 2.10 Mini-Game: Streamer 1v1 Showdown Sub-Action (`duel_streamer`)
- **Purpose**: Dedicated sequence action allowing viewers to challenge the broadcaster directly.
- **Broadcaster Defaults & Independent Configuration**:
  - Always defaults the opponent target to the broadcaster (`{broadcaster}`).
  - Independent win rate slider (0% to 100%, default 50%).
  - Separate message templates for:
    - **Streamer Won**: Message broadcast when broadcaster wins the duel.
    - **Streamer Lost**: Message broadcast when broadcaster loses the duel.
  - **Focus-Preserving Quick Tokens**: Token chips (`{streamer}`, `{broadcaster}`, `{opponent}`, `{winner}`, `{loser}`, `{points}`) insert placeholders at the cursor position without stealing input focus.

### 2.11 Per-Monitor DPI & User-Configurable UI Scaling
- **Purpose**: Ensures optimal readability across diverse streamer monitor setups (1080p, 1440p, 4K Ultrawide, secondary vertical monitors).
- **Architecture**:
  - Windows Forms shell runs in `PerMonitorV2` High DPI mode.
  - `settingsStore.ts` persists `uiScale` (default `1.0`, range `0.8` to `1.4`).
  - App shell applies CSS zoom scaling dynamically on `#root`, maintaining crisp vector typography and responsive fluid layouts.

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
| `dialog/save-file` | Frontend -> Host | `{ defaultName: string, filter?: string, title?: string }` | Native Windows SaveFileDialog picker |
| `dialog/open-file` | Frontend -> Host | `{ filter?: string, title?: string }` | Native Windows OpenFileDialog picker |
| `chat-overlay/get-url` | Frontend -> Host | `{ overlayId?: string }` | Retrieves the loopback URL for an overlay |
| `obs-chat/get-dock-url` | Frontend -> Host | `void` | Retrieves the loopback URL for the OBS chat dock |
| `alerts/get-ffmpeg-status` | Frontend -> Host | `void` | Checks availability, path, and version of FFmpeg |
| `alerts/download-ffmpeg` | Frontend -> Host | `void` | Downloads portable FFmpeg build in background |
| `alerts/inspect` | Frontend -> Host | `{ inputPath: string }` | Inspects video dimensions, FPS, duration, codecs, and alpha |
| `alerts/compress` | Frontend -> Host | `CompressAlertPayload` | Starts VP9 alpha / ProRes MOV compression or Luma Key export |
| `alerts/cancel` | Frontend -> Host | `void` | Cancels active FFmpeg encoding process |
| `alerts/open-folder` | Frontend -> Host | `{ path: string }` | Selects exported video in Windows Explorer |
| `alerts/open-file` | Frontend -> Host | `{ path: string }` | Launches exported video in default media player |
| `alerts/progress` | Host -> Frontend | `CompressionProgress` | Real-time compression percentage, FPS, size, and speed |
| `alerts/completed` | Host -> Frontend | `CompressionResult` | Outcome, original vs compressed byte sizes |
| `alerts/download-progress` | Host -> Frontend | `{ percent: number }` | Progress percentage for FFmpeg background download |

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
│   ├── Media/
│   │   └── AlertCompressorService.cs# FFmpeg detection, download & VP9 alpha compression
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
│   │   │   ├── alerts/
│   │   │   │   └── AlertCompressorView.tsx# Alert Studio compressor with checkerboard preview
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
