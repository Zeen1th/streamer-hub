# Chat Overlay Designer

**Date:** 2026-08-28
**Status:** Approved for planning
**Supersedes:** parts of `2026-08-26-chat-overlay-design.md` (settings model, preview, scaling)

## Problem

The chat overlay shipped in v0.1.17 works but is not solid. Four distinct problems:

1. **The overlay is implemented twice.** `src/chat-overlay.tsx` renders the OBS overlay with
   plain CSS. `src/components/tools/chat/ChatPreview.tsx` renders the same visual again with
   Tailwind classes. Every setting must be built twice, and the two drift.
2. **Styling is hardcoded.** Bubble width, username size, border, background, shadow, and the
   accent bar are baked into the stylesheet. Users cannot turn them off or change them.
3. **Scaling degrades quality.** `scale` is applied as `transform: scale()` on `.message-list`,
   which rasterizes at the base size and stretches the bitmap. Avatars compound this by being
   fetched at Twitch's small default size and upscaled.
4. **Content is incomplete.** Twitch emotes render as literal text. There is no way to filter
   users. The first message from any viewer shows no avatar. Moderated messages stay on screen.

## Goals

- One renderer, used by both the OBS overlay and the in-app editor.
- Every visual property user-controllable, expressed as a design token.
- Pixel-sharp output at any size.
- A direct-manipulation canvas: move, resize, and click-to-select parts of a message.
- Emotes rendered as images (Twitch, BTTV, FFZ, 7TV).
- User and content filtering.
- Avatars correct on the first message.
- Moderated messages removed from the overlay.

## Non-goals

- A general-purpose design tool with arbitrary layers, shapes, and images. Scene composition is
  OBS's job. The canvas edits the chat block and its anatomy, nothing else.
- Multiple simultaneous chat blocks.
- Overlays for anything other than chat (alerts, goals, timers).

---

## 1. Architecture

### 1.1 Shared renderer

A new `src/overlay/` module becomes the single implementation of the overlay's visuals:

| File | Responsibility |
| --- | --- |
| `src/overlay/ChatScene.tsx` | Renders the message list from settings + messages. No app or OBS specifics. |
| `src/overlay/ChatMessageCard.tsx` | Renders one message. Owns the selectable anatomy and its `data-part` attributes. |
| `src/overlay/MessageBody.tsx` | Renders tokenized message content (text runs + emote images) with BiDi isolation. |
| `src/overlay/overlay.css` | The one stylesheet. Contains no literal visual values — every property reads a custom property. |
| `src/overlay/tokens.ts` | `settingsToCssVars(settings)` — maps settings to CSS custom properties. |

`src/chat-overlay.tsx` becomes a thin host: connect the WebSocket, hold state, render `<ChatScene>`.
`ChatPreview.tsx` is replaced by `ChatCanvas.tsx`, which renders the same `<ChatScene>` inside an
editor stage. The Tailwind reimplementation of the message card is deleted.

**Rule:** `overlay.css` must not contain a literal colour, size, radius, or shadow. All of them come
from `tokens.ts`. This is what keeps the two consumers from drifting and makes "add a control" a
one-line change.

### 1.2 Settings shape (v2)

The flat 21-field `ChatOverlaySettings` becomes a versioned, grouped structure. Groups map 1:1 to
both the properties-panel sections and the selectable message parts, so selecting the username in
the canvas resolves directly to `settings.username`.

