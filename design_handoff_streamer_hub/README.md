# Handoff: Streamer Hub frontend redesign

## Overview

A complete frontend redesign of Streamer Hub — a Windows desktop utility (C# .NET 8 +
WebView2, React + TypeScript + Tailwind) that lets a Twitch streamer configure
chat-driven counters, automatic replies, AI replies, a chat overlay, stream-title
behaviour and global keybinds.

The redesign replaces the previous "diegetic tool shrine" visual world (Cinzel display
type, parchment `#e8e2d2` ground, ember `#8a4f1d` accent) and its feature-based
information architecture.

**The central idea: the app is organised around commands, not features.** Previously
Counters, Triggers and Chat Overlay were separate pages, which meant the question "what
happens if someone types `!death`?" was answered in three places. Now the only object
the streamer owns is *the command* — a counter is three commands, an automatic reply is
one command, an AI reply is one command — and they are all rows in one table. Alerts,
TTS and additional overlay types (the stated roadmap) become new rows rather than new
pages.

The shell is a dense Windows desktop workspace, deliberately not a web page: a 32 px
titlebar, a tab strip, a compact toolbar, a group tree, the table, a properties
inspector, and a collapsible log docked at the bottom. **There are no modals anywhere.**

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing
intended look and behaviour. They are **not production code to copy directly.**

`Streamer Hub.dc.html` is a single-file HTML prototype using a small streaming-template
runtime (`support.js`). It has its own template syntax (`{{ }}` holes, `<sc-for>`,
`<sc-if>`) and a logic class. **Do not port that runtime or its syntax.** The task is to
recreate these designs in the existing React + TypeScript + Tailwind codebase using its
established patterns — `zustand` stores, the typed RPC layer, the `t()` i18n helper, and
the `src/components/ui/*` primitives.

Treat the prototype as the visual and behavioural source of truth, and `DESIGN.md` as
the written spec. Where they disagree, `DESIGN.md` wins — it was corrected last.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, density, states and interactions.
Every value in `DESIGN.md` is measured, not estimated — including the contrast figures.
Recreate the UI faithfully rather than approximating it.

Two parts are explicitly *not* finished, and are called out again under **Known gaps**:
the Overlay tab's canvas editor, and the Settings tab's per-section field lists.

## How to open the prototype

Open `Streamer Hub.dc.html` in a browser (Chrome or Edge; it needs `support.js`
alongside it, which is included). It is fully interactive.

The titlebar carries the state switches you need to see every design state:

| Control | What it toggles |
| --- | --- |
| Sun / moon icon | Light ⇄ dark theme |
| `عربي` / `EN` | English ⇄ Arabic |
| The connection pill (`@ali_streams`) | Connected ⇄ disconnected |

Also: click a row to select it, Ctrl/Cmd/Shift-click to multi-select, right-click a row
for the context menu, click the `Log` header to collapse the log pane, and click the
group tree's `Disabled` group to see the disabled row treatment. Resize the window to
~900 px to see the responsive column ladder.

`Current UI (before).dc.html` is a faithful recreation of the *previous* UI, included
only so you can diff old against new and confirm no functionality was dropped.

---

## Design tokens

Defined as CSS custom properties on `[data-app]` / `[data-app="dark"]` in the prototype.
Port these to Tailwind theme extensions or CSS variables — do not inline the hex values
per component.

