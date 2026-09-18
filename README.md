# Streamer Hub

Streamer Hub is a lightweight, local-first desktop companion for Twitch streamers. It provides real-time stream counters, automated triggers, AI-assisted chat replies, smart stream title preservation, and a high-performance local OBS chat overlay.

---

## Key Features

- **Stream Counters**: Multi-command chat counters (+1, −1, reset) syncing instantly to plain text files for OBS text sources.
- **Smart Title Sync**: Integrates counters with your live Twitch stream title using `{title}` and `{count}` with automatic anti-compounding protection.
- **AI Reply Studio & Persona Engine**: Intelligent, context-aware Twitch chat interactions powered by Groq (Llama 3.1) and OpenRouter:
  - **Agent Persona Customization**: Set custom Agent Names (which bots recognize as their identity), roles, personalities, and stream lore knowledge bases.
  - **Arrodes (`🪞 أروديس`) Exclusive Preset**: Built-in LOTM magic silver mirror persona with rich lore and natural bilingual Arabic/English responses.
  - **Custom Persona Presets**: Save your active persona configurations locally, apply in 1-click, and manage easily.
  - **Global AI Cooldown Protection**: Direct, real-time controls for master AI cooldown and per-user spam prevention accessible directly inside AI replies, the Inspector, and the AI command table toolbar.
  - **Bot Account Switching**: Seamlessly route command replies and AI chat messages through a secondary Bot account or the main Broadcaster.
  - **Anti-Duplicate Safety Guard**: Multi-tier deduplication protecting against double-burst responses on high-activity streams.
- **OBS Streamer Chat Dock & In-App Chat Tab**: Zero-latency, streamer-focused chat reader (`http://127.0.0.1:49178/obs-chat.html`) built for OBS Custom Browser Docks or multi-monitor streaming:
  - **Natural bottom-to-up flow** — messages start anchored at the bottom above the input bar and smoothly push upward as chat moves.
  - **Streamer sent message echo** — messages sent by the streamer or configured bot account appear immediately in real-time.
  - **One-click moderation** — hover any message for instant Timeout (60s), Ban, Message Deletion, Shoutout, and Mention actions.
  - **High-contrast readability** — dark theme with automatic username luminance scaling ($\ge 0.35$) ensures every name is readable on black backgrounds.
  - **BiDi typography** — native Cairo (Arabic) and Barlow (English) font rendering with full emote support.
- **Multi-Overlay Profiles**: Create and customize multiple independent overlay designs (e.g., Just Chatting vs Gameplay) with dedicated OBS Browser Source URLs (`http://127.0.0.1:49178/chat-overlay.html?id=<overlayId>`).
- **OBS Chat Overlay**: Zero-latency local loopback web server (`http://127.0.0.1:49178/chat-overlay.html`) featuring:
  - **Canvas editor** — lay the chat block out on a true 1920×1080 stream canvas: drag to move, resize with handles, snap guides, arrow-key nudge, and undo/redo. Load a screenshot of your scene as a reference backdrop while you design.
  - **Click-to-style** — click a message's avatar, username, badge, bubble, or text and the properties panel jumps straight to that part's settings.
  - **Full design control** — every visual property is adjustable: colours, opacity, border width and radius, padding, shadow, backdrop blur, accent bar, text wrap mode, line height, letter case, and independent fonts, sizes, and weights for the username and the message text.
  - 6 starter presets (Dark, Light, Transparent, Neon, Ember, and **Bare** — no background, border, or shadow at all)
  - 6 animation styles (Slide, Fade, Pop, Glow, Flip, Off) with adjustable duration
  - **Emotes as images** — Twitch, BetterTTV, FrankerFaceZ, and 7TV, each independently toggleable, with an extra size boost for emote-only messages
  - **Filters** — block usernames (with `*` prefix wildcards), hide known bots, hide `!commands`, block or mask words, and drop very short spam
  - **Pixel-sharp at any size** — the size control scales real pixel values rather than stretching a rendered bitmap, so text stays crisp when scaled up
  - Flawless Arabic & English bidirectional (BiDi) text rendering
  - Moderated messages disappear from the overlay when a mod deletes them or times a user out
- **Local & Private**: No cloud accounts or subscriptions required. Runs on your Windows PC and binds strictly to loopback (`127.0.0.1`).
- **One-Click Auto-Updates**: In-app update notifications with background downloading and automated restart.

---

## Installation & Setup

1. Download the latest `StreamerHub-Setup-v*.exe` installer from [Releases](https://github.com/Zeen1th/streamer-hub/releases/latest).
2. Run the installer (requires Windows 10/11 and the Microsoft WebView2 Runtime).
3. Open **Streamer Hub** and navigate to **Settings**:
   - Click **Connect Twitch** to authenticate your broadcaster account.
   - (Optional) Configure a secondary Bot account or add an AI API key (Groq / OpenRouter) for intelligent chat replies.
4. Set up your tools:
   - **Counters**: Create a counter, set OBS text output path, and add a Text (GDI+) source in OBS reading that file.
   - **Chat Overlay**: Toggle **Enable Overlay Server**, copy the loopback URL, and paste it into an OBS **Browser Source** sized **1920×1080**. Leave the source at 100% scale in your scene and position the chat block inside the app instead — scaling the source within OBS resamples the overlay and softens it.
   - **OBS Chat Dock**: In OBS Studio, open **Docks -> Custom Browser Docks...**, name it "Streamer Chat", and paste `http://127.0.0.1:49178/obs-chat.html`. Dock it anywhere in OBS to read chat and moderate with single-click timeouts and bans.

---

## Development

```bash
# Install frontend dependencies
npm install

# Run frontend in browser mock mode
npm run dev

# Run unit tests
npm test

# Build frontend and desktop core
run.bat
```