```ts
interface ChatOverlaySettings {
  version: 2;
  enabled: boolean;

  // Placement in a 1920x1080 reference space
  block: {
    x: number; y: number; width: number; height: number;
    anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };

  // Message flow
  flow: {
    maxMessages: number;        // 1..40
    durationSeconds: number;    // 0 (never expire) or 3..600
    displayMode: 'stacked' | 'latest';
    direction: 'up' | 'down';   // where new messages enter
    gap: number;                // 0..64
    sizeScale: number;          // 50..300, multiplies every pixel dimension
  };

  bubble: {
    background: { color: string; alpha: number };
    border: { width: number; color: string; radius: number };
    padding: { x: number; y: number };
    shadow: 'off' | 'soft' | 'hard';
    shadowColor: string;
    blur: number;                                        // backdrop blur, 0 = off
    accent: { width: number; colorMode: 'role' | 'custom'; color: string };
  };

  username: {
    show: boolean;
    font: FontChoice;
    size: number;                                        // absolute px, independent of text size
    weight: number;
    letterSpacing: number;
    colorMode: 'role' | 'twitch' | 'custom';
    color: string;
    transform: 'none' | 'uppercase' | 'lowercase';
    position: 'above' | 'inline';
  };

  text: {
    font: FontChoice;
    size: number;
    weight: number;
    color: string;
    lineHeight: number;
    letterSpacing: number;
    shadow: boolean;
    wrapMode: 'normal' | 'break-anywhere' | 'clip';
    maxWidth: number;                                    // px, 0 = fill block
  };

  avatar: {
    show: boolean;
    size: number;
    shape: 'circle' | 'rounded' | 'square' | 'squircle';
    position: 'left' | 'right';
    borderWidth: number;
    borderColorMode: 'role' | 'custom';                  // same pattern as username.colorMode
    borderColor: string;                                 // used when borderColorMode is 'custom'
  };

  badges: { show: boolean; style: 'text' | 'icon'; size: number };

  emotes: {
    twitch: boolean; bttv: boolean; ffz: boolean; sevenTv: boolean;
    sizeScale: number;                                   // relative to text size
    emoteOnlyScale: number;                              // extra scale for emote-only messages
  };

  filters: {
    blockedUsernames: string[];
    hideCommands: boolean;
    hideBots: boolean;
    botList: string[];
    blockedWords: string[];
    blockedWordAction: 'drop' | 'mask';
    minLength: number;                                   // 0 = off
  };

  animation: {
    kind: 'slide' | 'fade' | 'pop' | 'glow' | 'flip' | 'off';
    durationMs: number;
  };
}
```

`FontChoice` is `{ family: BuiltInFont | 'custom'; customName?: string }`, where `BuiltInFont` is the
existing five (`barlow`, `cairo`, `cinzel`, `jetbrains-mono`, `system`). A custom family name is
passed through to CSS; if the font is not installed the browser falls back and the panel shows a
"font not detected" hint via `document.fonts.check()`.

### 1.3 Migration

`normalizeChatOverlaySettings` gains version detection and a v1 to v2 migration:

- `alignment` + `scale` become a `block` rect. Each corner maps to a default rect inset 48px from
  that corner, sized 760 x 540. `scale` carries over to `flow.sizeScale` unchanged.
- `theme` selects the matching preset's token set (see §7), then the user's explicit v1 overrides
  (`fontSize`, `avatarSize`, `spacing`, `backgroundOpacity`, `textShadow`, `fontFamily`,
  `avatarShape`, `messageStyle`, `showUsernames`, `showAvatars`, `showBadges`, `compactMode`) are
  applied on top so nobody loses their configuration.
- `compactMode: true` maps to reduced `bubble.padding` and `flow.gap` rather than a boolean.
- Unknown or malformed values fall back per-field, as today. An unrecognised `version` resets to
  defaults rather than throwing.

Normalization stays a total function: any input produces a valid settings object.

---

## 2. Sharpness

Three changes, addressing three separate causes:

1. **Remove `transform: scale()` from the broadcast path.** `flow.sizeScale` is applied inside
   `settingsToCssVars` by multiplying every pixel token (font sizes, avatar size, padding, radius,
   gap, border widths) before they reach CSS. Text is then rasterized by the font engine at its
   true size instead of being stretched. The editor stage still uses a container transform to fit
   1920x1080 into the panel, which is correct — that is a viewport zoom, not output.
2. **Request larger source images.** Twitch avatar URLs are rewritten from their default variant to
   `-300x300`; emote URLs request the `3.0` variant. Both are then *downscaled* by CSS. Downscaling
   is sharp; upscaling is not. Rewriting is a pure function in `src/lib/imageVariants.ts` with a
   safe fallback to the original URL if the pattern does not match.
3. **Explicit intrinsic sizing.** Avatars and emotes get `width`/`height` attributes matching their
   layout box so the browser picks a high-quality downscale filter and layout does not shift on load.

