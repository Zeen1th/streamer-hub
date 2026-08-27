import type {
  ChatMessage,
  ChatOverlayAlignment,
  ChatOverlayFontChoice,
  ChatOverlayFontFamily,
  ChatOverlaySettings,
  ChatOverlayTheme,
  EmoteRange,
} from '../rpc/contracts';
import { CHAT_OVERLAY_CANVAS } from '../rpc/contracts.ts';
import { presetTokensForLegacyTheme } from './chatOverlayPresets.ts';

export const CHAT_OVERLAY_LIMITS = {
  block: {
    width: { min: 160, max: CHAT_OVERLAY_CANVAS.width },
    height: { min: 80, max: CHAT_OVERLAY_CANVAS.height },
  },
  maxMessages: { min: 1, max: 40 },
  durationSeconds: { min: 3, max: 600 },
  gap: { min: 0, max: 64 },
  sizeScale: { min: 50, max: 300 },
  fontSize: { min: 8, max: 96 },
  usernameSize: { min: 8, max: 96 },
  fontWeight: { min: 100, max: 900 },
  lineHeight: { min: 0.8, max: 3 },
  letterSpacing: { min: -0.1, max: 0.5 },
  avatarSize: { min: 8, max: 160 },
  borderWidth: { min: 0, max: 16 },
  borderRadius: { min: 0, max: 64 },
  padding: { min: 0, max: 64 },
  blur: { min: 0, max: 40 },
  accentWidth: { min: 0, max: 24 },
  alpha: { min: 0, max: 100 },
  badgeSize: { min: 6, max: 40 },
  emoteScale: { min: 50, max: 400 },
  emoteOnlyScale: { min: 100, max: 500 },
  maxWidth: { min: 0, max: CHAT_OVERLAY_CANVAS.width },
  minLength: { min: 0, max: 200 },
  animationDurationMs: { min: 0, max: 2000 },
} as const;

export const CHAT_OVERLAY_AVATAR_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="32" fill="%23334155"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%23cbd5e1"/%3E%3Cpath d="M14 54c2.8-10 10.3-16 18-16s15.2 6 18 16" fill="%23cbd5e1"/%3E%3C/svg%3E';

export const CHAT_OVERLAY_DEFAULT_BOTS = [
  'nightbot',
  'streamelements',
  'streamlabs',
  'moobot',
  'fossabot',
];

const FONT_FAMILIES: readonly ChatOverlayFontFamily[] = ['barlow', 'cairo', 'cinzel', 'jetbrains-mono', 'system'];

/** Default block rect per anchor corner: 760x540, inset 48px from that corner. */
const BLOCK_INSET = 48;
const BLOCK_WIDTH = 760;
const BLOCK_HEIGHT = 540;

export function defaultBlockForAnchor(anchor: ChatOverlayAlignment) {
  const right = CHAT_OVERLAY_CANVAS.width - BLOCK_WIDTH - BLOCK_INSET;
  const bottom = CHAT_OVERLAY_CANVAS.height - BLOCK_HEIGHT - BLOCK_INSET;
  const x = anchor === 'bottom-right' || anchor === 'top-right' ? right : BLOCK_INSET;
  const y = anchor === 'bottom-left' || anchor === 'bottom-right' ? bottom : BLOCK_INSET;
  return { x, y, width: BLOCK_WIDTH, height: BLOCK_HEIGHT, anchor };
}

export function createDefaultChatOverlaySettings(): ChatOverlaySettings {
  const tokens = presetTokensForLegacyTheme('dark');
  return {
    version: 2,
    enabled: false,
    block: defaultBlockForAnchor('bottom-left'),
    flow: {
      maxMessages: 8,
      durationSeconds: 20,
      displayMode: 'stacked',
      direction: 'up',
      gap: 12,
      sizeScale: 100,
    },
    ...structuredCloneTokens(tokens),
    emotes: {
      twitch: true,
      bttv: true,
      ffz: true,
      sevenTv: true,
      sizeScale: 140,
      emoteOnlyScale: 200,
    },
    filters: {
      blockedUsernames: [],
      hideCommands: false,
      hideBots: true,
      botList: [...CHAT_OVERLAY_DEFAULT_BOTS],
      blockedWords: [],
      blockedWordAction: 'drop',
      minLength: 0,
    },
  };
}