### Colour

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--surface` | `#f3f2f2` | `#1b1817` | Content ground — table, content panes |
| `--surface-2` | `#e8e7e5` | `#141112` | Chrome — titlebar, tabs, tree, inspector, log header |
| `--surface-3` | `#dedcd9` | `#0f0d0d` | Overlay-preview dead area only |
| `--ink` | `#201e1d` | `#ece8e5` | Primary text |
| `--muted` | `rgba(32,30,29,.74)` | `rgba(232,231,228,.72)` | Secondary text, column heads, labels |
| `--faint` | `rgba(32,30,29,.66)` | `rgba(232,231,228,.6)` | Tertiary text, timestamps, "Off" |
| `--rule` | `rgba(32,30,29,.4)` | `rgba(232,231,228,.3)` | 2 px structural dividers, input borders |
| `--hair` | `rgba(32,30,29,.18)` | `rgba(232,231,228,.13)` | 1 px row and field lines |
| `--accent` | `#ec3013` | `#ff5436` | **Chrome only** — rules, bars, dots, focus ring |
| `--accent-text` | `#ae1800` | `#ff5436` | **Accent as type** — command names, errors, links |
| `--accent-fill` | `#d62608` | `#ff5436` | **Accent as a fill** under `--on-accent` type |
| `--accent-soft` | `rgba(236,48,19,.08)` | `rgba(255,84,54,.13)` | Selected-row tint, banner ground |
| `--accent-deep` | `#ae1800` | `#ff8f79` | Log `TRIGGER` kind |
| `--on-accent` | `#faf9f8` | `#16100e` | Type on `--accent-fill` |

**The three-accent split is not decoration — it is a contrast requirement.** One red
cannot be both a 2 px rule and readable 13 px type on a light ground. `--accent`
measures 3.76:1, which is correct for graphical objects (3:1) and fails for text
(4.5:1). Setting type in `--accent` is a bug. In dark all three collapse to `#ff5436`,
which already clears 4.5:1, so the split only does work in light.

### Typography

Load **Archivo** (400, 500, 600, 800), **IBM Plex Mono** (400, 500, 600) and **Cairo**
(400, 600, 800).

| Role | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Page title | Archivo | 24 px | 800 | `letter-spacing: -0.015em`. One per screen |
| Inspector subject | Archivo | 19 px | 800 | `--accent-text`, `line-height: 1.15` |
| Command name (in table) | Archivo | 13 px | 800 | `--accent-text` |
| Field title | Archivo | 13–14 px | 800 | |
| Body / row | Archivo | 13 px | 400–500 | |
| Label | Archivo | 10 px | 600 | `letter-spacing: 0.1em`, uppercase |
| State tag | Archivo | 9.5 px | 600 | `letter-spacing: 0.09em`, uppercase |
| Data | IBM Plex Mono | 11–12 px | 400–600 | |
| Log line | IBM Plex Mono | 11.5 px | 400 | `line-height: 1.75` |
| Arabic | Cairo | 13 px | 400 | Arabic UI labels and Arabic content |

**The Data Rule:** if a value is produced by the machine rather than typed by the user,
it is set in IBM Plex Mono — timestamps, counts, file paths, templates, cooldowns, URLs,
key combinations, the log, and the output preview. A *label* in mono is a defect.

**The Command Rule:** a command name stays in Archivo 800 — the streamer chose that
word, so it is language, not machine output.

### Spacing, shape, elevation

- Spacing steps actually used: 2, 5, 6, 7, 9, 10, 12, 14, 22, 26 px.
- **Zero corner radius everywhere.** Panes, buttons, inputs, switches, tags, the menu.
  Switch knobs are squares — nothing in this app rolls.
- **No shadows**, with exactly one exception: the context menu, at
  `0 6px 18px rgba(0,0,0,.22)`, because it genuinely floats. Panes are separated by
  rules and by their ground colour, never by elevation.

### Fixed dimensions

| Element | Size |
| --- | --- |
| Titlebar | 32 px tall |
| Tab strip | 34 px tall |
| Toolbar | 38 px tall |
| Toolbar controls | 26 px tall |
| Group tree | 186 px wide |
| Inspector | 298 px wide |
| Log pane | 150 px open / 24 px collapsed |
| Table row | 30 px |
| Inputs | 30 px (28 px in tight inspector rows) |
| Switch | 34 × 18 (inspector), 38 × 20 (settings), 12–14 px square knob |
| Window control buttons | 40 px wide, full titlebar height |

---

## Shell layout

