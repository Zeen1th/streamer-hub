# Brand spec — Streamer Hub workspace

Source: `image.png` (the Streamer.bot home screen supplied by the user, 1401 × 1151).
Method: pixels sampled with System.Drawing, averaged over flat regions (text and
anti-aliasing excluded), then converted sRGB → OKLab → OKLch. No value below is guessed.

## Tokens

| Token | OKLch | Sampled sRGB | Role |
| --- | --- | --- | --- |
| `--bg` | `oklch(24.7% 0.0163 240.7)` | `#1A2228` | Window chrome — titlebar, action bar, sidebar |
| `--surface` | `oklch(27.4% 0.0132 253.0)` | `#23282E` | Workspace ground |
| `--fg` | `oklch(96.3% 0.0062 255.5)` | `#F0F3F7` | Primary text |
| `--muted` | `oklch(71.2% 0.0203 255.6)` | `#9AA3AF` | Secondary text, labels, descriptions |
| `--border` | `oklch(34.5% 0.0169 251.8)` | `#333A42` | 1 px card and row hairlines |
| `--accent` | `oklch(58.5% 0.2041 277.1)` | `#6366F1` | Active route marker + the one primary action |

Supporting, also sampled: `--card` `oklch(32.1% 0.0109 236.9)` (`#2E3438`),
`--accent-2` `oklch(68.7% 0.1347 233.4)` (`#22A7E0`, focus ring / overlay chrome),
`--green` `oklch(72.3% 0.1920 149.6)` (`#22C55E`, connected).
Hero gradient endpoints sampled at `#2E2540 → #273149 → #1A404A`; the brand mark
gradient at `#6140A7 → #1463C5`.

## Type

- Display + body: **Archivo** (400 / 500 / 600 / 700 / 800), fallback `system-ui, 'Segoe UI', sans-serif`.
- Data: **IBM Plex Mono** (400 / 500 / 600).
- Matches the app's existing `DESIGN.md` "Data Rule" — machine values in mono, language in Archivo — so the port stays offline-safe with the `@fontsource` packages already installed.

## Observed rules

1. **Three-ground depth.** Chrome (`#1A2228`) → workspace (`#23282E`) → card (`#2E3438`). Each step is ~4–5 OKLch L points lighter; panes separate by ground colour, never by shadow.
2. **The accent is a verb.** Indigo appears only on the active nav indicator and the single primary action. Everything else is ink on ground.
3. **One card recipe.** 1 px low-alpha border, ~7 px radius, flat fill, no shadow, exactly one icon + a bold title + a muted one-line description.
4. **The left rail is the spine.** Icon + label rows, collapsible groups with brand-coloured dots, live counts in mono, and the streamer profile pinned to the bottom.
5. **Mono is data.** Counts, timestamps, URLs, cooldowns and status readouts are IBM Plex Mono; headings and body stay Archivo.

**In one sentence:** a slate desktop console — chrome `#1A2228`, workspace `#23282E`,
cards `#2E3438` — where a single indigo accent marks the active route and the one
primary action, and mono carries every machine value.
