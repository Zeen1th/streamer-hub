# Auto Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let streamers configure exact-match chat messages that automatically receive replies from the streamer’s connected Twitch account.

**Architecture:** Store auto-reply rules beside counters in the existing local settings document. Match incoming chat in the frontend, then invoke a typed RPC command to the C# host, which sends `PRIVMSG` through the existing Twitch IRC connection. Apply per-rule cooldowns in the frontend and a host-wide send throttle as a safety boundary.

**Tech Stack:** React, Zustand, TypeScript, C# .NET 8, Twitch IRC over TLS, existing typed RPC bridge.

**Spec:** Approved in conversation on 2026-08-22.

## Global Constraints

- Replies are sent from the streamer’s connected Twitch account.
- Matching is exact after trimming surrounding whitespace.
- Rules support enabled/disabled state and cooldowns.
- The Twitch Client Secret remains unused and is never embedded.
- Existing counters and settings remain backward compatible.

---

### Task 1: Add tested auto-reply matching and cooldown logic

**Files:**
- Create: `src/lib/autoReplyRules.ts`
- Create: `src/lib/autoReplyRules.test.ts`

**Interfaces:**
- Produces `normalizeTrigger`, `matchesAutoReply`, and `cooldownRemainingSeconds` usage for the chat handler.

- [ ] Write failing tests for trimmed exact matching, Unicode text, disabled rules, and cooldown remaining time.
- [ ] Run the focused test command and confirm failure because the module does not exist.
- [ ] Implement the smallest pure functions needed by the tests.
- [ ] Run the focused tests and then the full test suite.

### Task 2: Persist auto-reply rules and expose typed RPC

**Files:**
- Modify: `core/Rpc/Contracts.cs`
- Modify: `core/Storage/SettingsStore.cs`
- Modify: `core/Rpc/Envelope.cs`
- Modify: `src/rpc/contracts.ts`
- Modify: `src/rpc/mockHost.ts`

**Interfaces:**
- `AutoReply` has `Id`, `Trigger`, `Response`, `Enabled`, and `CooldownSeconds`.
- RPC command `twitch/send-chat-message` accepts `{ message: string }` and returns `{ ok: boolean; error?: string }`.

- [ ] Add model and settings persistence with an empty default for old settings files.
- [ ] Add the typed channel and mock-host response.
- [ ] Build/typecheck to catch protocol mismatches.

### Task 3: Add outbound Twitch chat support with safety throttling

**Files:**
- Modify: `core/Twitch/ITwitchClient.cs`
- Modify: `core/Twitch/TwitchIrcClient.cs`
- Modify: `core/Host/HostController.cs`

**Interfaces:**
- `ITwitchClient.SendChatMessage(string message)` sends to the connected channel.

- [ ] Add a failing core build/test seam for the new interface contract.
- [ ] Implement IRC `PRIVMSG #channel :message` with message length limiting and a host-wide minimum interval.
- [ ] Register the RPC handler and reject empty/disconnected messages.
- [ ] Build the native project.

### Task 4: Add auto-reply store behavior

**Files:**
- Create: `src/store/autoReplyStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/store/logStore.ts` only if a new log kind is required.

**Interfaces:**
- Store actions: hydrate, add, update, remove, and `handleChatMessage`.
- Chat handling sends at most one matching rule per incoming message and records cooldown/sent events.

- [ ] Add tests for disabled rules, cooldown denial, and one-send-per-message behavior.
- [ ] Implement persistence through the existing settings RPC.
- [ ] Subscribe the store to Twitch chat events.
- [ ] Run focused tests and typecheck.

### Task 5: Build the Auto Replies configuration UI

**Files:**
- Create: `src/components/tools/auto-replies/AutoRepliesView.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- The view edits trigger, response, enabled state, and cooldown for each rule.

- [ ] Add the tool route and navigation entry.
- [ ] Render empty state, rule cards, add/delete actions, and validation for blank trigger/response.
- [ ] Add English and Arabic copy.
- [ ] Run the production frontend build.

### Task 6: Verify end-to-end behavior

**Files:**
- Modify: `PRODUCT.md` and `DESIGN.md` only if the implemented feature needs documentation updates.

- [ ] Confirm old settings files load with no auto-reply rules.
- [ ] Confirm Arabic exact matching and whitespace trimming.
- [ ] Confirm cooldown and global send throttles.
- [ ] Confirm Twitch disconnect and empty-message failures do not crash the app.
- [ ] Run `npm run build` and `dotnet build core\\StreamerHub.csproj --no-restore`.
