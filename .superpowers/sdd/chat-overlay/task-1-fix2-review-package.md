# Fix 2 review package
Base: 44db36002f91d8cb11e5493235fc66e66fa4226e
Head: 6d25e80edf6b61a7093ce6ed2e7c51c602da70f0

## Diff
diff --git a/src/lib/chatOverlay.test.mjs b/src/lib/chatOverlay.test.mjs
index f43cfab..0e88131 100644
--- a/src/lib/chatOverlay.test.mjs
+++ b/src/lib/chatOverlay.test.mjs
@@ -88,47 +88,43 @@ test('normalizes chat messages and uses a neutral avatar fallback', () => {
       message,
       timestamp: ' 2026-08-26T00:00:00.000Z ',
       userId: ' 12345 ',
       avatarUrl: 'javascript:alert(1)',
       isBroadcaster: true,
       isMod: false,
       isVip: false,
       isSubscriber: true,
     }),
     {
-      id: 'msg-1',
+      id: '  msg-1  ',
       username: username.trim().slice(0, 32),
       message: message.trim().slice(0, 500),
       timestamp: '2026-08-26T00:00:00.000Z',
       userId: '12345',
       avatarUrl: CHAT_OVERLAY_AVATAR_FALLBACK,
       isBroadcaster: true,
       isMod: false,
       isVip: false,
       isSubscriber: true,
     },
   );
 });
-test('does not reuse fallback ids for distinct missing-id messages', () => {
+test('does not reuse fallback ids for otherwise-identical missing-id messages', () => {
   const first = normalizeChatOverlayMessage({
     username: 'viewer',
     userId: '100',
     message: 'hello world',
     timestamp: '2026-08-26T00:00:00.000Z',
   });
 
   const second = normalizeChatOverlayMessage({
     username: 'viewer',
     userId: '100',
-    message: 'hello again',
-    timestamp: '2026-08-26T00:00:01.000Z',
+    message: 'hello world',
+    timestamp: '2026-08-26T00:00:00.000Z',
   });
 
   assert.notEqual(first.id, second.id);
-  assert.equal(first.id, normalizeChatOverlayMessage({
-    username: 'viewer',
-    userId: '100',
-    message: 'hello world',
-    timestamp: '2026-08-26T00:00:00.000Z',
-  }).id);
+  assert.match(first.id, /^chat-/);
+  assert.match(second.id, /^chat-/);
 });
 
diff --git a/src/lib/chatOverlay.ts b/src/lib/chatOverlay.ts
index e98fa14..ae94a23 100644
--- a/src/lib/chatOverlay.ts
+++ b/src/lib/chatOverlay.ts
@@ -51,30 +51,31 @@ export function normalizeChatOverlaySettings(value: Partial<ChatOverlaySettings>
     showUsernames: typeof input.showUsernames === 'boolean' ? input.showUsernames : DEFAULT_CHAT_OVERLAY_SETTINGS.showUsernames,
     showAvatars: typeof input.showAvatars === 'boolean' ? input.showAvatars : DEFAULT_CHAT_OVERLAY_SETTINGS.showAvatars,
     theme: oneOf(input.theme, ['light', 'dark', 'transparent'], DEFAULT_CHAT_OVERLAY_SETTINGS.theme),
     messageStyle: oneOf(input.messageStyle, ['rounded', 'square'], DEFAULT_CHAT_OVERLAY_SETTINGS.messageStyle),
     animation: oneOf(input.animation, ['slide', 'fade', 'off'], DEFAULT_CHAT_OVERLAY_SETTINGS.animation),
   };
 }
 
 export function normalizeChatOverlayMessage(value: Partial<ChatMessage> | null | undefined): NormalizedChatOverlayMessage {
   const input = value ?? {};
+  const suppliedId = typeof input.id === 'string' && input.id.trim().length > 0 ? input.id : '';
   const username = trimAndCap(input.username, 32) || 'viewer';
   const userId = trimAndCap(input.userId, 64);
   const message = trimAndCap(input.message, 500);
   const timestamp = trimAndCap(input.timestamp, 64);
   const isBroadcaster = input.isBroadcaster === true;
   const isMod = input.isMod === true;
   const isVip = input.isVip === true;
   const isSubscriber = input.isSubscriber === true;
   return {
-    id: trimAndCap(input.id, 80) || buildFallbackMessageId({ username, userId, message, timestamp, isBroadcaster, isMod, isVip, isSubscriber }),
+    id: suppliedId || buildFallbackMessageId(),
     username,
     userId,
     avatarUrl: normalizeAvatarUrl(input.avatarUrl),
     isBroadcaster,
     isMod,
     isVip,
     isSubscriber,
     message,
     timestamp,
   };
@@ -98,55 +99,22 @@ function normalizeAvatarUrl(value: unknown): string {
   const candidate = trimAndCap(value, 2048);
   if (!candidate) return CHAT_OVERLAY_AVATAR_FALLBACK;
   try {
     const url = new URL(candidate);
     return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'data:' ? url.toString() : CHAT_OVERLAY_AVATAR_FALLBACK;
   } catch {
     return CHAT_OVERLAY_AVATAR_FALLBACK;
   }
 }
 
-function buildFallbackMessageId(parts: {
-  username: string;
-  userId: string;
-  message: string;
-  timestamp: string;
-  isBroadcaster: boolean;
-  isMod: boolean;
-  isVip: boolean;
-  isSubscriber: boolean;
-}): string {
-  const seedParts = [
-    parts.userId,
-    parts.username,
-    parts.message,
-    parts.timestamp,
-    parts.isBroadcaster ? 'b' : '',
-    parts.isMod ? 'm' : '',
-    parts.isVip ? 'v' : '',
-    parts.isSubscriber ? 's' : '',
-  ].filter(Boolean);
-
-  if (seedParts.length === 0) {
-    return `chat-${crypto.randomUUID()}`;
-  }
-
-  return `chat-${stableHash(seedParts.join('|'))}`;
-}
-
-function stableHash(value: string): string {
-  let hash = 0xcbf29ce484222325n;
-  for (const char of value) {
-    hash ^= BigInt(char.codePointAt(0) ?? 0);
-    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
-  }
-  return hash.toString(16).padStart(16, '0');
+function buildFallbackMessageId(): string {
+  return `chat-${crypto.randomUUID()}`;
 }
 
 export function isChatOverlayTheme(value: string): value is ChatOverlayTheme {
   return ['light', 'dark', 'transparent'].includes(value);
 }
 
 export function isChatOverlayDisplayMode(value: string): value is ChatOverlayDisplayMode {
   return ['stacked', 'latest'].includes(value);
 }
 