The documented OBS setup becomes a 1920x1080 browser source placed at 100% scale in the scene. Any
scaling applied to the source *within OBS* reintroduces resampling and undoes the fix. We cannot
detect OBS-side scaling from the overlay, so this is handled as documentation: the setup panel states
the requirement explicitly next to the copyable browser-source URL.

---

## 3. Canvas and edit mode

`ChatCanvas.tsx` replaces the body of the old preview.

**Stage.** A fixed 1920x1080 stage fitted into the panel with a CSS transform on the container.
Zoom control offers Fit / 50% / 100%; at 100% the stage pans by drag or scroll. The zoom factor is
editor state, never persisted to settings.

**Backdrop.** Checkerboard by default, indicating transparency. The user may load a reference image
(a screenshot of their game or scene) to design against. The reference is stored as a local file
path in editor state, is never sent to the overlay, and never broadcast.

**Two modes**, toggled in the canvas header:

- *Preview* — live messages flow through, animations run, expiry applies. What viewers see.
- *Edit* — the flow freezes on a fixed sample set so the layout stops moving while being edited.
  The sample set deliberately covers the cases that break layouts: a long wrapping message, an
  RTL (Arabic) message, a mixed RTL/LTR message, an emote-only message, a broadcaster, a moderator,
  a message from a user with no avatar, and a single-word message.

**Block manipulation (Edit mode).** The block draws a selection frame with eight resize handles.
Dragging moves it; handles resize it. Snapping targets canvas edges, horizontal and vertical
centres, thirds, and a configurable safe-area inset; active snaps draw guide lines. Arrow keys nudge
by 1px, Shift+arrow by 10px. Holding Alt suppresses snapping.

All snap and hit-test geometry lives in `src/lib/canvasGeometry.ts` as pure functions over plain
rects, tested without React. The React layer only converts pointer events into calls against it.

**Element selection.** Every part of `ChatMessageCard` carries a `data-part` attribute
(`avatar`, `username`, `badge`, `bubble`, `text`). In Edit mode, clicking inside a message resolves
the clicked element to its nearest `data-part` ancestor, outlines it, and scrolls the properties
panel to that group's section with the section highlighted. Clicking the bubble background selects
`bubble`; Escape or clicking the stage returns selection to the block. Selection is editor state.

**Undo/redo.** A bounded history stack (50 entries) over settings snapshots, bound to Ctrl+Z and
Ctrl+Shift+Z. Continuous gestures (drag, resize, slider scrub) coalesce into one entry, pushed on
gesture end rather than per frame.

---

## 4. Filtering

`src/lib/chatOverlayFilters.ts` exposes pure predicates, applied in the store so that the in-app
canvas and the OBS overlay always agree on what is visible:

- **Blocked usernames** — case-insensitive exact match, with a trailing `*` for prefix matching
  (`spam*` blocks `spambot01`). Matched against both login and display name.
- **Hide commands** — drops messages whose first non-whitespace character is `!`.
- **Hide bots** — drops a default list (Nightbot, StreamElements, Streamlabs, Moobot, Fossabot),
  editable by the user. Separate from the blocklist so it can be toggled as a unit.
- **Blocked words** — whole-word, case-insensitive. Action is either dropping the message or masking
  the matched word. Masking replaces the word's characters with `*`, preserving length.
- **Minimum length** — drops messages shorter than N characters after trimming. Default 0 (off).

Filtering is applied to *display only*. Filtered messages still appear in the app's activity log, so
the user can tell a filter is working rather than silently losing messages.

---

## 5. Emotes

### 5.1 Twitch emotes (IRC tag)

`TwitchPrivmsgParser` currently discards the `emotes` tag. It gains parsing for:

- `emotes` — format `id:start-end,start-end/id2:start-end`. Produces `EmoteRange(Id, Start, End)`.
- `color` — the user's chosen Twitch chat colour, feeding `username.colorMode: 'twitch'`.

Both are added to the C# `ChatMessage` record and to `ChatMessage` in `src/rpc/contracts.ts`.

