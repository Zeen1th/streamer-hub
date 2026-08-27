import type { ChatOverlaySettings, ChatOverlayTheme } from '../rpc/contracts';

/**
 * The visual half of the settings. Presets deliberately exclude placement,
 * flow, filters, and `enabled` so applying one restyles the overlay without
 * moving it or discarding the user's moderation setup.
 */
export type ChatOverlayPresetTokens = Pick<
  ChatOverlaySettings,
  'bubble' | 'username' | 'text' | 'avatar' | 'badges' | 'animation'
>;

export interface ChatOverlayPreset {
  id: string;
  name: string;
  tokens: ChatOverlayPresetTokens;
}

const BARLOW = { family: 'barlow', customName: '' } as const;

function baseTokens(): ChatOverlayPresetTokens {
  return {
    bubble: {
      background: { color: '#101218', alpha: 85 },
      border: { width: 1, color: '#ffffff', radius: 18 },
      padding: { x: 16, y: 10 },
      shadow: 'soft',
      shadowColor: '#000000',
      blur: 12,
      accent: { width: 4, colorMode: 'role', color: '#8b5cf6' },
    },
    username: {
      show: true,
      font: { ...BARLOW },
      size: 17,
      weight: 700,
      letterSpacing: 0.03,
      colorMode: 'role',
      color: '#8b5cf6',
      transform: 'none',
      position: 'above',
    },
    text: {
      font: { ...BARLOW },
      size: 24,
      weight: 500,
      color: '#f7f4ee',
      lineHeight: 1.35,
      letterSpacing: 0,
      shadow: true,
      wrapMode: 'normal',
      maxWidth: 0,
    },
    avatar: {
      show: true,
      size: 32,
      shape: 'circle',
      position: 'left',
      borderWidth: 2,
      borderColorMode: 'role',
      borderColor: '#8b5cf6',
    },
    badges: { show: true, style: 'text', size: 10 },
    animation: { kind: 'slide', durationMs: 340 },
  };
}

/**
 * Presets are data, not render branches. Each one writes a complete token set
 * that the user is then free to modify field by field.
 */
export const CHAT_OVERLAY_PRESETS: readonly ChatOverlayPreset[] = [
  {
    id: 'dark',
    name: 'Dark',
    tokens: baseTokens(),
  },
  {
    id: 'light',
    name: 'Light',
    tokens: (() => {
      const t = baseTokens();
      t.bubble.background = { color: '#faf8f4', alpha: 85 };
      t.bubble.border.color = '#1f232d';
      t.bubble.shadowColor = '#1f232d';
      t.bubble.accent.color = '#6d28d9';
      t.username.color = '#6d28d9';
      t.text.color = '#181b22';
      t.text.shadow = false;
      t.avatar.borderColor = '#6d28d9';
      return t;
    })(),
  },
  {
    id: 'transparent',
    name: 'Transparent',
    tokens: (() => {
      const t = baseTokens();
      t.bubble.background = { color: '#0c0e14', alpha: 47 };
      t.bubble.blur = 6;
      t.bubble.shadow = 'soft';
      return t;
    })(),
  },
  {
    id: 'neon',
    name: 'Neon',
    tokens: (() => {
      const t = baseTokens();
      t.bubble.background = { color: '#080a12', alpha: 85 };
      t.bubble.border.color = '#06b6d4';
      t.bubble.shadow = 'hard';
      t.bubble.shadowColor = '#06b6d4';
      t.bubble.accent.color = '#06b6d4';
      t.text.color = '#ecfeff';
      t.animation.kind = 'glow';
      return t;
    })(),
  },
  {
    id: 'ember',
    name: 'Ember',
    tokens: (() => {
      const t = baseTokens();
      t.bubble.background = { color: '#1a120e', alpha: 85 };
      t.bubble.border.color = '#c8782c';
      t.bubble.shadow = 'hard';
      t.bubble.shadowColor = '#c8782c';
      t.bubble.accent.color = '#c8782c';
      t.text.color = '#fff7ed';
      return t;
    })(),
  },
  {
    id: 'bare',
    name: 'Bare',
    tokens: (() => {
      const t = baseTokens();
      // No chrome at all - just text over the scene.
      t.bubble.background.alpha = 0;
      t.bubble.border.width = 0;
      t.bubble.shadow = 'off';
      t.bubble.blur = 0;
      t.bubble.accent.width = 0;
      t.bubble.padding = { x: 0, y: 4 };
      // Text shadow is what keeps it readable once the panel is gone.
      t.text.shadow = true;
      return t;
    })(),
  },
];

export function findChatOverlayPreset(id: string): ChatOverlayPreset | undefined {
  return CHAT_OVERLAY_PRESETS.find((preset) => preset.id === id);
}

/** Maps a legacy v1 `theme` onto the preset that replaced it. */
export function presetTokensForLegacyTheme(theme: ChatOverlayTheme): ChatOverlayPresetTokens {
  return (findChatOverlayPreset(theme) ?? CHAT_OVERLAY_PRESETS[0]).tokens;
}