```
┌ titlebar 32 · brand · connection · lang · theme · − □ ✕ ──────┐
├ tab strip 34 · Commands / Overlay / Activity / Settings ───────┤
├ [connection banner — only when disconnected] ──────────────────┤
├ toolbar 38 · New · Duplicate · Delete │ filter │ counts ────────┤
├──────────┬─────────────────────────────────┬──────────────────┤
│ tree 186 │ command table (fills)           │ inspector 298    │
│          ├─────────────────────────────────┤                  │
│          │ log 150 (collapses to 24)       │                  │
└──────────┴─────────────────────────────────┴──────────────────┘
```

The titlebar is `-webkit-app-region: drag` in WebView2 terms; the buttons within it are
no-drag. Keep the existing `WindowControls` RPC wiring.

### Responsive behaviour

Designed at 1280 × 760, supported down to 900 px wide. The table is
`table-layout: fixed` with percentage columns, so it truncates with an ellipsis rather
than scrolling sideways. As the window narrows the table sheds its rightmost data
columns:

| Below | Hides |
| --- | --- |
| 1180 px | `Last` column |
| 1060 px | `Writes` column |
| 960 px | `CD` column |

**Both side panes are permanent.** The tree is the only home of the group filters and
the Outputs readiness list; the inspector is the only place a command is edited. Neither
is ever hidden — the table is what yields. At 900 px the table still keeps ~400 px, which
holds Command, What it does, Who and CD. A narrow window must still show what is wired up
and let you fix it, which a wide table with no navigation would not.

---

## Screens

### 1 · Commands (home)

**Purpose.** Answer, in one screen: what can chat type, is it wired up, who can use it,
and did it fire? This replaces the old Home, Counters and Triggers views.

**Toolbar.** `New` (primary, `--accent-fill`), `Duplicate`, `Delete` (both 1 px outlined),
a divider, then a 210 px filter input with a search icon. `Duplicate` and `Delete` carry
the real `disabled` attribute and drop to 45 % opacity with nothing selected. With more
than one row selected the toolbar grows a mono selection count and a `Disable all`
button. Far right: a mono count line — `6 shown · 1 disabled`.

**Group tree (186 px).** A 10 px uppercase `Groups` kicker, then: `All commands` at 12 px
indent, and `Counters`, `Prepared replies`, `AI replies`, `Disabled` at 24 px indent. Each
row carries a mono count. The active group takes `--surface` plus a 2 px `--accent`
leading bar and weight 800.

Below, an `Outputs` kicker and a live readiness list — `OBS files · 2`, `Stream title`,
`Overlay · off` — each with a 7 px square: **filled = wired, hollow outline = off**. At
the bottom, a 10 px `--faint` line: "Everything is saved on this PC".

**Table.** Columns and widths: `Command` 22 %, `What it does` (auto — absorbs slack),
`Who` 15 %, `CD` 9 %, `Writes` 17 %, `Last` 11 %. Header is `--surface-2`,
`position: sticky; top: 0`, with a 2 px `--rule` bottom border and 10 px uppercase
`--muted` labels.

Row states:
- **Default** — command name Archivo 800 `--accent-text`; description with a `--muted`
  suffix; `CD` mono, or `Off` in `--faint` at zero; `Writes` a `·`-joined list
  (`file · title`, `chat`); `Last` a mono `--muted` timestamp, `—` if never.
- **Hover** — `--accent-soft` ground.
- **Selected** — `--accent-soft` ground plus a 2 px `--accent` leading bar.
- **Disabled** — command struck through and dropped to `--muted`, body cells `--muted`,
  and a bordered `DISABLED` tag pinned at the end of the description. **Full opacity.**
- **Errored** — the reason prints as a full-width `--accent-text` line in its own row
  directly beneath, with a 2 px `--accent` leading border.

Selection: plain click replaces, Ctrl/Cmd/Shift-click toggles. Right-click opens the
context menu, and selects the row first if it was not already in the selection.

**Context menu.** `Edit` (Enter) · `Duplicate` (Ctrl+D) · `Copy command` (Ctrl+C) ·
separator · `Disable` · separator · `Delete` (Del). Shortcut hints in muted mono at full
opacity. Hover fills the item with `--accent-fill` and its text with `--on-accent`.
Escape or any outside click closes it. **It must appear instantly — see Motion.**