**Critical detail:** Twitch's emote indices are **code-point** offsets, not UTF-16 code-unit offsets.
A message containing an astral-plane emoji before an emote will mis-slice if indexed with `text[i]`.
Tokenization must iterate `[...text]`. This is the single most likely bug in this section and gets a
dedicated test with an emoji-before-emote fixture.

### 5.2 Third-party emotes

`core/Twitch/EmoteRegistry.cs` fetches global and channel emote sets from BTTV, FFZ, and 7TV on
connect, producing a `name -> url` map. Each provider is independently toggleable.

- Results cache in memory with a 6-hour TTL and refresh on reconnect.
- Each provider is fetched independently with a short timeout. A provider that fails, times out, or
  rate-limits is skipped; its emotes simply render as text. One failing provider never affects the
  others, and never blocks or delays chat.
- The map is pushed to the overlay as a new `emotes` envelope kind, sent after `hello` and on refresh.

### 5.3 Rendering

`src/lib/chatEmotes.ts` exposes `tokenizeMessage(text, twitchRanges, thirdPartyMap, options)`
returning `Array<{ type: 'text'; value: string } | { type: 'emote'; name: string; url: string }>`.

Twitch ranges are applied first by index. The remaining text runs are then split on whitespace and
matched word-by-word against the third-party map. A message whose tokens are all emotes (ignoring
whitespace) is flagged `emoteOnly` so the renderer can apply `emotes.emoteOnlyScale`.

Emote images carry `unicode-bidi: isolate` and `vertical-align: middle`, so they do not break the
BiDi isolation already implemented in `formatBidiText`, and do not disturb line rhythm.

Emote images that fail to load fall back to rendering their name as text.

---

## 6. Message patch channel

This is the mechanism behind both the avatar fix and moderation removal.

### 6.1 The avatar bug

**Root cause.** In `HostController.WireTwitch` (`core/Host/HostController.cs:485`), the profile
lookup is fire-and-forget and starts *after* the message has already been published:

```csharp
if (TryGet(message.UserId, out var avatarUrl))          // cache miss on first message
    publishedMessage = message with { AvatarUrl = avatarUrl };

PostEvent(Events.TwitchChatMessage, publishedMessage);  // published with no avatar
_ = PublishChatOverlayMessageAsync(publishedMessage);

if (!TryGet(message.UserId, out _))
    _ = ResolveTwitchUserProfileAsync(message.UserId);  // fetch starts here
```

Every user's first message is therefore published with a null avatar and renders the fallback
silhouette. The fetch populates the cache, so the second message hits. Additionally, the resolved
avatar is never back-propagated, so the first message keeps the silhouette for its whole lifetime.

**Fix.** Publish immediately, patch on resolve. Awaiting the fetch before publishing is rejected: it
puts a Helix round-trip in front of every new chatter's message, so a slow or failing Helix visibly
delays chat. Instead:

- A new `profile` envelope kind carries `{ userId, avatarUrl, color? }`.
- The store and the overlay patch every displayed message matching that `userId`, and the avatar
  cross-fades in.
- Messages published before resolution render the fallback, exactly as now, but only briefly.

**Two related defects fixed in the same pass:**

- `ResolveTwitchUserProfileAsync` is called with `new[] { userId }` — one HTTP request per new
  chatter, despite `TwitchUserProfileCache.ResolveAsync` supporting batches of 100. During a raid
  this is a request storm. A queue accumulates pending IDs and flushes on a 200ms debounce or at
  100 IDs, whichever comes first.
- A failed lookup writes `null` to the cache permanently, so a transient failure leaves a viewer
  avatar-less until restart. Negative results gain a 5-minute expiry and are retried.

### 6.2 Moderation removal

Twitch sends `CLEARMSG` (one message deleted) and `CLEARCHAT` (user timed out or banned, or the
whole chat cleared) on the connection already being read. `TwitchIrcClient` gains parsing for both,
raising a `ChatCleared` event carrying either a target message id, a target user id, or "all".

The host forwards these as a `clear` envelope. The store and overlay remove the matching messages
immediately, with a short fade rather than an abrupt disappearance.

This closes a real exposure: today a message a moderator deletes stays on the overlay for the full
message duration.

---

## 7. Presets

