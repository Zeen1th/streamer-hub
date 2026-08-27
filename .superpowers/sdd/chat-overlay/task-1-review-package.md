# Review package
Base: fb7e43664ef8cb15d19cb72709f7395d8707251d
Head: e11d3ff956e443fdcf61e9c0afdd9d416b15361e

## Commits
e11d3ff Add chat overlay contracts and settings.

## Stat
 core/Rpc/Contracts.cs         |  18 +++++++
 core/Storage/SettingsStore.cs |  60 ++++++++++++++++++++--
 src/lib/chatOverlay.test.mjs  | 110 ++++++++++++++++++++++++++++++++++++++++
 src/lib/chatOverlay.ts        | 114 ++++++++++++++++++++++++++++++++++++++++++
 src/rpc/contracts.ts          |  22 ++++++++
 5 files changed, 321 insertions(+), 3 deletions(-)

## Diff
diff --git a/core/Rpc/Contracts.cs b/core/Rpc/Contracts.cs
index d35d931..103113a 100644
--- a/core/Rpc/Contracts.cs
+++ b/core/Rpc/Contracts.cs
@@ -80,24 +80,42 @@ public sealed record AutoReplySettings
     public int GlobalAiCooldownSeconds { get; init; }
     public int GlobalAiUserCooldownSeconds { get; init; } = 60;
 }
 
 public sealed record OpenRouterSettingsState
 {
     public bool Configured { get; init; }
     public bool GroqConfigured { get; init; }
 }
 
