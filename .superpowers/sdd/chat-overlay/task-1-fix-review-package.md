# Fix review package
Base: e11d3ff956e443fdcf61e9c0afdd9d416b15361e
Head: 44db36002f91d8cb11e5493235fc66e66fa4226e

## Stat
 src/lib/chatOverlay.test.mjs | 24 +++++++++++++++++
 src/lib/chatOverlay.ts       | 63 +++++++++++++++++++++++++++++++++++++-------
 2 files changed, 78 insertions(+), 9 deletions(-)

## Diff
diff --git a/src/lib/chatOverlay.test.mjs b/src/lib/chatOverlay.test.mjs
index fe59811..f43cfab 100644
--- a/src/lib/chatOverlay.test.mjs
+++ b/src/lib/chatOverlay.test.mjs
@@ -101,10 +101,34 @@ test('normalizes chat messages and uses a neutral avatar fallback', () => {
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
+test('does not reuse fallback ids for distinct missing-id messages', () => {
+  const first = normalizeChatOverlayMessage({
+    username: 'viewer',
+    userId: '100',
+    message: 'hello world',
+    timestamp: '2026-08-26T00:00:00.000Z',
+  });
+
+  const second = normalizeChatOverlayMessage({
+    username: 'viewer',
+    userId: '100',
+    message: 'hello again',
+    timestamp: '2026-08-26T00:00:01.000Z',
+  });
+
+  assert.notEqual(first.id, second.id);
+  assert.equal(first.id, normalizeChatOverlayMessage({
+    username: 'viewer',
+    userId: '100',
+    message: 'hello world',
+    timestamp: '2026-08-26T00:00:00.000Z',
+  }).id);
+});
+
diff --git a/src/lib/chatOverlay.ts b/src/lib/chatOverlay.ts
index c009a79..e98fa14 100644
--- a/src/lib/chatOverlay.ts
+++ b/src/lib/chatOverlay.ts
@@ -51,31 +51,39 @@ export function normalizeChatOverlaySettings(value: Partial<ChatOverlaySettings>
     showUsernames: typeof input.showUsernames === 'boolean' ? input.showUsernames : DEFAULT_CHAT_OVERLAY_SETTINGS.showUsernames,
     showAvatars: typeof input.showAvatars === 'boolean' ? input.showAvatars : DEFAULT_CHAT_OVERLAY_SETTINGS.showAvatars,
     theme: oneOf(input.theme, ['light', 'dark', 'transparent'], DEFAULT_CHAT_OVERLAY_SETTINGS.theme),
     messageStyle: oneOf(input.messageStyle, ['rounded', 'square'], DEFAULT_CHAT_OVERLAY_SETTINGS.messageStyle),
     animation: oneOf(input.animation, ['slide', 'fade', 'off'], DEFAULT_CHAT_OVERLAY_SETTINGS.animation),
   };
 }
 
 export function normalizeChatOverlayMessage(value: Partial<ChatMessage> | null | undefined): NormalizedChatOverlayMessage {
   const input = value ?? {};
+  const username = trimAndCap(input.username, 32) || 'viewer';
+  const userId = trimAndCap(input.userId, 64);
+  const message = trimAndCap(input.message, 500);
+  const timestamp = trimAndCap(input.timestamp, 64);
+  const isBroadcaster = input.isBroadcaster === true;
+  const isMod = input.isMod === true;
+  const isVip = input.isVip === true;
+  const isSubscriber = input.isSubscriber === true;
   return {
-    id: trimAndCap(input.id, 80) || 'chat-message',
-    username: trimAndCap(input.username, 32) || 'viewer',
-    userId: trimAndCap(input.userId, 64),
+    id: trimAndCap(input.id, 80) || buildFallbackMessageId({ username, userId, message, timestamp, isBroadcaster, isMod, isVip, isSubscriber }),
+    username,
+    userId,
     avatarUrl: normalizeAvatarUrl(input.avatarUrl),
-    isBroadcaster: input.isBroadcaster === true,
-    isMod: input.isMod === true,
-    isVip: input.isVip === true,
-    isSubscriber: input.isSubscriber === true,
-    message: trimAndCap(input.message, 500),
-    timestamp: trimAndCap(input.timestamp, 64),
+    isBroadcaster,
+    isMod,
+    isVip,
+    isSubscriber,
+    message,
+    timestamp,
   };
 }
 
 function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
   if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
   return Math.min(max, Math.max(min, Math.trunc(value)));
 }
 
 function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
   return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
@@ -90,20 +98,57 @@ function normalizeAvatarUrl(value: unknown): string {
   const candidate = trimAndCap(value, 2048);
   if (!candidate) return CHAT_OVERLAY_AVATAR_FALLBACK;
   try {
     const url = new URL(candidate);
     return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'data:' ? url.toString() : CHAT_OVERLAY_AVATAR_FALLBACK;
   } catch {
     return CHAT_OVERLAY_AVATAR_FALLBACK;
   }
 }
 
+function buildFallbackMessageId(parts: {
+  username: string;
+  userId: string;
+  message: string;
+  timestamp: string;
+  isBroadcaster: boolean;
+  isMod: boolean;
+  isVip: boolean;
+  isSubscriber: boolean;
+}): string {
+  const seedParts = [
+    parts.userId,
+    parts.username,
+    parts.message,
+    parts.timestamp,
+    parts.isBroadcaster ? 'b' : '',
+    parts.isMod ? 'm' : '',
+    parts.isVip ? 'v' : '',
+    parts.isSubscriber ? 's' : '',
+  ].filter(Boolean);
+
+  if (seedParts.length === 0) {
+    return `chat-${crypto.randomUUID()}`;
+  }
+
+  return `chat-${stableHash(seedParts.join('|'))}`;
+}
+
+function stableHash(value: string): string {
+  let hash = 0xcbf29ce484222325n;
+  for (const char of value) {
+    hash ^= BigInt(char.codePointAt(0) ?? 0);
+    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
+  }
+  return hash.toString(16).padStart(16, '0');
+}
+
 export function isChatOverlayTheme(value: string): value is ChatOverlayTheme {
   return ['light', 'dark', 'transparent'].includes(value);
 }
 
 export function isChatOverlayDisplayMode(value: string): value is ChatOverlayDisplayMode {
   return ['stacked', 'latest'].includes(value);
 }
 
 export function isChatOverlayMessageStyle(value: string): value is ChatOverlayMessageStyle {
   return ['rounded', 'square'].includes(value);