export const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = createDefaultChatOverlaySettings();

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
  emotes: EmoteRange[];
  color: string;
}

/**
 * Total function: any input produces a valid settings object.
 * Detects legacy (v1, flat) payloads and migrates them.
 */
export function normalizeChatOverlaySettings(value: unknown): ChatOverlaySettings {
  if (!isRecord(value)) return createDefaultChatOverlaySettings();
  if (value.version === 2) return normalizeV2(value);
  if (value.version === undefined && looksLikeLegacy(value)) return migrateLegacy(value);
  // Unrecognised version: reset rather than throw.
  return createDefaultChatOverlaySettings();
}

function looksLikeLegacy(value: Record<string, unknown>): boolean {
  return 'theme' in value || 'fontSize' in value || 'alignment' in value || 'scale' in value;
}

function normalizeV2(input: Record<string, unknown>): ChatOverlaySettings {
  const d = createDefaultChatOverlaySettings();
  const block = isRecord(input.block) ? input.block : {};
  const flow = isRecord(input.flow) ? input.flow : {};
  const bubble = isRecord(input.bubble) ? input.bubble : {};
  const username = isRecord(input.username) ? input.username : {};
  const text = isRecord(input.text) ? input.text : {};
  const avatar = isRecord(input.avatar) ? input.avatar : {};
  const badges = isRecord(input.badges) ? input.badges : {};
  const emotes = isRecord(input.emotes) ? input.emotes : {};
  const filters = isRecord(input.filters) ? input.filters : {};
  const animation = isRecord(input.animation) ? input.animation : {};

  const bg = isRecord(bubble.background) ? bubble.background : {};
  const border = isRecord(bubble.border) ? bubble.border : {};
  const padding = isRecord(bubble.padding) ? bubble.padding : {};
  const accent = isRecord(bubble.accent) ? bubble.accent : {};

  const L = CHAT_OVERLAY_LIMITS;

  return {
    version: 2,
    enabled: bool(input.enabled, d.enabled),
    block: normalizeBlock(block, d.block),
    flow: {
      maxMessages: int(flow.maxMessages, L.maxMessages, d.flow.maxMessages),
      durationSeconds: normalizeDuration(flow.durationSeconds, d.flow.durationSeconds),
      displayMode: oneOf(flow.displayMode, ['stacked', 'latest'], d.flow.displayMode),
      direction: oneOf(flow.direction, ['up', 'down'], d.flow.direction),
      gap: int(flow.gap, L.gap, d.flow.gap),
      sizeScale: int(flow.sizeScale, L.sizeScale, d.flow.sizeScale),
    },
    bubble: {
      background: {
        color: color(bg.color, d.bubble.background.color),
        alpha: int(bg.alpha, L.alpha, d.bubble.background.alpha),
      },
      border: {
        width: int(border.width, L.borderWidth, d.bubble.border.width),
        color: color(border.color, d.bubble.border.color),
        radius: int(border.radius, L.borderRadius, d.bubble.border.radius),
      },
      padding: {
        x: int(padding.x, L.padding, d.bubble.padding.x),
        y: int(padding.y, L.padding, d.bubble.padding.y),
      },
      shadow: oneOf(bubble.shadow, ['off', 'soft', 'hard'], d.bubble.shadow),
      shadowColor: color(bubble.shadowColor, d.bubble.shadowColor),
      blur: int(bubble.blur, L.blur, d.bubble.blur),
      accent: {
        width: int(accent.width, L.accentWidth, d.bubble.accent.width),
        colorMode: oneOf(accent.colorMode, ['role', 'custom'], d.bubble.accent.colorMode),
        color: color(accent.color, d.bubble.accent.color),
      },
    },
    username: {
      show: bool(username.show, d.username.show),
      font: font(username.font, d.username.font),
      size: int(username.size, L.usernameSize, d.username.size),
      weight: int(username.weight, L.fontWeight, d.username.weight),
      letterSpacing: float(username.letterSpacing, L.letterSpacing, d.username.letterSpacing),
      colorMode: oneOf(username.colorMode, ['role', 'twitch', 'custom'], d.username.colorMode),
      color: color(username.color, d.username.color),
      transform: oneOf(username.transform, ['none', 'uppercase', 'lowercase'], d.username.transform),
      position: oneOf(username.position, ['above', 'inline'], d.username.position),
    },
    text: {
      font: font(text.font, d.text.font),
      size: int(text.size, L.fontSize, d.text.size),
      weight: int(text.weight, L.fontWeight, d.text.weight),
      color: color(text.color, d.text.color),
      lineHeight: float(text.lineHeight, L.lineHeight, d.text.lineHeight),
      letterSpacing: float(text.letterSpacing, L.letterSpacing, d.text.letterSpacing),
      shadow: bool(text.shadow, d.text.shadow),
      wrapMode: oneOf(text.wrapMode, ['normal', 'break-anywhere', 'clip'], d.text.wrapMode),
      maxWidth: int(text.maxWidth, L.maxWidth, d.text.maxWidth),
    },
    avatar: {
      show: bool(avatar.show, d.avatar.show),
      size: int(avatar.size, L.avatarSize, d.avatar.size),
      shape: oneOf(avatar.shape, ['circle', 'rounded', 'square', 'squircle'], d.avatar.shape),
      position: oneOf(avatar.position, ['left', 'right'], d.avatar.position),
      borderWidth: int(avatar.borderWidth, L.borderWidth, d.avatar.borderWidth),
      borderColorMode: oneOf(avatar.borderColorMode, ['role', 'custom'], d.avatar.borderColorMode),
      borderColor: color(avatar.borderColor, d.avatar.borderColor),
    },
    badges: {
      show: bool(badges.show, d.badges.show),
      style: oneOf(badges.style, ['text', 'icon'], d.badges.style),
      size: int(badges.size, L.badgeSize, d.badges.size),
    },
    emotes: {
      twitch: bool(emotes.twitch, d.emotes.twitch),
      bttv: bool(emotes.bttv, d.emotes.bttv),
      ffz: bool(emotes.ffz, d.emotes.ffz),
      sevenTv: bool(emotes.sevenTv, d.emotes.sevenTv),
      sizeScale: int(emotes.sizeScale, L.emoteScale, d.emotes.sizeScale),
      emoteOnlyScale: int(emotes.emoteOnlyScale, L.emoteOnlyScale, d.emotes.emoteOnlyScale),
    },
    filters: {
      blockedUsernames: stringList(filters.blockedUsernames, 200),
      hideCommands: bool(filters.hideCommands, d.filters.hideCommands),
      hideBots: bool(filters.hideBots, d.filters.hideBots),
      botList: Array.isArray(filters.botList) ? stringList(filters.botList, 200) : [...CHAT_OVERLAY_DEFAULT_BOTS],
      blockedWords: stringList(filters.blockedWords, 200),
      blockedWordAction: oneOf(filters.blockedWordAction, ['drop', 'mask'], d.filters.blockedWordAction),
      minLength: int(filters.minLength, L.minLength, d.filters.minLength),
    },
    animation: {
      kind: oneOf(animation.kind, ['slide', 'fade', 'pop', 'glow', 'flip', 'off'], d.animation.kind),
      durationMs: int(animation.durationMs, L.animationDurationMs, d.animation.durationMs),
    },
  };
}