**Docked log.** A 24 px header — a rotating chevron, a 10 px uppercase `Log` label, a
centred dashed drag grip, and a mono rate readout (`live · 38 msg/min`, or `paused` when
disconnected) — over a mono body on `--surface`. Collapses to the header alone. Each line
is `time · KIND · message`: `TRIGGER` in `--accent-deep`, other kinds `--muted`, and an
`ERROR` line entirely in `--accent-text`. Shows the last 7 entries; the full log lives on
the Activity tab.

**Inspector (298 px).** Docked, never a modal. Header carries the command in Archivo 800
19 px `--accent-text`, a 10 px uppercase kind line (`Counter command · Deaths`), and a
close button.

The body is the same order for every command kind — fields that do not apply to a kind
are **absent, not disabled**:

1. `Trigger word` — a 30 px input with a bold `--accent-text` `!` prefix (`"` for a
   contains-match Arabic phrase).
2. **Counters only:** `Effect` — a 3-up segmented control: `+1` / `−1` / `Reset`.
3. **Replies only:** `Match mode` — 4-up: `Exact` / `Starts` / `Contains` / `Regex`;
   then `Response`, a resizable Cairo textarea with `{mention}` `{username}` `{message}`
   token chips beneath.
4. `Who can use it` — 5-up: `All` / `Sub` / `VIP` / `Mod` / `Cast`.
5. `Cooldown` — a mono value and a 0–300 s range input with `accent-color: var(--accent)`.
6. A 2 px rule, then `Writes to` — three switch rows (`OBS text file`, `Stream title`,
   `Chat reply`), each with a mono detail line; off rows drop their title to `--muted`.
   When the file sink is on, a mono path input with a browse button follows.
7. A 2 px rule, then `Keybind` — the current combination in mono and a `Rebind` button.

**Footer — the signature element.** Permanently pinned, on `--surface`: a 10 px
uppercase `Right now this writes` label, then behind a 2 px `--accent` leading rule, in
mono, **the literal strings this command will produce** — the exact text going into the
OBS file and the exact resulting stream title. It updates as you type. This is what makes
the app trustworthy: you never alt-tab to OBS to find out what you configured. Below it, a
check glyph with a mono save timestamp, and a `Delete` button.

**Empty state.** Centred: `No commands yet`, one sentence of explanation, and the primary
`New` button. No illustration.

### 2 · Overlay

Left: a preview pane on `--surface-3` under a 34 px bar carrying a `Preview` label, a
mono `1920 × 1080 · 100%` readout, a hollow-square `Server off` status and a `Turn on`
primary button. The canvas is a 16:9 checkerboard (`repeating-conic-gradient`, 22 px)
holding bottom-anchored sample chat cards.

Each card is `rgba(0,0,0,.82)` with a 20 px square avatar, a bold 12 px coloured
nickname, and 13 px Cairo message text. **That fill is a contrast requirement**: nickname
colours are viewer-chosen, so the card must be dark enough that any Twitch nick clears AA
on it (worst measured 8.89:1). Do not lighten it.

Right (300 px): `Overlay settings` — six labelled segmented controls (`Card style`,
`Text size`, `Grow direction`, `Avatars`, `Hide commands`, `Message lifetime`), each with
a mono current value; then a 2 px rule and `Browser source URL` — a mono readonly input
with a copy button and a one-line hint.

### 3 · Activity

A 38 px filter bar of kind chips (`All`, `TRIGGER`, `WRITE`, `DENY`, `SKIP`, `ERROR`) —
active chip filled `--accent-fill` — and a right-aligned `Clear` button. Below, the full
log as a mono three-column grid: a `--faint` timestamp, a 64 px `--muted` kind, and the
message. `ERROR` lines print in `--accent-text`.

### 4 · Settings

