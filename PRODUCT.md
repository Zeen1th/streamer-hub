# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: the Twitch streamer using the app. They are the only person who edits and sets up tools in the UI, typically while managing a live stream with OBS Studio.
- Viewers never touch the UI. They interact only through chat commands the streamer exposes — for example typing `!death` in Twitch chat to increase the counter.
- Secondary: the developer who builds and ships tools inside the app to their streamer friend.

## Product Purpose

A simple, solid desktop app that lets the developer ship small stream tools to their streamer friend. The working example is the Counters tool: a dataset of user-created counters, each with three chat commands — increase, decrease, and reset — each with its own permission rank and cooldown; any viewer typing a command in Twitch chat updates the counter, and the value is written to the streamer's OBS text field.

## Positioning

Deliberately not a competitor to Streamlabs or StreamElements. A lightweight, locally-run utility for a known streamer, built and extended by a developer friend — no accounts, no platform ambitions.

## Operating Context

- Runs on the streamer's Windows PC inside a C# .NET WebView2 container with a frameless window and custom titlebar.
- The streamer streams with OBS Studio; tool output reaches overlays through plain text files that OBS text sources read.
- The app connects to Twitch chat; the titlebar shows Twitch and C# core connection status.
- The frontend must run fully in a plain browser during development (`npm run dev`) via a built-in mock host when the WebView2 bridge is absent.

## Capabilities and Constraints

- Confirmed binding architecture: the C# WebView2 shell with a typed RPC bridge over `window.chrome.webview.postMessage`. The host implements channels (window controls, core status, counters state, OBS file writes, save-file dialog, log append, Twitch auth) and events (status changes, Twitch chat messages, maximize changes, core log lines); the frontend ships an automatic browser mock of the same contract.
- Counters tool: a hub dashboard lists the tools and brief status; the Counters tool holds a dataset of user-created counters. Each counter has a name, a manual +1/−1/reset, three chat commands (increase, decrease, reset) each with its own name, minimum permission rank, and cooldown; per-counter OBS text-file output with `{count}` and `{username}` placeholders; a shared activity feed of triggers, denials, and system events. Keyboard shortcuts (+/−/R/arrows) act on the selected counter.
- Existing functionality, not confirmed as binding commitments: a single light color theme.

## Brand Commitments

- Current name: Streamer Hub (repo evidence; branding has not been made a binding commitment).

## Evidence on Hand

- Complete frontend implementation in this repo, including the browser mock host.
- `ui-artstic-skill.md` — the design skill file the current UI follows.
- No real Twitch credentials or endpoints exist in this repo; real chat integration belongs to the C# core, which is not yet in this repo. Future work must not fabricate it.

## Product Principles

- The streamer configures; the chat triggers. All viewer interaction runs through simple chat commands.
- Simple and solid over feature surface: small tools, dependable behavior.
- Local by default: everything runs on the streamer's PC, and OBS integration is plain files.
- The ship loop is first-class: the typed RPC contract plus the browser mock keeps tools testable without the C# host.

## Accessibility & Inclusion

- No product-specific requirements established. The current implementation includes keyboard shortcuts, visible focus states, and reduced-motion support as baseline practice.