The five themes stop being render modes and become **starter presets** that write a complete token
set, which the user is then free to modify. Presets ship as data in `src/overlay/presets.ts`, not as
CSS branches.

Shipped presets: Dark, Light, Transparent, Neon, Ember, and a new **Bare** preset — no background,
no border, no shadow, no accent bar, text shadow on. Bare is the direct answer to "remove the border
and background"; the individual controls remain available for anyone who wants a middle ground.

Users can save the current settings as a named preset, rename, delete, and export/import presets as
JSON to share a look. Applying a preset is a single undoable action.

---

## 8. Contract changes

`ChatMessage` (both `src/rpc/contracts.ts` and `core/Rpc/Contracts.cs`) gains:

| Field | Type | Notes |
| --- | --- | --- |
| `emotes` | `EmoteRange[]` | From the IRC `emotes` tag. Empty when absent. |
| `color` | `string?` | From the IRC `color` tag. Null when the user has not set one. |

New overlay envelope kinds, alongside the existing `hello`/`chat-message`/`settings`/`connected`/`disconnected`:

| Kind | Payload | Purpose |
| --- | --- | --- |
| `profile` | `{ userId, avatarUrl, color? }` | Patch avatars onto displayed messages. |
| `clear` | `{ scope: 'message' \| 'user' \| 'all', id? }` | Moderation removal. |
| `emotes` | `{ providers: Record<string, Record<string, string>> }` | Third-party emote map. |

Unknown envelope kinds are ignored by the overlay, as they are today, so a newer host talking to a
cached older overlay degrades rather than breaks.

---

## 9. Testing

Pure logic is tested with `.test.mjs` files, matching the existing convention:

| File | Covers |
| --- | --- |
| `src/lib/chatOverlay.test.mjs` | v1 to v2 migration, per-field normalization, malformed input. |
| `src/lib/chatOverlayFilters.test.mjs` | Each filter, wildcard matching, masking, interaction between filters. |
| `src/lib/chatEmotes.test.mjs` | Twitch index slicing, **emoji-before-emote code-point case**, third-party word matching, emote-only detection, overlapping ranges. |
| `src/lib/canvasGeometry.test.mjs` | Snap targets, resize handles, hit-testing, Alt suppression, safe-area clamping. |
| `src/lib/imageVariants.test.mjs` | Twitch avatar and emote URL rewriting, unmatched-pattern fallback. |
| `src/overlay/tokens.test.mjs` | Settings to CSS variable mapping, `sizeScale` multiplication. |

C# parsing changes (`emotes` tag, `color` tag, `CLEARMSG`, `CLEARCHAT`) are covered in the existing
test projects under `tests/`.

Canvas interaction is deliberately split: geometry is pure and tested; the React layer only
translates events, and is verified manually against the sample message set.

---

## 10. Staging

The work is sequenced so each stage is independently shippable:

1. **Shared renderer** — extract `src/overlay/`, delete the duplicate. No user-visible change.
2. **Token model + settings v2** — migration, `settingsToCssVars`, properties panel rebuilt against
   groups. Delivers text wrap, fonts, name size, border/background removal.
3. **Sharpness** — remove transform scaling, image variant rewriting.
4. **Avatar fix + patch channel** — `profile` envelope, batching, negative-result expiry.
5. **Filters** — blocklists and content filtering.
6. **Emotes** — IRC tag parsing, then the third-party registry.
7. **Moderation removal** — `CLEARMSG` / `CLEARCHAT`, reusing stage 4's channel.
8. **Canvas** — stage, edit mode, block manipulation, element selection, undo/redo.

Stages 1 and 2 are prerequisites for everything else. Stage 8 is last because it depends on both the
shared renderer and the token model, and is the largest single piece.

## Risks

- **Third-party emote APIs are outside our control.** Mitigated by per-provider isolation, short
  timeouts, TTL caching, and failing soft to text.
- **Settings migration touches saved user configuration.** Mitigated by making normalization total,
  preserving explicit v1 overrides on top of the mapped preset, and covering migration with tests.
- **The canvas is the largest piece and the easiest to over-build.** Mitigated by the non-goals: one
  block, no arbitrary layers, geometry kept pure and separately tested.
