# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop app (C# .NET 8 + WebView2) with typed RPC architecture and browser-first frontend development support.

## Users

- Primary: The Twitch streamer using the app to manage their live broadcast tools (counters, chat overlay, automated replies, stream titles) seamlessly alongside OBS Studio.
- Viewers: Interact via Twitch chat commands (e.g., `!death`, `!deaths`, auto-reply triggers) to adjust stream stats, trigger customized responses, or appear on the stream chat overlay.
- Secondary: The developer shipping updates and tailored stream utilities directly to streamer friends via built-in auto-update installer pipelines.

## Product Purpose

A lightweight, local-first streaming companion that provides dedicated tools without requiring external cloud accounts or complex SaaS setups:
1. **Interactive Counters**: Multi-command (+1, −1, reset) stream counters syncing in real time to OBS text files and Twitch stream titles.
2. **Auto-Replies & Triggers**: Keyword matching, AI-powered responses (via Groq/OpenRouter), cooldowns, permissions, and dynamic title actions.
3. **OBS Chat Overlay & Multi-Overlay Profiles**: A zero-latency local HTTP overlay server (`127.0.0.1:49178`) supporting multiple independent overlay layouts with a full canvas editor — the streamer lays out and styles chat blocks on a 1920×1080 stage, with per-element control over every visual property, third-party emote rendering, display filters, and full Arabic/English BiDi text rendering.
4. **OBS Streamer Chat Dock & Fast Moderation**: A dedicated streamer dock interface (`127.0.0.1:49178/obs-chat.html`) and in-app Chat tab providing bottom-up message flow, real-time streamer message reflection, and 1-click moderation (Timeout 60s, Ban, Delete, Shoutout, Mention).
5. **Live Stream Title Sync**: Non-destructive stream title updates that preserve manual streamer titles while maintaining clean counter numbers.

## Operating Context

- **Shell**: C# .NET 8 Windows Forms app hosting Microsoft WebView2 Runtime in PerMonitorV2 DPI mode with a frameless custom titlebar.
- **OBS Integration**:
  - Plain UTF-8 text files read by OBS Text (GDI+) sources.
  - Local HTTP server for OBS Browser Sources (`/chat-overlay.html?id=...`) and OBS Custom Browser Docks (`/obs-chat.html`).
- **Twitch Integration**: Direct Twitch IRC chat connection and Helix API authentication (Broadcaster + optional secondary Bot account) supporting full moderation scopes (`moderator:manage:banned_users`, `moderator:manage:chat_messages`, `moderator:manage:shoutouts`).
- **Auto-Updater**: Background GitHub release checker, single-click self-extracting installer updater, and one-time permission prompter (`ReauthPromptModal`).
- **Frontend**: React 19 + TypeScript + Tailwind CSS with full standalone browser mock mode (`npm run dev`).

## Capabilities and Features

- **Counters**:
  - Custom increment/decrement/reset commands with granular permission levels (Broadcaster, Mod, VIP, Subscriber, Everyone) and cooldowns.
  - Direct OBS text file synchronization with custom formatting tokens (`{count}`, `{username}`).
  - Stream title template integration with intelligent base title preservation (`extractBaseTitle`) to prevent compounding.
  - Comprehensive activity and audit log with manual rollback controls.
