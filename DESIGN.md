---
name: Streamer Hub
description: A channel's command sheet — every counter, reply and AI rule as one row in one table.
colors:
  signal-red: "#ec3013"
  signal-red-dark: "#ff5436"
  accent-text: "#ae1800"
  accent-text-dark: "#ff5436"
  accent-fill: "#d62608"
  accent-fill-dark: "#ff5436"
  ink: "#201e1d"
  ink-dark: "#ece8e5"
  surface: "#f3f2f2"
  surface-dark: "#1b1817"
  surface-2: "#e8e7e5"
  surface-2-dark: "#141112"
  surface-3: "#dedcd9"
  surface-3-dark: "#0f0d0d"
  on-accent: "#faf9f8"
  on-accent-dark: "#16100e"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.3
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1em"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.75
  arabic:
    fontFamily: "Cairo, Archivo, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  all: "0px"
spacing:
  xs: "2px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    height: "26px"
    padding: "0 10px"
    fontWeight: 800
  button-outline:
    backgroundColor: "transparent"
    border: "1px solid var(--rule)"
    height: "26px"
    padding: "0 10px"
    fontWeight: 600
  input-field:
    backgroundColor: "{colors.surface}"
    border: "1px solid var(--rule)"
    height: "30px"
  table-row:
    height: "30px"
    borderBottom: "1px solid var(--hair)"
  table-row-disabled:
    opacity: 1
    textColor: "var(--muted)"
    commandDecoration: "line-through"
    tag: "DISABLED"
---

# Design System: Streamer Hub

## Overview

**Creative North Star: "The Command Sheet"**

