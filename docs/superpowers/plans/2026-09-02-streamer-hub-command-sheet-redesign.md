# Streamer Hub Command Sheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the legacy feature-navigation frontend with the approved command-centric desktop workspace while preserving all RPC-backed counter, reply, overlay, keybind, update, connection, and settings behavior.

**Architecture:** Keep the existing Zustand domain stores and typed RPC layer. Add a pure command-projection module plus a UI-only workspace store, then compose a four-tab shell from focused React components. Existing overlay editing, settings, and keybind capture remain intact but are restyled and embedded without modal presentation.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Tailwind CSS 4, Lucide React, Vite 6, WebView2 typed RPC.

**Spec:** `design_handoff_streamer_hub/README.md` and `design_handoff_streamer_hub/DESIGN.md`

## Global Constraints

- No modals, no motion, zero corner radius, and no shadows except the context menu.
- Never use `--accent` for text; use `--accent-text` or `--accent-fill`/`--on-accent`.
- Never convey state with opacity except controls carrying the native `disabled` attribute.
- Preserve English/Arabic with an LTR shell and `dir="auto"` on user-authored content.
- Keep both side panes at 900 px and shed table columns at 1180/1060/960 px.
- Preserve the current overlay canvas editor, exhaustive settings, loading signals, and inline keybind capture without inventing new behavior.
- Do not commit or push.

---

### Task 1: Command projection and workspace state

**Files:**
- Create: `src/lib/commandProjection.ts`
- Create: `src/lib/commandProjection.test.mjs`
- Modify: `src/store/toolStore.ts`

**Interfaces:**
- Produces `projectCommands(counters, replies, timestamps, bindings): CommandRow[]` and `filterCommands(rows, group, query): CommandRow[]`.
- Produces UI state for tab, group, selected row ids, query, log open state, log filter, menu position, and settings section.

- [x] Write projection tests for three counter commands, reply/AI grouping, disabled command counts, sink labels, filtering, and literal output rendering.
- [x] Run the new test and verify failure because the projection module does not exist.
- [x] Implement the pure projection helpers and typed UI store.
- [x] Run the new test and the existing JavaScript tests.

### Task 2: Tokens, fonts, primitives, and shell

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/index.css`, `src/App.tsx`
- Modify: `src/store/settingsStore.ts`
- Modify: `src/components/titlebar/Titlebar.tsx`, `src/components/titlebar/ConnectionIndicators.tsx`
- Modify: `src/components/ui/Button.tsx`, `Input.tsx`, `Switch.tsx`, `Slider.tsx`, `SegmentedControl.tsx`, `Badge.tsx`, `Field.tsx`
- Replace: root `DESIGN.md` from the approved handoff copy

**Interfaces:**
- Adds offline Archivo and IBM Plex Mono fonts.
- Resolves system/light/dark preference without changing RPC persistence.
- Produces a 32 px titlebar, 34 px tab strip, nonmodal connection/update/language state, and shared square controls.

- [x] Add a failing theme-resolution test.
- [x] Install the two font packages and implement exact design tokens.
- [x] Restyle shared primitives with focus-visible semantics and no transitions.
- [x] Replace feature navigation with the four-tab shell while retaining boot/event wiring and window controls.
- [x] Run typecheck and focused tests.

### Task 3: Commands workspace

**Files:**
- Create: `src/components/commands/CommandsView.tsx`, `CommandTree.tsx`, `CommandTable.tsx`, `CommandInspector.tsx`, `CommandContextMenu.tsx`, `DockedLog.tsx`
- Reuse: current counter, auto-reply, keybind, log, and RPC store actions.

**Interfaces:**
- Consumes `CommandRow[]` from Task 1 and writes edits to `counterStore`/`autoReplyStore` only.
- Selection keys use `counter:<id>:<action>` and `reply:<id>`.

- [x] Add failing tests for selection toggling and context-menu clamping helpers.
- [x] Build toolbar, permanent tree, fixed-layout table, responsive column ladder, multi-selection, group/query filtering, disabled/error rows, and instant context menu.
- [x] Build the docked inspector with applicable-only fields, existing inline keybind capture, sinks, literal output footer, and deletion.
- [x] Build the last-seven docked log with collapse persistence.
- [x] Run tests and typecheck.

### Task 4: Overlay, Activity, and Settings tabs

**Files:**
- Modify: `src/components/tools/chat/ChatView.tsx`, `ChatCanvas.tsx`, `ChatSettingsPanel.tsx`
- Modify: `src/components/tools/counter/ActivityLog.tsx`
- Modify: `src/components/tools/settings/SettingsView.tsx`, `KeybindSettings.tsx`, `FeatureKeybindEditor.tsx`

**Interfaces:**
- Existing overlay canvas/editor and history APIs remain unchanged.
- Existing settings-store and RPC actions remain the source of truth.

- [x] Restyle the overlay shell and preserve every current editor control; replace the zoom dropdown with a segmented control.
- [x] Restyle Activity as a full-height filterable three-column log.
- [x] Restyle Settings as a permanent 210 px tree plus 660 px field rows, keeping every current setting and inline keybind workflow reachable.
- [x] Remove all legacy modal/backdrop presentation.
- [x] Run tests and typecheck.

### Task 5: Localization, accessibility, fidelity, and verification

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify any files above only as required by verification.

- [x] Add every new English and Arabic label via `t()` and apply `dir="auto"` to user-authored content.
- [x] Measure token contrast against both themes and selected/filled grounds.
- [x] Build and inspect 1280×760 and 900×760 in light, dark, English, Arabic, connected, and disconnected states.
- [x] Verify keyboard order, roles, focus rings, context-menu escape/outside-click, multi-select, column shedding, and collapsed log.
- [x] Run the Impeccable detector once, batch-fix mechanical findings, then run one confirmation capture round.
- [x] Run all JavaScript tests, TypeScript/Vite build, and existing .NET test executables/projects.
- [x] Check every item in the handoff acceptance checklist and report any remaining gap explicitly.
