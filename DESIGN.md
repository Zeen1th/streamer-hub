---
name: Streamer Hub
description: A streamer's diegetic tool shrine — chat commands become living on-stream counters.
colors:
  ember-amber: "#8a4f1d"
  ash-blue: "#41587d"
  moss-green: "#3d5527"
  hollow-violet: "#5d4a7e"
  blood-red: "#8f2f23"
  bone-paper: "#e8e2d2"
  raised-bone: "#f5f0e4"
  char-ink: "#241b13"
  parchment: "#f0e9d8"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "72px"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ember-amber}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    height: "44px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.raised-bone}"
    textColor: "{colors.char-ink}"
    typography: "{typography.label}"
    height: "44px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.raised-bone}"
    textColor: "{colors.blood-red}"
    typography: "{typography.label}"
    height: "44px"
    padding: "0 16px"
  input-field:
    backgroundColor: "{colors.raised-bone}"
    textColor: "{colors.char-ink}"
    typography: "{typography.mono}"
    height: "44px"
  slab-card:
    backgroundColor: "{colors.raised-bone}"
    padding: "24px"
---

# Design System: Streamer Hub

## Overview

**Creative North Star: "The Bonfire HUD"**

Streamer Hub is a diegetic game interface: the same visual language a Souls-like game paints onto its own screen. Every panel is an engraved stone slab resting in a dim shrine; the only warmth on the surface is ember light, and it appears exactly where something is alive — a connected channel, a triggered counter, a ready button. The counter is the monument: three carved digits, 72px tall, lit from behind, the one number on the surface a streamer reads mid-game from across the room.

The system is built for glance-and-go, not for touring. Depth is tonal (stone on stone), never shadowed; decoration is engraving, never ornament; state is formal — hollow, dashed, struck, glowing — with hue only reinforcing what the form already says. The replaced look (a theatrical art-deco marquee) and the category default (a soft dark SaaS dashboard) are both confirmed anti-references: neither returns.

**Key Characteristics:**
- Engraved stone slabs with hairline inset bevels instead of floating cards
- Ember amber as the single warm accent, used sparingly and only where something kindles
- Cinzel carved capitals for inscriptions; Barlow for controls; JetBrains Mono strictly for data
- A single light "ashen morning" surface — warm paper, char ink, no theme switching
- One authored motion: the kindle — the counter's digits flash ember when the count changes

## Colors

The palette is a shrine at dawn: warm paper, char, and one ember. Every hue that is not ember stays cool and dim.

