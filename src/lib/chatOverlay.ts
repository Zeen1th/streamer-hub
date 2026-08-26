import type { ChatMessage, ChatOverlayAnimation, ChatOverlayDisplayMode, ChatOverlayMessageStyle, ChatOverlaySettings, ChatOverlayTheme } from '../rpc/contracts';

export const CHAT_OVERLAY_LIMITS = {
  maxMessages: { min: 1, max: 12 },
  durationSeconds: { min: 5, max: 120 },
  fontSize: { min: 12, max: 32 },
  avatarSize: { min: 16, max: 64 },
  spacing: { min: 0, max: 24 },
} as const;

export const CHAT_OVERLAY_AVATAR_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="32" fill="%23334155"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%23cbd5e1"/%3E%3Cpath d="M14 54c2.8-10 10.3-16 18-16s15.2 6 18 16" fill="%23cbd5e1"/%3E%3C/svg%3E';

export const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = {
  enabled: false,
  maxMessages: 8,
  durationSeconds: 20,
  displayMode: 'stacked',
  fontSize: 24,
  avatarSize: 32,
  spacing: 12,
  showUsernames: true,
  showAvatars: true,
  theme: 'dark',
  messageStyle: 'rounded',
  animation: 'slide',
};

export interface NormalizedChatOverlayMessage {
  id: string;
  username: string;
  userId: string;
  avatarUrl: string;
  isBroadcaster: boolean;
  isMod: boolean;
  isVip: boolean;
  isSubscriber: boolean;
  message: string;
  timestamp: string;
}

export function normalizeChatOverlaySettings(value: Partial<ChatOverlaySettings> | null | undefined): ChatOverlaySettings {
  const input = value ?? {};
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_CHAT_OVERLAY_SETTINGS.enabled,
    maxMessages: clampNumber(input.maxMessages, CHAT_OVERLAY_LIMITS.maxMessages.min, CHAT_OVERLAY_LIMITS.maxMessages.max, DEFAULT_CHAT_OVERLAY_SETTINGS.maxMessages),
    durationSeconds: clampNumber(input.durationSeconds, CHAT_OVERLAY_LIMITS.durationSeconds.min, CHAT_OVERLAY_LIMITS.durationSeconds.max, DEFAULT_CHAT_OVERLAY_SETTINGS.durationSeconds),
    displayMode: oneOf(input.displayMode, ['stacked', 'latest'], DEFAULT_CHAT_OVERLAY_SETTINGS.displayMode),
    fontSize: clampNumber(input.fontSize, CHAT_OVERLAY_LIMITS.fontSize.min, CHAT_OVERLAY_LIMITS.fontSize.max, DEFAULT_CHAT_OVERLAY_SETTINGS.fontSize),
    avatarSize: clampNumber(input.avatarSize, CHAT_OVERLAY_LIMITS.avatarSize.min, CHAT_OVERLAY_LIMITS.avatarSize.max, DEFAULT_CHAT_OVERLAY_SETTINGS.avatarSize),
    spacing: clampNumber(input.spacing, CHAT_OVERLAY_LIMITS.spacing.min, CHAT_OVERLAY_LIMITS.spacing.max, DEFAULT_CHAT_OVERLAY_SETTINGS.spacing),
    showUsernames: typeof input.showUsernames === 'boolean' ? input.showUsernames : DEFAULT_CHAT_OVERLAY_SETTINGS.showUsernames,
    showAvatars: typeof input.showAvatars === 'boolean' ? input.showAvatars : DEFAULT_CHAT_OVERLAY_SETTINGS.showAvatars,
    theme: oneOf(input.theme, ['light', 'dark', 'transparent'], DEFAULT_CHAT_OVERLAY_SETTINGS.theme),
    messageStyle: oneOf(input.messageStyle, ['rounded', 'square'], DEFAULT_CHAT_OVERLAY_SETTINGS.messageStyle),
    animation: oneOf(input.animation, ['slide', 'fade', 'off'], DEFAULT_CHAT_OVERLAY_SETTINGS.animation),
  };
}

export function normalizeChatOverlayMessage(value: Partial<ChatMessage> | null | undefined): NormalizedChatOverlayMessage {
  const input = value ?? {};
  const suppliedId = typeof input.id === 'string' && input.id.trim().length > 0 ? input.id : '';
  const username = trimAndCap(input.username, 32) || 'viewer';
  const userId = trimAndCap(input.userId, 64);
  const message = trimAndCap(input.message, 500);
  const timestamp = trimAndCap(input.timestamp, 64);
  const isBroadcaster = input.isBroadcaster === true;
  const isMod = input.isMod === true;
  const isVip = input.isVip === true;
  const isSubscriber = input.isSubscriber === true;
  return {
    id: suppliedId || buildFallbackMessageId(),
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
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function trimAndCap(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeAvatarUrl(value: unknown): string {
  const candidate = trimAndCap(value, 2048);
  if (!candidate) return CHAT_OVERLAY_AVATAR_FALLBACK;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'data:' ? url.toString() : CHAT_OVERLAY_AVATAR_FALLBACK;
  } catch {
    return CHAT_OVERLAY_AVATAR_FALLBACK;
  }
}

function buildFallbackMessageId(): string {
  return `chat-${crypto.randomUUID()}`;
}

export function isChatOverlayTheme(value: string): value is ChatOverlayTheme {
  return ['light', 'dark', 'transparent'].includes(value);
}

export function isChatOverlayDisplayMode(value: string): value is ChatOverlayDisplayMode {
  return ['stacked', 'latest'].includes(value);
}

export function isChatOverlayMessageStyle(value: string): value is ChatOverlayMessageStyle {
  return ['rounded', 'square'].includes(value);
}

export function isChatOverlayAnimation(value: string): value is ChatOverlayAnimation {
  return ['slide', 'fade', 'off'].includes(value);
}
