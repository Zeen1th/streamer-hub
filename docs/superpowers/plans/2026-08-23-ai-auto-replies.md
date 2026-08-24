# AI Auto-Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, streamer-configured OpenRouter AI responses to the existing Twitch auto-trigger rules while preserving static replies.

**Architecture:** The React UI stores rule configuration through the existing RPC boundary, but AI requests run in the C# host. The host stores the streamer’s OpenRouter key locally, never returns it to the UI, calls OpenRouter with bounded inputs, and sends the result through the existing Twitch send lock.

**Tech Stack:** .NET 8, C#, System.Text.Json, HttpClient, React 19, TypeScript, Zustand, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-23-ai-auto-replies-design.md`

## Global Constraints

- Existing saved static auto-replies must load unchanged and default to `responseMode: static`.
- The OpenRouter key must never be embedded in frontend assets or returned by settings RPC.
- The host must cap request input, output, timeout, and Twitch message length.
- The app must not send full chat history by default or automatically retry failed AI requests.
- Existing one-message-per-second Twitch sending and trigger cooldown behavior remain active.
- AI failures must not post empty messages; configured fallback text may be posted instead.

---

### Task 1: Add AI domain contracts and deterministic request helpers

**Files:**
- Modify: `core/Rpc/Contracts.cs`
- Modify: `src/rpc/contracts.ts`
- Create: `core/AI/OpenRouterClient.cs`
- Create: `src/lib/aiAutoReply.ts`
- Create: `src/lib/aiAutoReply.test.mjs`

**Interfaces:**
- `AutoReply` gains `responseMode`, `aiInstructions`, `aiModel`, `aiMaxTokens`, and `aiFallback` with static-safe defaults.
- `OpenRouterClient.GenerateAsync(string apiKey, string model, string instructions, ChatMessage message, int maxTokens, CancellationToken ct)` returns a bounded generated string or a typed failure result.
- TypeScript helpers expose `buildAiPrompt`, `truncateChatText`, and `selectFallback` for unit testing and frontend use.

- [ ] **Step 1: Write failing tests** for static defaults, prompt construction that includes only username/message/instructions, input truncation, generated-text extraction, and fallback selection.
- [ ] **Step 2: Run `node --experimental-strip-types --test src/lib/aiAutoReply.test.mjs`** and confirm the new cases fail before implementation.
- [ ] **Step 3: Add the C# and TypeScript contracts/helpers** with explicit length limits and no secret-bearing types in the frontend settings response.
- [ ] **Step 4: Run the focused Node tests** and confirm all new and existing auto-reply tests pass.

### Task 2: Persist OpenRouter configuration securely behind RPC

**Files:**
- Modify: `core/Storage/SettingsStore.cs`
- Modify: `core/Rpc/Envelope.cs`
- Modify: `core/Host/HostController.cs`
- Modify: `src/rpc/contracts.ts`
- Modify: `src/store/settingsStore.ts`

**Interfaces:**
- Native settings contain `OpenRouterSettings.ApiKey` and expose only `{ configured: boolean }` to the UI.
- Add RPC channels `OpenRouterGetState` and `OpenRouterSave` with save/remove operations; save responses never include the key.

- [ ] **Step 1: Add settings persistence and RPC contract tests or a host-level validation path** covering save, remove, reload, and redacted state.
- [ ] **Step 2: Implement `OpenRouterSettings` persistence** with empty-key removal and bounded key length.
- [ ] **Step 3: Register native handlers** that return only configured state and save/remove the key without logging it.
- [ ] **Step 4: Add the frontend settings-store methods** for hydrate, save, and remove.
- [ ] **Step 5: Build the native project with `dotnet build core\StreamerHub.csproj --no-restore -p:OutputPath=bin\ai-settings-verify\ -p:UseAppHost=false`** and run the frontend typecheck.

### Task 3: Run AI triggers in the native host

**Files:**
- Modify: `core/Host/HostController.cs`
- Modify: `core/Rpc/Envelope.cs`
- Modify: `src/rpc/contracts.ts`
- Modify: `src/store/autoReplyStore.ts`

**Interfaces:**
- Add `AutoRepliesGenerate` RPC accepting rule id, chat message, and optional fallback; the host resolves the stored rule/key and returns `{ ok, message?, usedFallback?, error? }`.
- The host enforces a global AI request window, a per-request timeout, model/token bounds, Twitch 500-character truncation, and no retries.

- [ ] **Step 1: Add tests for missing key, disconnected Twitch, rate limiting, timeout/error fallback, empty response, and successful response.**
- [ ] **Step 2: Implement the host request handler and `OpenRouterClient` call** using `HttpClient`, bearer authentication, JSON request/response parsing, and cancellation.
- [ ] **Step 3: Update chat handling** so static rules continue immediately and AI rules call the host; only mark/send a generated reply after a successful host result.
- [ ] **Step 4: Apply fallback only when configured** and log a short redacted status message without logging prompts, keys, or full AI responses.
- [ ] **Step 5: Run native build and focused tests**, then verify static rules still use the existing placeholder renderer.

### Task 4: Add AI configuration UI to Settings

**Files:**
- Modify: `src/components/tools/settings/SettingsView.tsx`
- Modify: `src/i18n/translations.ts`
- Modify: `src/store/settingsStore.ts`

**Interfaces:**
- Settings shows a masked OpenRouter key field, configured indicator, save/remove controls, and an explanation that the streamer supplies their own key.

- [ ] **Step 1: Add English and Arabic translation keys** for OpenRouter setup, privacy, configured state, save, remove, and errors.
- [ ] **Step 2: Add the settings card** with a password input, save/remove actions, and redacted configured state.
- [ ] **Step 3: Wire the card to the settings RPC methods** and show success/failure feedback without exposing the key.
- [ ] **Step 4: Run `npm run build`** and verify Arabic layout does not alter the fixed titlebar controls.

### Task 5: Add AI mode to the auto-reply Customize focus modal

**Files:**
- Modify: `src/components/tools/auto-replies/AutoRepliesView.tsx`
- Modify: `src/store/autoReplyStore.ts`
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- Add an “Answer type” control with prepared reply and AI reply modes.
- AI mode shows instructions, model, max response length, fallback reply, and a test button; static mode keeps the current drag-and-drop composer unchanged.

- [ ] **Step 1: Add UI tests or pure helper assertions** for mode defaults, AI fields, and preview/fallback behavior.
- [ ] **Step 2: Add the answer-type selector** and preserve existing static rules when switching modes.
- [ ] **Step 3: Add AI instruction, model, max-length, fallback, and test controls** with clear novice-friendly copy.
- [ ] **Step 4: Add a generated preview state** that displays loading, success, fallback, and failure without sending a live message unless the user confirms the test action.
- [ ] **Step 5: Run frontend build and inspect the focus modal at English and Arabic directions.**

### Task 6: Full verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-ai-auto-replies-design.md` only if implementation decisions materially differ.
- Modify: `docs/superpowers/plans/2026-08-23-ai-auto-replies.md` to check completed steps.

- [ ] **Step 1: Run `node --experimental-strip-types --test src/lib/autoReplyRules.test.mjs src/lib/aiAutoReply.test.mjs`.**
- [ ] **Step 2: Run `npm run build`.**
- [ ] **Step 3: Run the native .NET build to a separate verification output folder.**
- [ ] **Step 4: Confirm old settings deserialize, no OpenRouter key appears in frontend output, and no logs contain the key.**
- [ ] **Step 5: Report the exact files changed, verification results, and first-run instructions for entering a streamer-owned OpenRouter key.**
