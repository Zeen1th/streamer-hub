# Streamer Hub

Streamer Hub is a beta desktop companion for Twitch streamers. It includes counters, chat triggers, AI-assisted replies, stream-title counters, OBS text output, and a combined activity feed.

## For friends trying the beta

1. Open the latest release under **Releases** and download the Windows `StreamerHub-Setup.exe` installer.
2. Run the installer and follow the short setup. It creates a Start Menu and Desktop shortcut.
3. The app checks for updates when it starts. You can also press the top-right **Update** button any time; available updates show their changelog and install with a progress indicator, then reopen Streamer Hub automatically.
4. Connect Twitch from Settings. The browser login is handled by Twitch; no Twitch app setup is needed.

The Windows WebView2 Runtime is required. Most current Windows installations already have it. If the app asks for it, install the Microsoft WebView2 Runtime and reopen Streamer Hub.

## Chat Overlay (OBS Browser Source)

Streamer Hub includes a local, customizable Twitch chat overlay:

1. Open **Chat Overlay** in the app sidebar and toggle **Enable Overlay Server**.
2. Copy the **OBS Browser Source URL** (e.g. `http://127.0.0.1:49178/chat-overlay.html`).
3. In OBS Studio, add a new **Browser Source**, paste the copied URL, and set your desired dimensions (e.g., width 800, height 600).
4. Customize themes (Dark, Light, Transparent), message shape, animations, typography, avatar sizing, and display modes directly in Streamer Hub — changes update your stream overlay in real time.
5. The overlay binds exclusively to loopback (`127.0.0.1`) for privacy and security.

This is beta software. Please report problems with the app version and the details shown in Feed.