A 210 px section tree (`General & Appearance`, `System & Window`, `Keybinds`,
`Twitch & Bot`, `AI Providers`, `Setup Guide`) styled exactly like the Commands group
tree, beside a 660 px content column.

Each section is a page title, a 2 px rule, then a list of field rows. Every row is
`label + hint` on the left and its control on the right, separated by a 1 px hair rule.
Four control types only: segmented, switch, mono text input, and a primary action button.

**The app has no dropdowns.** Segmented controls or a tree, nothing else.

---

## Interactions & behaviour

| Interaction | Behaviour |
| --- | --- |
| Tab click | Instant. No transition |
| Row click | Selects, loads the inspector |
| Ctrl/Cmd/Shift-click | Toggles that row in the selection |
| Right-click row | Selects if needed, opens context menu at the cursor, clamped inside the window |
| Escape | Closes the context menu |
| Outside click | Closes the context menu |
| Log header click | Collapses / expands the log pane |
| Inspector close | Clears the selection, shows the no-selection state |
| Toolbar `Disable all` | Disables every selected row |
| Filter input | Live-filters on command name and description |
| Group click | Filters the table |
| Theme / language / connection | Switch the whole shell live |

### Motion

**There is none.** No page transitions, no tab-change animation, no animated counters, no
menu fade.

This is a correctness position, not only an aesthetic one. The context menu originally
faded in from `opacity: 0`, which is unsafe in this app specifically: browsers — WebView2
included — pause animations on a hidden or occluded document, and **while a CSS animation
sits paused at t=0 the 0 % keyframe applies regardless of `animation-fill-mode`**
(`forwards` does not help; fill modes only govern time *outside* the active interval).
Since this app starts minimised to the tray and its entire workflow is alt-tabbing out to
a fullscreen game, that produced an invisible menu that still swallowed the next click —
fail-closed, above a full-viewport backdrop.

**Never animate an element into existence from `opacity: 0`.** If motion is added later,
animate from the element's natural visible state, so a paused animation degrades to "no
animation" rather than "no element".

### State communication

