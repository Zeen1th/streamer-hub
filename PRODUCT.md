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
3. **OBS Chat Overlay**: A zero-latency local HTTP overlay server (`127.0.0.1:49178`) with a full canvas editor — the streamer lays out and styles the chat block on a 1920×1080 stage, with per-element control over every visual property, third-party emote rendering, display filters, and full Arabic/English BiDi text rendering.
4. **Live Stream Title Sync**: Non-destructive stream title updates that preserve manual streamer titles while maintaining clean counter numbers.

## Operating Context

- **Shell**: C# .NET 8 Windows Forms app hosting Microsoft WebView2 Runtime in PerMonitorV2 DPI mode with a frameless custom titlebar.
- **OBS Integration**:
  - Plain UTF-8 text files read by OBS Text (GDI+) sources.
  - Local HTTP server for OBS Browser Sources.
- **Twitch Integration**: Direct Twitch IRC chat connection and Helix API authentication (Broadcaster + optional secondary Bot account).
- **Auto-Updater**: Background GitHub release checker and single-click self-extracting installer updater.
- **Frontend**: React 19 + TypeScript + Tailwind CSS with full standalone browser mock mode (`npm run dev`).

## Capabilities and Features

- **Counters**:
  - Custom increment/decrement/reset commands with granular permission levels (Broadcaster, Mod, VIP, Subscriber, Everyone) and cooldowns.
  - Direct OBS text file synchronization with custom formatting tokens (`{count}`, `{username}`).
  - Stream title template integration with intelligent base title preservation (`extractBaseTitle`) to prevent compounding.
  - Comprehensive activity and audit log with manual rollback controls.
- **Auto-Replies & Triggers**:
  - Exact, Prefix, Contains, and Regex matching modes.
  - Prepared response templates with drag-and-drop placeholder tokens.
  - Optional AI-assisted replies using Groq (Llama 3.1) or OpenRouter with fallback safety.
  - Title increase/decrease commands bound directly to counter sequences.
- **OBS Chat Overlay**:
  - Real-time broadcast from Twitch IRC to a 1920×1080 OBS Browser Source.
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
- **Settings & UI**:
  - Sectioned navigation: General, Twitch Connection, Bot Account, Appearance, and Step-by-Step Setup Guide.
  - Full English and Arabic localization with Cairo typography and stable LTR shell controls.

