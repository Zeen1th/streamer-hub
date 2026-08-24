# AI Auto-Replies Design

## Goal

Allow a streamer to configure an auto-reply trigger that asks an AI to answer as the streamer, while preserving the existing static-reply behavior.

## First-version scope

- Add a response mode to each auto-reply: `static` or `ai`.
- For AI mode, let the streamer enter plain-language instructions such as “Answer as the streamer, be funny and friendly, and keep the answer concise.”
- Use OpenRouter through its chat-completions API, defaulting to `openrouter/free`.
- Let the streamer enter their own OpenRouter API key in Settings. The key is stored by the native host in the existing local settings file for this first version; it is never embedded in the frontend bundle or sent to the UI.
- Add an AI cooldown, maximum output length, and optional fallback static reply per rule.
- Keep the existing trigger matching, multiple trigger fields, placeholders, focus mode, and undo behavior.
- Send the final answer through the existing Twitch account and existing one-message-per-second send lock.

## Data model

`AutoReply` gains:

- `responseMode`: `static` or `ai`, defaulting to `static` for old settings.
- `aiInstructions`: streamer-authored instructions.
- `aiModel`: default `openrouter/free`.
- `aiMaxTokens`: bounded output size.
- `aiFallback`: optional static text used if the AI call fails or returns no usable text.

Global settings gain an `OpenRouterSettings` object with the API key and an enabled/configured state. The API key is never returned by the settings RPC; the UI receives only whether a key is configured.

## Runtime flow

1. The frontend matches an incoming chat message against the first eligible rule and applies the rule cooldown.
2. Static mode renders placeholders and sends immediately as today.
3. AI mode asks the native host to generate a reply. The request includes only the matched message, username, and saved instructions.
4. The host validates the stored key, calls OpenRouter with a short system prompt and the rule instructions, trims the result, and limits it to Twitch’s 500-character message limit.
5. The host sends the generated text through Twitch using the existing send lock.
6. If generation fails, the host returns a safe error and the frontend uses the configured fallback, if any. No empty or failed AI response is posted.

## Safety and limits

- Never ship an OpenRouter key in the desktop executable or frontend assets.
- Never send full chat history by default.
- Bound instructions, input length, output tokens, request timeout, and generated message length.
- Enforce a per-rule cooldown and a global AI request limit in the native host.
- Do not automatically retry failed AI requests.
- Make the UI state clear that chat content is sent to OpenRouter.
- Log status and failures locally without logging the API key or full generated prompt.

## UI

The Customize focus modal gets an “Answer type” choice:

- Prepared reply
- AI reply

AI reply mode shows instruction text, model, maximum response length, fallback reply, and a test button. Settings gets an OpenRouter section with a masked key field, save/remove controls, and a configured indicator. The default copy explains that the streamer supplies their own key and that free models can be slower or unavailable.

## Error handling

- Missing key: show a configuration warning and do not post.
- Timeout, rate limit, provider error, invalid response, or empty response: use fallback if configured; otherwise log the failure and do not post.
- Twitch disconnected: do not call OpenRouter if the channel is not connected.

## Verification

- Unit-test AI request validation, response extraction, truncation, and fallback selection.
- Preserve and rerun all existing auto-reply matching tests.
- Run the frontend build and native .NET build.
- Verify that existing saved static rules load unchanged.