- **Disconnected** — a 2 px `--accent`-framed banner on `--accent-soft`, directly beneath
  the tab strip: an alert icon, the plain-language consequence in bold ("No commands will
  fire."), an explanation that the table below is *saved configuration, not live
  behaviour*, and one `Connect Twitch` action. The connection pill in the titlebar turns
  `--accent-text` with a hollow square, and the log rate readout reads `paused`.
- **Wired vs off** — filled square vs hollow square, in the tree's Outputs list and on
  the overlay status.
- **Success** — a check glyph and a mono timestamp in the inspector footer. **No toasts
  anywhere in the app.**
- **Error** — a full-width reason line under the offending row, plus a red `Writes` cell.
  Because red is already the command colour, failure also carries a *form* signal (a
  leading 2 px border, a framed tag) rather than relying on hue alone.

---

## State management

Map onto the existing `zustand` stores. Nothing here needs new persistence beyond what
the app already has.

| State | Type | Notes |
| --- | --- | --- |
| `theme` | `'light' \| 'dark'` | **New.** Defaults to following Windows; persist the override |
| `language` | `'en' \| 'ar'` | Existing |
| `tab` | `'commands' \| 'overlay' \| 'activity' \| 'settings'` | Replaces the old tool routing |
| `group` | `'all' \| 'counters' \| 'replies' \| 'ai' \| 'disabled'` | New, UI-only |
| `selected` | `string[]` | **Array** — multi-select is required |
| `query` | `string` | Filter text, UI-only |
| `logOpen` | `boolean` | Persist |
| `logFilter` | log kind | Activity tab |
| `menu` | `{x, y} \| null` | Context menu position |
| `section` | settings section id | |
| `connected` | `boolean` | From the existing RPC connection state |

The command list is a **derived view** over the existing counter and auto-reply stores —
do not introduce a fourth store. One counter projects to three command rows (increase,
decrease, reset) that share a count, a file sink and a title template; edits to any of
them write back to the same counter record. This projection is the main piece of new
logic in the port, and the one place to be careful: the `Disabled` group count must
report *commands*, not underlying records.

## i18n and RTL

**The shell stays LTR in both languages** — this is a decision, not an oversight, and it
matches the current app's behaviour. Command names are Latin, times and counts are
numeric, and mirroring the workspace would move the Windows controls.

What flips is **content**: every user-authored string carries `dir="auto"` — the
description cell, the response textarea, the trigger-word input, the log message column,
and the overlay preview. Arabic UI labels render in Cairo; Latin data inside an Arabic UI
stays in Archivo / IBM Plex Mono.

All UI strings in the prototype exist in both languages — lift them into
`src/i18n/translations.ts` rather than retyping. New keys the redesign introduces include
the tab names, group names, column heads, `Writes to`, `Right now this writes`,
`DISABLED`, the disconnected banner copy, and the overlay control labels.

## Accessibility — please do not skip this

Contrast was measured composited against the actual opaque ground each colour sits on,
including the accent-tinted selected row, the accent-fill hover ground, and disabled
rows, in both themes. All interface type here is ≤ 13 px, so **4.5:1 applies throughout**
— the 3:1 large-text allowance never does.

| Role | Light | Dark |
| --- | --- | --- |
| `--muted` (incl. disabled rows) | 6.20:1 | 7.54:1 |
| `--faint` | 4.85:1 | 5.65:1 |
| `--accent-text` | 5.68:1 | 5.12:1 |
| `--accent-deep` (log kinds) | 5.68:1 | 7.36:1 |
| `--on-accent` on `--accent-fill` | 4.82:1 | 5.90:1 |
| Overlay nicknames on the card | 8.89:1 | 8.89:1 |

Two deliberate exemptions: `--accent` at 3.76:1 is never type, and the toolbar's genuinely
`disabled` buttons at 45 % opacity are inactive components.

**Re-measure after any token change.** `--faint` and `--accent-fill` have roughly a third
of a point of margin — neither survives being nudged.

Three named rules that are easy to break in a port:

- **The No-Dimming Rule.** Never carry a state with `opacity` on anything holding type.
  Opacity multiplies against the token's own alpha, so a `--muted` label inside a 45 %
  row lands near 2:1 however the token is tuned — the disabled rows failed exactly this
  way. State is carried by form and an explicit colour: struck through, tagged,
  re-coloured, at full opacity. The only permitted `opacity` is on controls carrying the
  real `disabled` attribute.
- **The One Accent Rule.** Red means "command" or "the primary action here". Which of the
  three red tokens you reach for is decided by what the red is *doing* — a rule, some
  type, or a fill under type — never by how it looks.
- **The Chrome Recession Rule.** Chrome sits on `--surface-2`, content on `--surface`. A
  pane holding the user's data is always the lighter one (in dark, the *less* black one).

Also required:

- `:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px }` on every
  interactive element. No default blue rings.
- Switches are `role="switch"` with `aria-checked`; segmented groups are
  `role="radiogroup"`; the context menu is `role="menu"` / `role="menuitem"`.
- Tab strip, tree, table, log and inspector all reachable by Tab in reading order.
- `prefers-reduced-motion` has nothing to suppress, because there is no motion.

## Assets

- **Icons — Lucide**, as the app already uses (`lucide-react`). The prototype inlines an
  SVG sprite only because it is a standalone file; **use `lucide-react` in the port.**
  Icons used: `plus`, `minus`, `square`, `x`, `copy`, `trash-2`, `search`, `folder-open`,
  `check`, `triangle-alert`, `chevron-right`, `sun`, `moon`, `key-round`.
- **Fonts** — Archivo, IBM Plex Mono, Cairo. The prototype pulls them from Google Fonts;
  in the desktop app, vendor them via `@fontsource` as the project already does for Cinzel
  and Cairo, so the app works offline.
- **No images, illustrations or decorative graphics anywhere.** The only non-text visuals
  are 7 px status squares and the overlay checkerboard.
- The old `#8a4f1d` ember accent, Cinzel, and the parchment ground are fully retired.
  `src/index.css` will need its font imports and CSS variables replaced.

## Files in this bundle

| File | What it is |
| --- | --- |
| `Streamer Hub.dc.html` | **The design.** Open in a browser; fully interactive |
| `support.js` | Runtime the prototype needs. Not for porting |
| `DESIGN.md` | The written spec — tokens, components, states, rules |
| `Current UI (before).dc.html` | Recreation of the previous UI, for diffing |
| `_ds/modernist-…/styles.css` | The Modernist design-system token sheet the palette derives from |
| `_ds/modernist-…/_ds_bundle.js` | Its component bundle |

## Suggested file map in the target repo

Derived from reading the current source. Adjust as the codebase has moved on.

| Repo path | Action |
| --- | --- |
| `src/index.css` | Replace font imports and CSS variables with the tokens above; add the `[data-app="dark"]` block |
| `src/App.tsx` | Replace sidebar routing with the tab strip; add the disconnected banner |
| `src/components/layout/Sidebar.tsx` | Retire; becomes the Commands group tree |
| `src/components/titlebar/Titlebar.tsx` | Restyle to 32 px; add the theme toggle |
| `src/components/titlebar/ConnectionIndicators.tsx` | Becomes the single connection pill |
| `src/components/tools/home/HomeView.tsx` | **Delete.** The command table is now home |
| `src/components/tools/counter/CounterView.tsx` | Becomes the command table (counter rows) |
| `src/components/tools/counter/CounterCard.tsx` | **Delete.** Cards become table rows |
| `src/components/tools/counter/CounterConfigPanel.tsx` | Becomes the docked inspector — **no longer a modal** |
| `src/components/tools/counter/ActivityLog.tsx` | Split into the docked log pane and the Activity tab |
| `src/components/tools/auto-replies/AutoRepliesView.tsx` | Merges into the command table |
| `src/components/tools/auto-replies/ReplyComposer.tsx` | Moves into the inspector |
| `src/components/tools/chat/ChatView.tsx` | Becomes the Overlay tab |
| `src/components/tools/settings/SettingsView.tsx` | Restructure to tree + field rows; drop the pill nav |
| `src/components/ui/*` | Restyle `Button`, `Input`, `Switch`, `Slider`, `SegmentedControl`, `Badge`; retire `Card` |
| `src/i18n/translations.ts` | Add the new keys; lift the Arabic strings from the prototype |
| `DESIGN.md` | Replace the repo's copy with the one in this bundle |

## Known gaps

Be explicit with whoever picks this up — these are **not** designed, and should not be
improvised silently:

1. **The Overlay tab's canvas editor.** What is designed is the surrounding chrome, the
   preview treatment and the settings column. The actual editing behaviour still needs
   wiring to the existing overlay implementation.
2. **Settings field lists are representative, not exhaustive.** The six sections show the
   *pattern* (label + hint + one of four control types). Reconcile against the real
   `settingsStore` and keep every existing option — the redesign must not silently drop a
   setting.
3. **Loading states** are specified in `DESIGN.md` (the table keeps its header and shows
   hairline skeleton rows) but are not built in the prototype.
4. **Keybind capture UI.** The `Rebind` button is designed; the capture interaction is
   not.

## Acceptance checklist

- [ ] No modals anywhere; the inspector is docked
- [ ] Zero corner radius; no shadows except the context menu
- [ ] No motion; nothing animates in from `opacity: 0`
- [ ] No dimming used to convey state on anything holding type
- [ ] Type never set in `--accent`
- [ ] Contrast re-measured and matching the table above, in both themes
- [ ] Light and dark both complete; default follows Windows
- [ ] English and Arabic both correct; shell LTR, content `dir="auto"`
- [ ] Usable at 900 px wide with both side panes intact
- [ ] Multi-select, right-click menu, and collapsible log all working
- [ ] The inspector's "Right now this writes" footer shows live literal output strings
- [ ] Every counter, reply, keybind and setting from the old UI still reachable
- [ ] `tsc` clean, existing tests pass
