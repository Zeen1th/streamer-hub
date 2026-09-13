# Handoff: Streamer Hub — Streamer.bot-style workspace shell

## What this is

`streamer-hub-workspace.html` is a **design reference prototype**, not production code.
It is a single self-contained HTML file (inline CSS + a small vanilla-JS router). Open it
in Chrome or Edge; it is fully interactive.

It recreates the *overall visual* of the Streamer.bot desktop console (the screenshot the
streamer supplied) and applies it to Streamer Hub's own features: a titlebar, an action
bar, a collapsible left rail, and a workspace that switches between Home, Commands, Chat
Overlay, Activity, Settings, Platforms, Stream Apps, Keybinds, Integrations and About.

`brand-spec.md` holds the colour tokens sampled from that screenshot, expressed in OKLch
and sRGB.

## Do not port the runtime

The HTML uses plain CSS classes and one inline `<script>` IIFE (view routing, group
toggles, table selection, segmented controls, switches, live filter, `localStorage`).
**Do not copy this file into the app.** Recreate the design in the existing React 19 +
TypeScript + Tailwind codebase using its established patterns — `zustand` stores, the
typed RPC layer, the `t()` i18n helper and `src/components/ui/*` primitives.

Treat `streamer-hub-workspace.html` as the visual source of truth and `brand-spec.md` as
the token spec. Where they disagree, re-measure against the screenshot (`image.png` in the
Open Design project).

## Tokens to bind

Map these to `src/index.css` variables (they replace the current ember/parchment tokens
where this direction applies). Values are measured, not estimated.

| Token | OKLch | sRGB | Role |
| --- | --- | --- | --- |
| `--bg` | `oklch(24.7% 0.0163 240.7)` | `#1A2228` | Window chrome — titlebar, action bar, sidebar |
| `--surface` | `oklch(27.4% 0.0132 253.0)` | `#23282E` | Workspace ground |
| `--card` | `oklch(32.1% 0.0109 236.9)` | `#2E3438` | Cards and rows |
| `--fg` | `oklch(96.3% 0.0062 255.5)` | `#F0F3F7` | Primary text |
| `--muted` | `oklch(71.2% 0.0203 255.6)` | `#9AA3AF` | Secondary text, labels |
| `--border` | `oklch(34.5% 0.0169 251.8)` | `#333A42` @ 8–15% | 1 px hairlines |
| `--accent` | `oklch(58.5% 0.2041 277.1)` | `#6366F1` | Active route + the one primary action |
| `--accent-2` | `oklch(68.7% 0.1347 233.4)` | `#22A7E0` | Focus ring / overlay accents |
| `--green` | `oklch(72.3% 0.1920 149.6)` | `#22C55E` | Connected state |

Hero gradient endpoints: `#2E2540 → #273149 → #1A404A`. Brand mark gradient:
`#6140A7 → #1463C5`. Type: **Archivo** for language, **IBM Plex Mono** for data (both
already vendored via `@fontsource`).

## Suggested file map

Derived from the current source tree; adjust as the codebase has moved on.

| Repo path | Action |
| --- | --- |
| `src/index.css` | Add the tokens above as CSS variables; keep the existing dark block |
| `src/App.tsx` | Add the action bar above the body; keep routing on `toolStore` |
| `src/components/layout/AppSidebar.tsx` | Restyle to the two-level collapsible rail with live counts + profile card (already close) |
| `src/components/titlebar/Titlebar.tsx` | Align height/tokens; keep `WindowControls` RPC wiring |
| `src/components/tools/home/HomeView.tsx` | Rebuild as the hero + four quick cards + Support list + support panel |
| `src/components/commands/CommandsView.tsx` | Table styling, filter, multi-select; keep the docked inspector |
| `src/components/tools/chat/ChatView.tsx` | Preview + settings column styling |
| `src/components/tools/counter/ActivityLog.tsx` | Kind chips + mono log rows |
| `src/components/tools/settings/SettingsView.tsx` | Tree + field-row layout |
| `src/components/ui/*` | Match the radii, borders and states in the prototype |

## Hard constraints carried from `DESIGN.md`

- **No motion into existence** — never animate from `opacity: 0`; the app runs from the
  tray and is occluded while gaming.
- **No dimming for state** — strike/tag/re-colour at full opacity, not `opacity`.
- **4.5:1 for all interface type** (all UI text is ≤ 13 px here).
- **Mono is data** — counts, timestamps, URLs, cooldowns, status readouts.

## Known gaps

- The Home support panel's bullets are illustrative copy — replace with real links.
- Platform / Stream Apps / Keybinds / Integrations rows are representative sample data;
  reconcile against the real `settingsStore` and RPC contract.
- The Commands inspector is not included in this prototype; reuse the existing docked
  inspector and only restyle it.