### Primary
- **Ember Amber** (#8a4f1d): The only warmth. Kindled status dots, primary buttons, focus rings, slider fill, the active nav hairline, and the radial glow behind the counter. Its rarity is the point: where ember is, something is alive or actionable.

### Secondary
- **Ash Blue** (#41587d): The cold companion accent. The `!` command prefix, SYSTEM badges, and secondary signals that must stay emotionally cool.

### Tertiary
- **Moss Green** (#3d5527): Confirmation and life. Trigger events in the feed, saved state, the connected shrine light.
- **Hollow Violet** (#5d4a7e): Pending and caution. Cooldowns, connecting states, sync-in-progress — always paired with a formal signal (dashed border, pulse).
- **Blood Red** (#8f2f23): Destruction and failure. The reset action, OBS write errors, close-button hover.

### Neutral
- **Bone Paper** (#e8e2d2): The app ground. Warm daylight paper, never pure white.
- **Raised Bone** (#f5f0e4): Panels, inputs, and controls — the slab that sits on the paper.
- **Char Ink** (#241b13): Text and hairlines. Near-black brown, not pure black.
- **Parchment** (#f0e9d8): Text on ember fills.

### Named Rules
**The Ember Economy Rule.** Ember appears only where something kindles: connected, triggered, focused, actionable. Everything else stays stone-cold. If two unrelated elements compete for ember on one screen, one of them is wrong.
**The One Paper Rule.** The system ships a single light surface defined once as CSS variables on `:root`. Every color in the app reads from those tokens; hardcoded hex values outside `src/index.css` are defects.

## Typography

**Display Font:** Cinzel (with Georgia, serif)
**Body Font:** Barlow (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** Cinzel is carved stone — chiseled Roman capitals with visible incision; Barlow is the quiet voice of the shrine's keeper; JetBrains Mono is the feed's instrument readout. The pairing reads as "inscription over equipment."

### Hierarchy
- **Display** (700, 72px, 1): The counter digits. One place, one number, nothing larger.
- **Headline** (600, 36px, 1.15): The page title, uppercase, beside the flame mark.
- **Title** (600, 18px, 1.2): Panel titles, uppercase, in the slab header.
- **Body** (400–700, 14px, 1.5): All control copy, hints, and descriptions.
- **Label** (700, 12px, 1.4, 0.08em, uppercase): Field labels, buttons, badges, nav items.
- **Mono** (400–700, 12–14px, 1.5): Timestamps, file paths, templates, feed messages, counts. Data only.

### Named Rules
**The Inscription Rule.** Cinzel marks inscriptions — counter digits, titles, the brand. It never appears in body copy or inside controls; a sentence set in Cinzel is a sentence carved into the wrong stone.
**The Data Rule.** JetBrains Mono is reserved for data and measurement. A label wearing mono as a "technical" costume is a defect, not a style.

## Layout

A fixed desktop shell: 40px titlebar (drag region, status, window controls) over a 224px tools rail and a scrolling content area, max width 1400px centered with 32px padding. Inside, the counter slab, trigger panel, and output panel sit on a 12-column grid (4/4/4) above a full-width feed; below 1280px the columns stack in the same order. Panels gap at 24px; the 4px base unit drives all inner rhythm. Headings carry more space above than below, and the page header ends in a single ember-inked rule that the content never crosses.

## Elevation & Depth

Depth is tonal, never shadowed: the raised stone slab (surface-2) is the only elevation, and it sits by color, not by shadow. Engraving carries the material: a 1px inset top highlight on every slab, a double inset hairline on the counter monument. The only glow in the system is ember light — status dots, the switch, the counter's backdrop — and it is light, not lift.

### Shadow Vocabulary
- **Engraved Slab** (`box-shadow: inset 0 1px 0 <bone 8%>`): every panel and input.
- **Monument Bevel** (`inset 0 1px 0 <bone 10%>, inset 0 0 0 1px <stone 55%>`): the counter slab only.
- **Ember Light** (`0 0 12px 1px <ember 40%>`): kindled status dots and the checked switch track — light emission, never a drop shadow.

### Named Rules
**The Stone Rule.** Panels sit; they never float. Any drop shadow, soft or hard, is a foreign material on this surface.
**The Kindled Light Rule.** Glow is emitted light from something alive. A glow on an idle element is a false fire and gets extinguished.

## Shapes

Rectangles, chiseled. Zero corner radius on panels, buttons, inputs, chips, and badges. Curves are reserved for what burns or rolls: the circular status dots, the round slider and switch thumbs (pill, 9999px). Borders are 1px hairlines of bone at 12–30% opacity — never thicker, never colored except the 1px ember nav hairline marking the active tool.

### Named Rules
**The Chisel Rule.** Every edge is a cut stone edge. A rounded corner on a container is a container from a different world; a curve on a control that does not roll is the same mistake.

## Components

### Buttons
Stone plates. Uppercase Barlow labels (700, 12px, 0.08em), 44px tall (48px on the counter), rectangular.
- **Primary:** Ember fill, cinder text; hover brightens, active dims (brightness filter — the plate heats, it doesn't change shape).
- **Outline:** Raised stone, bone text, hairline border; hover raises border to 60% and tints the plate.
- **Ghost:** Transparent plate, bone text, tint on hover.
- **Danger:** Blood outline and text on stone; hover fills blood with cinder text.
- **Focus:** 2px ember outline, 2px offset, on every interactive element.
- **Disabled:** 40% opacity, pointer-events off.

### Rank Seals (segmented control)
Chip row of selectable ranks (Everyone/Subs/VIP/Mods/Broadcaster). Unselected: stone plate, hairline border. Selected: ember fill with cinder text. Keyboard-navigable native radios with visible focus.

### Slab Panels
Raised stone with the engraved top edge; 24px inner padding; hairline bottom header divider when titled; Cinzel 18px uppercase title.

### Inputs & Fields
Raised stone, 44px tall, 1px hairline border, mono text, ember caret. Focus shifts the border to ember with a soft 2px ember ring. Placeholders sit at 65% bone; field labels are Barlow 700 uppercase with a 12px hint line below at 70% bone.

### Badges
Toned chips: each state color at 15% tint with a 50% border, the color itself as text — always ≥4.5:1 against its own tint. Used for feed kinds (Trigger/Cooldown/Denied/Manual/Reset/System/Obs) and statuses.

### Switch & Slider
The switch track is a 40×22px stone plate; checked, it fills ember with the engraved edge plus ember light, thumb rolling to cinder. The slider is a 2px hairline track with ember fill and a round ember thumb carrying a soft glow; 0S/300S mono marks below.

### Status Lights
Three states, one dot: **kindled** (filled ember with glow — connected), **waiting** (hollow ember ring, pulsing — connecting), **cold** (hollow ash ring — disconnected). Hue never carries the state alone.

### Navigation
The tools rail: Barlow 700 uppercase items, dim bone at rest; the active tool raises to full bone with a 1px ember hairline on the left edge and a raised tint. Upcoming tools carry a small SOON seal and stay inert.

### The Death Feed (signature)
Mono rows: timestamp, kind badge, message, count chip. Successful triggers glow in bone; permission denials are struck through in warning violet; cooldowns carry the seconds remaining. Newest first, capped, newest at the top.

### The Counter Monument (signature)
An engraved slab holding three 72px Cinzel digits over a radial ember glow, "DEATHS" carved small above, the last trigger below in mono. On any count change the digits perform the kindle — a 700ms ember flash, the system's one authored motion — then settle. Beneath it, three stone plates: −1, +1 (ember), Reset (blood).

## Do's and Don'ts

### Do:
- **Do** keep the counter the largest thing on the surface; its digits are the only 72px type.
- **Do** pair every state with its formal signal — hollow, dashed, struck, glowing — and let hue reinforce.
- **Do** use ember only for kindled/actionable things (The Ember Economy Rule).
- **Do** set data — timestamps, paths, templates, counts — in JetBrains Mono.
- **Do** read every color from the token variables in `src/index.css`; they are the single source of truth.

### Don't:
- **Don't** add drop shadows, rounded cards, or glass; panels sit, they don't float.
- **Don't** use gradient text; emphasis comes from weight and size.
- **Don't** add kickers or eyebrows above headings; the heading carries its own weight.
- **Don't** number sections or panels (01, 02…); the order carries no information.
- **Don't** use colored side borders thicker than 1px, hard offset shadows, or unicode glyphs as icons (Lucide icons are the drawn system).
- **Don't** set Cinzel below 18px or in body copy; inscriptions stay inscriptions.
