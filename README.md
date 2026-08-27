# Streamer Hub

Streamer Hub is a lightweight, local-first desktop companion for Twitch streamers. It provides real-time stream counters, automated triggers, AI-assisted chat replies, smart stream title preservation, and a high-performance local OBS chat overlay.

---

## Key Features

- **Stream Counters**: Multi-command chat counters (+1, −1, reset) syncing instantly to plain text files for OBS text sources.
- **Smart Title Sync**: Integrates counters with your live Twitch stream title using `{title}` and `{count}` with automatic anti-compounding protection.
- **Auto-Replies & Triggers**: Keyword and regex response rules with optional AI-generated answers (Groq Llama 3.1 / OpenRouter) and custom cooldowns.
- **OBS Chat Overlay**: Zero-latency local loopback web server (`http://127.0.0.1:49178/chat-overlay.html`) featuring:
  - 5 Themes (Dark, Light, Transparent, Neon Cyber, Warm Ember)
  - 6 Animation styles (Slide, Fade, Pop, Glow, Flip, Off)
  - Avatar shape and side positioning (Left / Right) with stable non-jumping card structures
  - Flawless Arabic & English bidirectional (BiDi) text rendering
  - Compact and Stacked display modes
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
   - **Chat Overlay**: Toggle **Enable Overlay Server**, copy the loopback URL, and paste it into an OBS **Browser Source** (recommended: 800×600 or 1920×1080).

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