Streamer Hub is not a dashboard and not a shrine. It is the place a streamer keeps
the list of things chat is allowed to do in their channel. The previous release
organised the app by feature — Counters here, Triggers there, Chat Overlay
somewhere else — which meant the same question ("what happens if someone types
`!death`?") was answered in three places. It now organises by the only object the
streamer actually owns: **the command**. A counter is three commands. An automatic
reply is one command. An AI reply is one command. They are all rows in one table.

The shell is a dense Windows desktop workspace, not a web page: a 32 px titlebar, a
tab strip, a compact toolbar, a group tree, the table, a properties inspector, and a
collapsible log docked at the bottom. Nothing is a modal. Nothing is centered. The
app is meant to be opened, changed, and closed in under a minute.

**Key characteristics**
- One table is the home screen; the "Writes to" column is the wiring made legible
- A docked inspector, never a dialog — the table stays readable while you edit
- A permanent "Right now this writes" footer showing the literal output strings
- Zero corner radius, 2 px structural rules, 1 px hairlines inside them
- Light and dark are one identity, not two themes; default follows Windows

## Colors

A single accent doing a single job: **this is a command, or this is the primary
action**. Everything else is ink on ground.

### Accent

The accent exists in three tokens, because one red cannot be both a 2 px rule and
readable 13 px type on a light ground.

- **`--accent`** (`#ec3013` / `#ff5436`) — **chrome only.** The brand square, the
  active tab's 2 px cap, the selected row's leading bar, the error row's leading bar,
  the disconnected banner's border, the slider fill, the focus ring. Against the light
  ground this measures 3.76:1 — correct for graphical objects, which need 3:1, and
  wrong for text, which needs 4.5:1. Never set type in it.
- **`--accent-text`** (`#ae1800` / `#ff5436`) — **accent as type.** Command names, the
  inspector subject, the `!` prefix, the error line, the "Not connected" label, a live
  "Writes" cell, links. 5.12:1 at worst across both themes.
- **`--accent-fill`** (`#d62608` / `#ff5436`) — **accent as a fill under
  `--on-accent` type.** The primary button, active segmented options, active log
  filters, switch tracks, the context-menu hover. 4.82:1 at worst.

In dark all three collapse to one value: `#ff5436` already clears 4.5:1 on the dark
grounds, so the split only does work in light.

### Neutrals
- **Surface** (`#f3f2f2` / `#1b1817`): the working ground — table, content panes.
- **Surface 2** (`#e8e7e5` / `#141112`): chrome — titlebar, tab strip, group tree,
  inspector, log header. Chrome is always one step back from content.
- **Surface 3** (`#dedcd9` / `#0f0d0d`): the overlay preview's dead area only.
- **Ink** (`#201e1d` / `#ece8e5`), **muted** (74 % / 72 %), **faint** (66 % / 60 %).
- **Rule** (40 % / 30 %) for 2 px structural dividers; **hair** (18 % / 13 %) for
  1 px row and field lines.

The muted and faint alphas are set by contrast measurement, not by eye: both carry
normal-size type (10–13 px column heads, field labels, log timestamps, the CD
column's "Off"), so both must clear 4.5:1 against the *darker* of the two grounds
they appear on. Lowering either alpha for a quieter look breaks the log — the app's
primary troubleshooting surface.

### Named rules
**The One Accent Rule.** Red means "command" or "the primary action here". If two
unrelated things are red on one screen, one of them is wrong. Which of the three red
tokens you reach for is decided by what the red is doing — a rule, some type, or a
fill under type — never by how it looks.

**The Error Exception.** Because red is already the command colour, failure cannot
be signalled by hue alone. Errors carry a *form* signal — a 2 px framed `ERROR` tag
in the log, a 2 px red frame around the disconnected banner, and the reason printed
as a full-width line under the offending row. Never a toast.

**The Chrome Recession Rule.** Chrome sits on surface-2, content on surface. A pane
that holds the user's data is always the lighter (in dark: the *less* black) one.

**The No-Dimming Rule.** Never carry a state with `opacity` on anything that holds
type. Opacity multiplies against the token's own alpha, so a `--muted` label inside a
45 % row lands near 2:1 no matter how the token is tuned — the app's own disabled rows
failed exactly this way. State is carried by form and by an explicit colour: struck
through, tagged, re-coloured at full opacity. The only permitted `opacity` is on
controls carrying the real `disabled` attribute, which are genuinely inactive and
therefore outside the contrast requirement.

## Typography

**Archivo** for everything that is language, **IBM Plex Mono** for everything that is
data, **Cairo** for Arabic.

- **Page title** — Archivo 800, 24 px, −0.015em. One per screen.
- **Inspector subject** — Archivo 800, 19 px, accent. The command being edited.
- **Row / body** — Archivo 400–500, 13 px.
- **Field title** — Archivo 800, 13–14 px.
- **Label** — Archivo 600, 10 px, 0.1em, uppercase. Column heads, group heads,
  section kickers.
- **Data** — IBM Plex Mono: timestamps, counts, file paths, templates, cooldowns,
  URLs, key combinations, the log, and the output preview.

### Named rules
**The Data Rule.** If a value is produced by the machine rather than written by the
user, it is set in mono. A label wearing mono as a costume is a defect.

**The Command Rule.** A command name is Archivo 800 in the accent — it is a word the
streamer chose, not machine output, so it stays in the language face.

## Layout

A fixed desktop shell, designed at 1280 × 760 and tested down to 900 px wide.

```
┌ titlebar 32 ────────────────────────────────────────────────┐
├ tab strip 34 · Commands / Overlay / Activity / Settings ─────┤
├ [connection banner — only when disconnected] ────────────────┤
├ toolbar 38 · New · Duplicate · Delete │ filter │ counts ──────┤
├──────────┬───────────────────────────────────┬──────────────┤
│ tree 186 │ command table (fills)             │ inspector    │
│          ├───────────────────────────────────┤ 298          │
│          │ log 150 (collapses to 24)         │              │
└──────────┴───────────────────────────────────┴──────────────┘
```

The table is `table-layout: fixed` with percentage columns, so it fits every window
width and truncates with an ellipsis rather than scrolling sideways. As the window
narrows the table sheds its rightmost data columns — Last, then Writes, then CD —
keeping Command, What it does and Who to the smallest supported size.

**Both side panes are permanent.** The group tree is the only home of the five group
filters and of the Outputs readiness list; the inspector is the only place a command is
edited. Neither is hidden at any supported size — the table is what yields, shedding
columns down the ladder above. At 900 px the shell spends 186 + 298 px on the panes and
the table keeps ~400 px, which holds Command, What it does, Who and CD. That is the
deliberate trade: a narrow window still shows you what is wired up and lets you fix it,
which a wide table with no navigation would not.

## Elevation & depth

There is none. Panes are separated by rules and by their ground colour. The only
shadow in the system is on the right-click context menu, because it genuinely floats
above the page (`0 6px 18px rgba(0,0,0,.22)`).

## Shapes

Zero radius everywhere — panes, buttons, inputs, switches, tags, the menu. Switch
knobs are squares, not circles: nothing in this app rolls.

## Components

### Tab strip
Four tabs in the chrome band. The active tab takes the content ground and a 2 px
accent cap (`inset 0 2px 0`), weight 800. Inactive tabs are muted, weight 500.

### Toolbar
26 px controls. One primary (accent fill), the rest 1 px outlined. Destructive and
duplicate actions drop to 45 % opacity with nothing selected. With more than one row
selected the toolbar grows a count and a bulk enable/disable.

### Group tree
Section kicker, then rows at 12 px indent (top level) or 24 px (children). The active
group takes the content ground and a 2 px accent bar on the leading edge. Counts are
mono and muted. Below the tree, a live "Outputs" list — filled square = wired, hollow
square = off.

### Command table
30 px rows. Columns: Command · What it does · Who · CD · Writes · Last.
- Selected row: accent-tint ground plus a 2 px accent leading bar.
- Disabled row: the command name is struck through and drops to `--muted`, the body
  cells go `--muted`, and a bordered `DISABLED` tag sits at the end of the
  description. **The row keeps full opacity.** Dimming would be the obvious move and
  it is the wrong one — see The No-Dimming Rule.
- Errored row: the reason prints as a full-width accent line directly beneath it.
- Ctrl/Cmd/Shift-click extends the selection; right-click opens the context menu and
  selects the row if it was not already in the selection.

### Inspector
Docked, never modal. Header (subject + kind + close), a scrolling body, and a fixed
footer. The body is the same order for every command kind: trigger word → effect or
match mode → who → cooldown → writes-to → keybind. Fields that do not apply to a kind
are absent, not disabled.

### The output preview (signature)
The inspector footer always shows, in mono behind a 2 px accent rule, the literal
strings this command will produce — the exact text going into the OBS file and the
exact stream title. It updates as you type. This is the element that makes the app
trustworthy: you never have to alt-tab to OBS to find out what you configured.

### Docked log
24 px header with a drag grip and a live rate readout; collapses to the header alone.
Mono rows: time, kind, message. `TRIGGER` is accent, everything else muted, `ERROR`
prints the whole line in accent. The full log with kind filters lives on the Activity
tab; the docked pane is the last seven lines.

### Context menu
Edit · Duplicate · Copy command · | · Disable · | · Delete, with shortcut hints in
muted mono. Hover fills the item with `--accent-fill`. Escape and any outside click
close it. It appears instantly — see Motion for why it must not fade.

### Switches
34 × 18 (inspector) or 38 × 20 (settings). Off: transparent track, muted square knob
at the leading edge. On: accent track, on-accent knob pushed to the trailing edge.

### Segmented controls
A single 1 px bordered row, 1 px dividers between options, active option filled with
the accent at weight 800. Used for effect, match mode, rank, and every settings
choice — the app has no dropdowns.

### States
- **Loading** — the table keeps its header and shows skeleton rows at hairline weight.
- **Empty** — centered title, one sentence, and the primary New button. No illustration.
- **Disconnected** — a 2 px accent-framed banner directly under the tab strip, with
  the plain-language consequence ("No commands will fire") and one action. The table
  below is explicitly described as saved configuration, not live behaviour.
- **Disabled** — the command name struck through and re-coloured to `--muted`, body
  cells `--muted`, a bordered `DISABLED` tag after the description, and CD/Writes
  reading `Off` / `—`. Full opacity throughout; still selectable and editable, which
  is precisely why it cannot be dimmed.
- **Success** — a check glyph and a mono timestamp in the inspector footer. No toast.
- **Warning / error** — see The Error Exception above.

## Motion

**There is none.** No page transitions, no tab-change animation, no animated counters,
no menu fade.

This is a correctness position as much as an aesthetic one. The context menu once
faded in from `opacity: 0`, and that is unsafe in this app specifically: browsers —
WebView2 included — pause animations on a hidden or occluded document, and while a CSS
animation sits paused at t=0 the 0 % keyframe applies *regardless of `animation-fill-mode`*
(`forwards` does not help; fill modes only govern the time outside the active
interval). Since this app is specified to start minimised to the tray and its whole
workflow is alt-tabbing out to a fullscreen game, that produced an invisible menu that
still swallowed the next click — a fail-closed state, above a full-viewport backdrop.

So: never animate an element *into* existence from `opacity: 0` or any other
non-default resting value. If motion is ever added here, animate from the element's
natural visible state so a paused animation degrades to "no animation" rather than "no
element".

## Accessibility

- Every interactive element takes `:focus-visible { outline: 2px solid var(--accent);
  outline-offset: 1px }`. No default rings.
- Switches are `role="switch"` with `aria-checked`; segmented groups are
  `role="radiogroup"`; the context menu is `role="menu"` / `role="menuitem"`.
- The tab strip, tree, table, log and inspector are all reachable by Tab in reading
  order; Escape closes the menu and clears the inspector.
- **Contrast.** Every text role clears WCAG AA 4.5:1, measured composited against the
  opaque ground it actually sits on — including the accent-tinted selected row, the
  accent-fill hover ground, and the disabled row. All interface type here is ≤ 13 px,
  so the 4.5:1 threshold applies throughout — the 3:1 large-text allowance never does.
  Worst cases:

  | Role | Light | Dark |
  | --- | --- | --- |
  | `--muted` (incl. disabled rows) | 6.20:1 | 7.54:1 |
  | `--faint` | 4.85:1 | 5.65:1 |
  | `--accent-text` | 5.68:1 | 5.12:1 |
  | `--accent-deep` (log kinds) | 5.68:1 | 7.36:1 |
  | `--on-accent` on `--accent-fill` | 4.82:1 | 5.90:1 |
  | Overlay preview nicknames | 8.89:1 | 8.89:1 |

  Two exemptions, both deliberate: `--accent` at 3.76:1 is never type (see Accent),
  and the toolbar's `disabled` buttons at 45 % opacity are inactive components. The
  overlay preview's nickname colours are viewer-chosen rather than ours, so its card
  fill is `rgba(0,0,0,.82)` — dark enough that any Twitch nick colour clears AA on it.
  Re-measure after any token change; the margin on `--faint` and `--accent-fill` is
  about a third of a point, so neither survives being nudged.
- The app has no motion at all, so `prefers-reduced-motion` has nothing to suppress —
  see Motion for why the one former animation was removed rather than gated.

## Internationalisation

The shell stays LTR in both languages, by decision: command names are Latin, times
and counts are numeric, and mirroring the whole workspace would move the window
controls. What flips is content — every user-authored string (`dir="auto"`), the
reply composer, the response cell, and the overlay preview. Arabic UI labels are set
in Cairo; Latin data inside an Arabic UI stays in Archivo/Plex Mono.

## Do's and Don'ts

### Do
- Put state in the row, not in a badge column.
- Show the literal output string wherever a template is edited.
- Keep chrome one ground-step behind content, in both themes.
- Use mono for anything the machine produced.
- Let the table truncate; never scroll it sideways.

### Don't
- Don't add a modal. The inspector exists so there is never a reason.
- Don't round a corner or add a drop shadow to anything that isn't the context menu.
- Don't hide either side pane to win table width; drop a column instead.
- Don't animate an element in from `opacity: 0` — see Motion.
- Don't use red for an error and a command on the same screen without a form signal.
- Don't set type in `--accent` — it fails 4.5:1 on the light ground. Use
  `--accent-text`, or `--accent-fill` if the type sits on top of it.
- Don't lower the `--muted` or `--faint` alpha to quieten a screen; that is what the
  10 px label size is for.
- Don't dim a row to show state. Strike it, tag it, re-colour it — see The No-Dimming
  Rule.
- Don't add a dropdown — segmented controls or a tree, nothing else.
- Don't animate the counter, the rows, or the tab change.