+public sealed record ChatOverlaySettings
+{
+    public bool Enabled { get; init; }
+    public int MaxMessages { get; init; } = 8;
+    public int DurationSeconds { get; init; } = 20;
+    public string DisplayMode { get; init; } = "stacked";
+    public int FontSize { get; init; } = 24;
+    public int AvatarSize { get; init; } = 32;
+    public int Spacing { get; init; } = 12;
+    public bool ShowUsernames { get; init; } = true;
+    public bool ShowAvatars { get; init; } = true;
+    public string Theme { get; init; } = "dark";
+    public string MessageStyle { get; init; } = "rounded";
+    public string Animation { get; init; } = "slide";
+}
+
 public sealed record ChatMessage
 {
     public string Id { get; init; } = string.Empty;
     public string Username { get; init; } = string.Empty;
+    public string? UserId { get; init; }
+    public string? AvatarUrl { get; init; }
     public bool IsBroadcaster { get; init; }
     public bool IsMod { get; init; }
     public bool IsVip { get; init; }
     public bool IsSubscriber { get; init; }
     public string Message { get; init; } = string.Empty;
     public string Timestamp { get; init; } = string.Empty;
 }
 
 public sealed record ConnectionStatus
 {
diff --git a/core/Storage/SettingsStore.cs b/core/Storage/SettingsStore.cs
index dafd4fa..ac7b353 100644
--- a/core/Storage/SettingsStore.cs
+++ b/core/Storage/SettingsStore.cs
@@ -13,20 +13,21 @@ public sealed record WindowSettings
 }
 
 public sealed class SettingsStore : IDisposable
 {
     private sealed record SettingsDocument
     {
         public List<Counter> Counters { get; init; } = new();
         public List<AutoReply> AutoReplies { get; init; } = new();
         public AutoReplySettings AutoReplySettings { get; init; } = new();
         public TwitchSettings Twitch { get; init; } = new();
+        public ChatOverlaySettings ChatOverlay { get; init; } = new();
         public WindowSettings Window { get; init; } = new();
         public string Language { get; init; } = string.Empty;
         public bool BotAccountEnabled { get; init; }
         public bool StartupEnabled { get; init; } = true;
         public bool? CloseToTray { get; init; }
     }
 
     private readonly string _filePath;
     private readonly object _lock = new();
     private readonly System.Threading.Timer _debounce;
@@ -58,20 +59,31 @@ public sealed class SettingsStore : IDisposable
     {
         lock (_lock) _document = _document with { AutoReplySettings = settings };
         ScheduleSave();
     }
 
     public TwitchSettings Twitch
     {
         get { lock (_lock) return _document.Twitch; }
     }
 
+    public ChatOverlaySettings ChatOverlay
+    {
+        get { lock (_lock) return _document.ChatOverlay; }
+    }
+
+    public void SetChatOverlay(ChatOverlaySettings settings)
+    {
+        lock (_lock) _document = _document with { ChatOverlay = NormalizeChatOverlay(settings) };
+        ScheduleSave();
+    }
+
     public WindowSettings Window
     {
         get { lock (_lock) return _document.Window; }
     }
 
     public string Language
     {
         get { lock (_lock) return _document.Language; }
     }
 
@@ -105,21 +117,21 @@ public sealed class SettingsStore : IDisposable
     public void SetBotAccountEnabled(bool enabled)
     {
         lock (_lock) _document = _document with { BotAccountEnabled = enabled };
         ScheduleSave();
     }
 
     public void SetLanguage(string language)
     {
         lock (_lock)
         {
-            _document = _document with { Language = language == "ar" ? "ar" : "en" };
+            _document = _document with { Language = NormalizeLanguage(language) };
         }
         ScheduleSave();
     }
 
     public void SetCount(string counterId, int count)
     {
         lock (_lock)
         {
             var counters = _document.Counters
                 .Select(c => c.Id == counterId ? c with { Count = Math.Max(0, count) } : c)
@@ -194,21 +206,21 @@ public sealed class SettingsStore : IDisposable
     private SettingsDocument Load()
     {
         try
         {
             if (!File.Exists(_filePath)) return new SettingsDocument();
             var json = File.ReadAllText(_filePath);
             using var doc = JsonDocument.Parse(json);
             var root = doc.RootElement;
             if (root.TryGetProperty("counters", out _))
             {
-                return JsonSerializer.Deserialize<SettingsDocument>(json, Json.Options) ?? new SettingsDocument();
+                return NormalizeSettingsDocument(JsonSerializer.Deserialize<SettingsDocument>(json, Json.Options));
             }
             if (root.TryGetProperty("death", out var death) ||
                 (root.TryGetProperty("count", out _) && root.TryGetProperty("config", out _)))
             {
                 var legacyJson = death.ValueKind == JsonValueKind.Object ? death.GetRawText() : json;
                 var legacy = JsonSerializer.Deserialize<LegacyDeathState>(legacyJson, Json.Options);
                 var commandName = legacy?.Config?.CommandName;
                 if (string.IsNullOrWhiteSpace(commandName)) commandName = "deaths";
                 var permission = legacy?.Config?.Permission;
                 if (string.IsNullOrWhiteSpace(permission)) permission = "everyone";
@@ -219,30 +231,72 @@ public sealed class SettingsStore : IDisposable
                     Name = "Deaths",
                     Count = legacy?.Count ?? 0,
                     Commands = new CounterConfig
                     {
                         Increase = new CounterCommandConfig { CommandName = commandName, Permission = permission, CooldownSeconds = cooldown },
                         Decrease = new CounterCommandConfig { CommandName = $"{commandName}down", Permission = permission, CooldownSeconds = cooldown },
                         Reset = new CounterCommandConfig { CommandName = $"{commandName}reset", Permission = permission, CooldownSeconds = 0 },
                     },
                     Obs = legacy?.Obs ?? new ObsOutputConfig { Enabled = false },
                 };
-                return new SettingsDocument { Counters = new List<Counter> { counter } };
+                return NormalizeSettingsDocument(new SettingsDocument { Counters = new List<Counter> { counter } });
             }
             return new SettingsDocument();
         }
         catch
         {
             return new SettingsDocument();
         }
     }
 
+    private static SettingsDocument NormalizeSettingsDocument(SettingsDocument? document)
+    {
+        var value = document ?? new SettingsDocument();
+        return value with
+        {
+            ChatOverlay = NormalizeChatOverlay(value.ChatOverlay),
+            Language = NormalizeLanguage(value.Language),
+        };
+    }
+
+    private static ChatOverlaySettings NormalizeChatOverlay(ChatOverlaySettings? settings)
+    {
+        return new ChatOverlaySettings
+        {
+            Enabled = settings?.Enabled ?? false,
+            MaxMessages = Clamp(settings?.MaxMessages ?? 8, 1, 12),
+            DurationSeconds = Clamp(settings?.DurationSeconds ?? 20, 5, 120),
+            DisplayMode = NormalizeChoice(settings?.DisplayMode, "stacked", "stacked", "latest"),
+            FontSize = Clamp(settings?.FontSize ?? 24, 12, 32),
+            AvatarSize = Clamp(settings?.AvatarSize ?? 32, 16, 64),
+            Spacing = Clamp(settings?.Spacing ?? 12, 0, 24),
+            ShowUsernames = settings?.ShowUsernames ?? true,
+            ShowAvatars = settings?.ShowAvatars ?? true,
+            Theme = NormalizeChoice(settings?.Theme, "dark", "light", "dark", "transparent"),
+            MessageStyle = NormalizeChoice(settings?.MessageStyle, "rounded", "rounded", "square"),
+            Animation = NormalizeChoice(settings?.Animation, "slide", "slide", "fade", "off"),
+        };
+    }
+
+    private static int Clamp(int value, int min, int max) => Math.Clamp(value, min, max);
+
+    private static string NormalizeChoice(string? value, string fallback, params string[] allowed)
+    {
+        if (string.IsNullOrWhiteSpace(value)) return fallback;
+        var trimmed = value.Trim();
+        return allowed.Contains(trimmed, StringComparer.OrdinalIgnoreCase)
+            ? allowed.First(candidate => string.Equals(candidate, trimmed, StringComparison.OrdinalIgnoreCase))
+            : fallback;
+    }
+
+    private static string NormalizeLanguage(string? language) => string.Equals(language, "ar", StringComparison.OrdinalIgnoreCase) ? "ar" : "en";
+
     private sealed record LegacyDeathState
     {
         public int Count { get; init; }
         public LegacyConfig? Config { get; init; }
         public ObsOutputConfig? Obs { get; init; }
     }
 
     private sealed record LegacyConfig
     {
         public string CommandName { get; init; } = "deaths";
diff --git a/src/lib/chatOverlay.test.mjs b/src/lib/chatOverlay.test.mjs
new file mode 100644
index 0000000..fe59811
--- /dev/null
+++ b/src/lib/chatOverlay.test.mjs
@@ -0,0 +1,110 @@
+import assert from 'node:assert/strict';
+import test from 'node:test';
+import {
+  CHAT_OVERLAY_AVATAR_FALLBACK,
+  DEFAULT_CHAT_OVERLAY_SETTINGS,
+  normalizeChatOverlayMessage,
+  normalizeChatOverlaySettings,
+} from './chatOverlay.ts';
+
+test('exposes stable default chat overlay settings', () => {
+  assert.deepEqual(DEFAULT_CHAT_OVERLAY_SETTINGS, {
+    enabled: false,
+    maxMessages: 8,
+    durationSeconds: 20,
+    displayMode: 'stacked',
+    fontSize: 24,
+    avatarSize: 32,
+    spacing: 12,
+    showUsernames: true,
+    showAvatars: true,
+    theme: 'dark',
+    messageStyle: 'rounded',
+    animation: 'slide',
+  });
+});
+
+test('clamps and sanitizes overlay settings', () => {
+  assert.deepEqual(
+    normalizeChatOverlaySettings({
+      enabled: true,
+      maxMessages: 99,
+      durationSeconds: 0,
+      displayMode: 'latest',
+      fontSize: 9,
+      avatarSize: 200,
+      spacing: -5,
+      showUsernames: false,
+      showAvatars: false,
+      theme: 'transparent',
+      messageStyle: 'square',
+      animation: 'off',
+    }),
+    {
+      enabled: true,
+      maxMessages: 12,
+      durationSeconds: 5,
+      displayMode: 'latest',
+      fontSize: 12,
+      avatarSize: 64,
+      spacing: 0,
+      showUsernames: false,
+      showAvatars: false,
+      theme: 'transparent',
+      messageStyle: 'square',
+      animation: 'off',
+    },
+  );
+});
+
+test('falls back to defaults for invalid overlay settings', () => {
+  assert.deepEqual(
+    normalizeChatOverlaySettings({
+      enabled: 'yes',
+      maxMessages: Number.NaN,
+      durationSeconds: null,
+      displayMode: 'carousel',
+      fontSize: '24px',
+      avatarSize: undefined,
+      spacing: Infinity,
+      showUsernames: 'true',
+      showAvatars: 1,
+      theme: 'neon',
+      messageStyle: 'pill',
+      animation: 'zoom',
+    }),
+    DEFAULT_CHAT_OVERLAY_SETTINGS,
+  );
+});
+
+test('normalizes chat messages and uses a neutral avatar fallback', () => {
+  const username = ' viewer '.repeat(10);
+  const message = ' hello world '.repeat(80);
+
+  assert.deepEqual(
+    normalizeChatOverlayMessage({
+      id: '  msg-1  ',
+      username,
+      message,
+      timestamp: ' 2026-08-26T00:00:00.000Z ',
+      userId: ' 12345 ',
+      avatarUrl: 'javascript:alert(1)',
+      isBroadcaster: true,
+      isMod: false,
+      isVip: false,
+      isSubscriber: true,
+    }),
+    {
+      id: 'msg-1',
+      username: username.trim().slice(0, 32),
+      message: message.trim().slice(0, 500),
+      timestamp: '2026-08-26T00:00:00.000Z',
+      userId: '12345',
+      avatarUrl: CHAT_OVERLAY_AVATAR_FALLBACK,
+      isBroadcaster: true,
+      isMod: false,
+      isVip: false,
+      isSubscriber: true,
+    },
+  );
+});
diff --git a/src/lib/chatOverlay.ts b/src/lib/chatOverlay.ts
new file mode 100644
index 0000000..c009a79
--- /dev/null
+++ b/src/lib/chatOverlay.ts
@@ -0,0 +1,114 @@
+import type { ChatMessage, ChatOverlayAnimation, ChatOverlayDisplayMode, ChatOverlayMessageStyle, ChatOverlaySettings, ChatOverlayTheme } from '../rpc/contracts';
+
+export const CHAT_OVERLAY_LIMITS = {
+  maxMessages: { min: 1, max: 12 },
+  durationSeconds: { min: 5, max: 120 },
+  fontSize: { min: 12, max: 32 },
+  avatarSize: { min: 16, max: 64 },
+  spacing: { min: 0, max: 24 },
+} as const;
+
+export const CHAT_OVERLAY_AVATAR_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="32" fill="%23334155"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%23cbd5e1"/%3E%3Cpath d="M14 54c2.8-10 10.3-16 18-16s15.2 6 18 16" fill="%23cbd5e1"/%3E%3C/svg%3E';
+
+export const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = {
+  enabled: false,
+  maxMessages: 8,
+  durationSeconds: 20,
+  displayMode: 'stacked',
+  fontSize: 24,
+  avatarSize: 32,
+  spacing: 12,
+  showUsernames: true,
+  showAvatars: true,
+  theme: 'dark',
+  messageStyle: 'rounded',
+  animation: 'slide',
+};
+
+export interface NormalizedChatOverlayMessage {
+  id: string;
+  username: string;
+  userId: string;
+  avatarUrl: string;
+  isBroadcaster: boolean;
+  isMod: boolean;
+  isVip: boolean;
+  isSubscriber: boolean;
+  message: string;
+  timestamp: string;
+}
+
+export function normalizeChatOverlaySettings(value: Partial<ChatOverlaySettings> | null | undefined): ChatOverlaySettings {
+  const input = value ?? {};
+  return {
+    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_CHAT_OVERLAY_SETTINGS.enabled,
+    maxMessages: clampNumber(input.maxMessages, CHAT_OVERLAY_LIMITS.maxMessages.min, CHAT_OVERLAY_LIMITS.maxMessages.max, DEFAULT_CHAT_OVERLAY_SETTINGS.maxMessages),
+    durationSeconds: clampNumber(input.durationSeconds, CHAT_OVERLAY_LIMITS.durationSeconds.min, CHAT_OVERLAY_LIMITS.durationSeconds.max, DEFAULT_CHAT_OVERLAY_SETTINGS.durationSeconds),
+    displayMode: oneOf(input.displayMode, ['stacked', 'latest'], DEFAULT_CHAT_OVERLAY_SETTINGS.displayMode),
+    fontSize: clampNumber(input.fontSize, CHAT_OVERLAY_LIMITS.fontSize.min, CHAT_OVERLAY_LIMITS.fontSize.max, DEFAULT_CHAT_OVERLAY_SETTINGS.fontSize),
+    avatarSize: clampNumber(input.avatarSize, CHAT_OVERLAY_LIMITS.avatarSize.min, CHAT_OVERLAY_LIMITS.avatarSize.max, DEFAULT_CHAT_OVERLAY_SETTINGS.avatarSize),
+    spacing: clampNumber(input.spacing, CHAT_OVERLAY_LIMITS.spacing.min, CHAT_OVERLAY_LIMITS.spacing.max, DEFAULT_CHAT_OVERLAY_SETTINGS.spacing),
+    showUsernames: typeof input.showUsernames === 'boolean' ? input.showUsernames : DEFAULT_CHAT_OVERLAY_SETTINGS.showUsernames,
+    showAvatars: typeof input.showAvatars === 'boolean' ? input.showAvatars : DEFAULT_CHAT_OVERLAY_SETTINGS.showAvatars,
+    theme: oneOf(input.theme, ['light', 'dark', 'transparent'], DEFAULT_CHAT_OVERLAY_SETTINGS.theme),
+    messageStyle: oneOf(input.messageStyle, ['rounded', 'square'], DEFAULT_CHAT_OVERLAY_SETTINGS.messageStyle),
+    animation: oneOf(input.animation, ['slide', 'fade', 'off'], DEFAULT_CHAT_OVERLAY_SETTINGS.animation),
+  };
+}
+
+export function normalizeChatOverlayMessage(value: Partial<ChatMessage> | null | undefined): NormalizedChatOverlayMessage {
+  const input = value ?? {};
+  return {
+    id: trimAndCap(input.id, 80) || 'chat-message',
+    username: trimAndCap(input.username, 32) || 'viewer',
+    userId: trimAndCap(input.userId, 64),
+    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
+    isBroadcaster: input.isBroadcaster === true,
+    isMod: input.isMod === true,
+    isVip: input.isVip === true,
+    isSubscriber: input.isSubscriber === true,
+    message: trimAndCap(input.message, 500),
+    timestamp: trimAndCap(input.timestamp, 64),
+  };
+}
+
+function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
+  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
+  return Math.min(max, Math.max(min, Math.trunc(value)));
+}
+
+function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
+  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
+}
+
+function trimAndCap(value: unknown, maxLength: number): string {
+  if (typeof value !== 'string') return '';
+  return value.trim().slice(0, maxLength);
+}
+
+function normalizeAvatarUrl(value: unknown): string {
+  const candidate = trimAndCap(value, 2048);
+  if (!candidate) return CHAT_OVERLAY_AVATAR_FALLBACK;
+  try {
+    const url = new URL(candidate);
+    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'data:' ? url.toString() : CHAT_OVERLAY_AVATAR_FALLBACK;
+  } catch {
+    return CHAT_OVERLAY_AVATAR_FALLBACK;
+  }
+}
+
+export function isChatOverlayTheme(value: string): value is ChatOverlayTheme {
+  return ['light', 'dark', 'transparent'].includes(value);
+}
+
+export function isChatOverlayDisplayMode(value: string): value is ChatOverlayDisplayMode {
+  return ['stacked', 'latest'].includes(value);
+}
+
+export function isChatOverlayMessageStyle(value: string): value is ChatOverlayMessageStyle {
+  return ['rounded', 'square'].includes(value);
+}
+
+export function isChatOverlayAnimation(value: string): value is ChatOverlayAnimation {
+  return ['slide', 'fade', 'off'].includes(value);
+}
diff --git a/src/rpc/contracts.ts b/src/rpc/contracts.ts
index 08dc9f2..a1264b9 100644
--- a/src/rpc/contracts.ts
+++ b/src/rpc/contracts.ts
@@ -83,32 +83,54 @@ export interface TitleCounter {
 export interface AutoReplySettings {
   globalAiCooldownSeconds: number;
   globalAiUserCooldownSeconds: number;
 }
 
 export interface OpenRouterSettingsState {
   configured: boolean;
   groqConfigured: boolean;
 }
 
+export type ChatOverlayDisplayMode = 'stacked' | 'latest';
+export type ChatOverlayTheme = 'light' | 'dark' | 'transparent';
+export type ChatOverlayMessageStyle = 'rounded' | 'square';
+export type ChatOverlayAnimation = 'slide' | 'fade' | 'off';
+
+export interface ChatOverlaySettings {
+  enabled: boolean;
+  maxMessages: number;
+  durationSeconds: number;
+  displayMode: ChatOverlayDisplayMode;
+  fontSize: number;
+  avatarSize: number;
+  spacing: number;
+  showUsernames: boolean;
+  showAvatars: boolean;
+  theme: ChatOverlayTheme;
+  messageStyle: ChatOverlayMessageStyle;
+  animation: ChatOverlayAnimation;
+}
+
 export interface UpdateState {
   currentVersion: string;
   latestVersion: string;
   updateAvailable: boolean;
   releaseUrl: string;
   downloadUrl?: string;
   releaseNotes?: string;
 }
 
 export interface ChatMessage {
   id: string;
   username: string;
+  userId?: string;
+  avatarUrl?: string;
   isBroadcaster: boolean;
   isMod: boolean;
   isVip: boolean;
   isSubscriber: boolean;
   message: string;
   timestamp: string;
 }
 
 export interface ConnectionStatus {
   coreConnected: boolean;