/**
 * v1 -> v2. The legacy `theme` selects the preset that replaced it, then the
 * user's explicit v1 overrides are applied on top so nobody loses their setup.
 */
function migrateLegacy(input: Record<string, unknown>): ChatOverlaySettings {
  const d = createDefaultChatOverlaySettings();
  const theme = oneOf<ChatOverlayTheme>(input.theme, ['light', 'dark', 'transparent', 'neon', 'ember'], 'dark');
  const next: ChatOverlaySettings = { ...d, ...structuredCloneTokens(presetTokensForLegacyTheme(theme)) };

  next.enabled = bool(input.enabled, d.enabled);

  const anchor = oneOf<ChatOverlayAlignment>(
    input.alignment,
    ['bottom-left', 'bottom-right', 'top-left', 'top-right'],
    'bottom-left',
  );
  next.block = defaultBlockForAnchor(anchor);

  const L = CHAT_OVERLAY_LIMITS;
  next.flow = {
    maxMessages: int(input.maxMessages, L.maxMessages, d.flow.maxMessages),
    durationSeconds: normalizeDuration(input.durationSeconds, d.flow.durationSeconds),
    displayMode: oneOf(input.displayMode, ['stacked', 'latest'], d.flow.displayMode),
    direction: 'up',
    gap: int(input.spacing, L.gap, d.flow.gap),
    sizeScale: int(input.scale, L.sizeScale, d.flow.sizeScale),
  };

  // Explicit v1 overrides layered over the preset.
  const fontFamily = oneOf<ChatOverlayFontFamily>(input.fontFamily, FONT_FAMILIES, 'barlow');
  next.text.font = { family: fontFamily, customName: '' };
  next.username.font = { family: fontFamily, customName: '' };
  next.text.size = int(input.fontSize, L.fontSize, d.text.size);
  // v1 derived the username size from the message size; preserve that ratio.
  next.username.size = clampInt(Math.round(next.text.size * 0.7), L.usernameSize.min, L.usernameSize.max);
  next.text.shadow = bool(input.textShadow, next.text.shadow);
  next.username.show = bool(input.showUsernames, next.username.show);

  next.avatar.show = bool(input.showAvatars, next.avatar.show);
  next.avatar.size = int(input.avatarSize, L.avatarSize, d.avatar.size);
  next.avatar.shape = oneOf(input.avatarShape, ['circle', 'rounded', 'square', 'squircle'], next.avatar.shape);
  next.avatar.position = oneOf(input.avatarPosition, ['left', 'right'], next.avatar.position);

  next.badges.show = bool(input.showBadges, next.badges.show);

  next.bubble.background.alpha = int(input.backgroundOpacity, L.alpha, next.bubble.background.alpha);
  if (oneOf(input.messageStyle, ['rounded', 'square'], 'rounded') === 'square') {
    next.bubble.border.radius = 3;
  }

  // v1 compactMode was a boolean; it becomes reduced padding and gap.
  if (bool(input.compactMode, false)) {
    next.bubble.padding = { x: 13, y: 7 };
    next.flow.gap = Math.max(L.gap.min, Math.round(next.flow.gap * 0.6));
  }

  next.animation.kind = oneOf(input.animation, ['slide', 'fade', 'pop', 'glow', 'flip', 'off'], next.animation.kind);

  return next;
}