- **Auto-Replies & AI Reply Studio**:
  - Exact, Prefix, Contains, and Regex matching modes for chat triggers.
  - Prepared response templates with drag-and-drop placeholder tokens (`{username}`, `{mention}`, `{message}`).
  - **Broadcaster & Viewer Command Execution**: Broadcaster chat messages are recognized and executed without false echo suppression, enabling streamers to test and trigger prepared replies, AI banter, and title changer actions directly from Twitch chat.
  - **Robust Command Matching**: Case-insensitive matching, tolerance for optional leading `!` prefixes (e.g. `discord` matches `!discord`), command arguments support (`!discord @viewer`), and counter deltas (`!death+ 1`, `!death+1`).
  - **Persona Engine & Identity**: Streamers define custom Agent Names, Roles, and Stream Lore/Knowledge facts that seamlessly feed into the LLM system prompt.
  - **Arrodes (`🪞 أروديس`) Built-in Preset**: Deep, authentic LOTM magic silver mirror persona with rich lore and natural English/Arabic translations.
  - **Custom User Presets**: 1-click preset saving to local persistent storage, instant application, and deletion.
  - **Global AI Protection Limits**: Direct sliders, numeric inputs, and quick presets for master AI cooldown and per-user spam prevention across all AI replies.
  - **Bot Account Dispatching**: Command execution and chat replies can be dispatched from either the Broadcaster or a secondary Bot account with debug switching tools.
  - **Multi-Reply De-duplication**: Double-burst prevention ensuring single-response execution even under rapid message spikes.
  - Title increase/decrease commands bound directly to counter sequences.
- **OBS Chat Overlay & Multi-Overlay Manager**:
  - Real-time broadcast from Twitch IRC to a 1920×1080 OBS Browser Source.
  - Multi-overlay switcher (`ChatOverlayBar`) to create, rename, duplicate settings, and delete separate overlay profiles with distinct URLs (`?id=<overlayId>`).
  - Canvas editor with a Preview/Edit toggle: drag, resize, snap guides, arrow-key nudge, undo/redo, and an optional reference backdrop for designing against a real scene.
  - Click any part of a message — avatar, username, badge, bubble, text — to select it and jump to its settings.
  - Every visual property is a design token: colours, opacity, borders, radius, padding, shadow, blur, accent bar, wrap mode, line height, letter case, and independent typography for usernames and message text.
  - 6 starter presets: Dark, Light, Transparent, Neon, Ember, and Bare (no chrome at all).
  - Animation styles: Slide, Fade, Pop Bounce, Glow Pulse, 3D Flip, Off, with adjustable duration.
  - Emotes rendered as images from Twitch, BetterTTV, FrankerFaceZ, and 7TV, each independently toggleable and failing soft to text.
  - Display filters: username blocklist with wildcards, bot list, command hiding, word blocking or masking, and a minimum message length.
  - Sharp at any size: the size control multiplies real pixel values instead of transform-scaling a rendered bitmap.
  - Natural bidirectional (BiDi) Arabic/English text ordering.
  - Avatars resolve asynchronously and patch onto messages already on screen, so a viewer's first message is never left with a placeholder.
  - Moderator deletions, timeouts, and chat clears remove messages from the overlay immediately.
- **OBS Streamer Chat Dock & Fast Moderation**:
  - Tailored specifically for OBS Custom Browser Docks (`http://127.0.0.1:49178/obs-chat.html`) or the internal **Chat** tab.
  - Bottom-anchored message flow (`min-h-full flex flex-col justify-end`) where new messages enter from below with smooth sliding animation (`animate-chat-in`).
  - Streamer sent message reflection: messages sent through the app or bot are immediately echoed with `isSelf: true`.
  - Floating action toolbar on every message: Timeout (60s), Ban, Delete message, Shoutout, and Mention.
  - High-contrast dark theme with automatic username luminance protection ($\ge 0.35$).
  - Full bidirectional typography: `Cairo` for Arabic and `Barlow` for Latin/English.
  - Instant cross-client synchronization of deletions, user timeouts, and full room clears.
- **Settings & UI**:
  - Sectioned navigation: General, Twitch Connection, Bot Account, Appearance, and Step-by-Step Setup Guide.
  - High-contrast, unwashed dark themes: Solar Amber, Abyss Sapphire, Midnight Violet, Tokyo Rose, and Crimson Dark.
  - Generously scaled 116% interface with enlarged typography for optimal legibility during live streaming.
  - Full English and Arabic localization with Cairo typography and stable LTR shell controls.
  - First-run and version upgrade prompt modals (`ReauthPromptModal`) ensuring zero-friction permissions maintenance.