export function normalizeChatOverlayMessage(value: Partial<ChatMessage> | null | undefined): NormalizedChatOverlayMessage {
  const input = value ?? {};
  const suppliedId = typeof input.id === 'string' && input.id.trim().length > 0 ? input.id : '';
  return {
    id: suppliedId || buildFallbackMessageId(),
    username: trimAndCap(input.username, 32) || 'viewer',
    userId: trimAndCap(input.userId, 64),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    isBroadcaster: input.isBroadcaster === true,
    isMod: input.isMod === true,
    isVip: input.isVip === true,
    isSubscriber: input.isSubscriber === true,
    message: trimAndCap(input.message, 500),
    timestamp: trimAndCap(input.timestamp, 64),
    emotes: normalizeEmoteRanges(input.emotes),
    color: color(input.color, ''),
  };
}

function normalizeEmoteRanges(value: unknown): EmoteRange[] {
  if (!Array.isArray(value)) return [];
  const ranges: EmoteRange[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = trimAndCap(entry.id, 64);
    const start = entry.start;
    const end = entry.end;
    if (!id) continue;
    if (typeof start !== 'number' || typeof end !== 'number') continue;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < 0 || end < start) continue;
    ranges.push({ id, start, end });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- primitives

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function int(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clampInt(value, range.min, range.max);
}

function float(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

/** 0 (never expire) is allowed; anything else is clamped into the normal range. */
function normalizeDuration(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value === 0) return 0;
  return clampInt(value, CHAT_OVERLAY_LIMITS.durationSeconds.min, CHAT_OVERLAY_LIMITS.durationSeconds.max);
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function color(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed : fallback;
}

function font(value: unknown, fallback: ChatOverlayFontChoice): ChatOverlayFontChoice {
  if (!isRecord(value)) return { ...fallback };
  const family = oneOf(value.family, [...FONT_FAMILIES, 'custom'] as const, fallback.family);
  // Strip characters that would let a font name break out of the CSS declaration.
  const customName = trimAndCap(value.customName, 64).replace(/[;{}"'<>\\]/g, '');
  return { family, customName };
}

function normalizeBlock(value: Record<string, unknown>, fallback: ChatOverlaySettings['block']) {
  const L = CHAT_OVERLAY_LIMITS.block;
  const width = int(value.width, L.width, fallback.width);
  const height = int(value.height, L.height, fallback.height);
  // Keep the block inside the canvas rather than rejecting off-canvas values.
  const x = int(value.x, { min: 0, max: Math.max(0, CHAT_OVERLAY_CANVAS.width - width) }, fallback.x);
  const y = int(value.y, { min: 0, max: Math.max(0, CHAT_OVERLAY_CANVAS.height - height) }, fallback.y);
  return {
    x,
    y,
    width,
    height,
    anchor: oneOf(value.anchor, ['bottom-left', 'bottom-right', 'top-left', 'top-right'], fallback.anchor),
  };
}

function stringList(value: unknown, maxEntries: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed.slice(0, 64));
    if (out.length >= maxEntries) break;
  }
  return out;
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

/** Deep copy of the preset token groups so callers cannot mutate the preset table. */
function structuredCloneTokens(tokens: ReturnType<typeof presetTokensForLegacyTheme>) {
  return {
    bubble: {
      background: { ...tokens.bubble.background },
      border: { ...tokens.bubble.border },
      padding: { ...tokens.bubble.padding },
      shadow: tokens.bubble.shadow,
      shadowColor: tokens.bubble.shadowColor,
      blur: tokens.bubble.blur,
      accent: { ...tokens.bubble.accent },
    },
    username: { ...tokens.username, font: { ...tokens.username.font } },
    text: { ...tokens.text, font: { ...tokens.text.font } },
    avatar: { ...tokens.avatar },
    badges: { ...tokens.badges },
    animation: { ...tokens.animation },
  };
}

// ------------------------------------------------------------------ BiDi

/**
 * Detects whether a chat message should be treated as Right-to-Left (e.g. Arabic, Hebrew).
 * Strips leading @mentions, badges, punctuation, and emojis to test the true message content.
 */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  const stripped = text.replace(/^(@\w+\s*)+/, '').replace(/^![a-zA-Z0-9_-]+\s*/, '').trim();
  if (!stripped) return false;

  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  const ltrRegex = /[A-Za-z\u00C0-\u024F\u0370-\u052F]/;

  let rtlCount = 0;
  let ltrCount = 0;
  let firstStrong: 'rtl' | 'ltr' | null = null;

  for (const char of stripped) {
    if (rtlRegex.test(char)) {
      rtlCount++;
      if (!firstStrong) firstStrong = 'rtl';
    } else if (ltrRegex.test(char)) {
      ltrCount++;
      if (!firstStrong) firstStrong = 'ltr';
    }
  }

  return firstStrong === 'rtl' || rtlCount > ltrCount;
}

/**
 * Ensures mixed BiDi text (e.g. Arabic with English words or numbers) maintains
 * strictly isolated bidirectional embedding so words are not swapped by the browser.
 */
export function formatBidiText(text: string, isRtl: boolean): string {
  if (!text) return '';
  if (!isRtl) return text;
  // \u2067 is Right-to-Left Isolate (RLI), \u2069 is Pop Directional Isolate (PDI)
  return `\u2067${text}\u2069`;
}
