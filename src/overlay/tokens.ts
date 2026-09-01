import type { CSSProperties } from 'react';
import type {
  ChatOverlayFontChoice,
  ChatOverlaySettings,
  ChatOverlayShadow,
} from '../rpc/contracts';

/**
 * The single source of truth for the overlay's appearance.
 *
 * `overlay.css` contains no literal colours, sizes, radii, or shadows - every
 * property reads a custom property produced here. That is what keeps the OBS
 * renderer and the in-app editor from drifting: they consume the same tokens.
 */

const FONT_STACKS: Record<string, string> = {
  barlow: '"Barlow", "Segoe UI", sans-serif',
  cairo: '"Cairo", "Segoe UI", sans-serif',
  cinzel: '"Cinzel", Georgia, serif',
  'jetbrains-mono': '"JetBrains Mono", ui-monospace, monospace',
  system: 'ui-sans-serif, system-ui, sans-serif',
};

const FALLBACK_STACK = 'ui-sans-serif, system-ui, sans-serif';

export function resolveFontStack(font: ChatOverlayFontChoice): string {
  if (font.family === 'custom') {
    const name = font.customName.trim();
    // Normalization already strips quotes, braces, and semicolons from the name.
    return name ? `"${name}", ${FALLBACK_STACK}` : FALLBACK_STACK;
  }
  return FONT_STACKS[font.family] ?? FALLBACK_STACK;
}

/** Expands #rgb / #rgba / #rrggbb / #rrggbbaa into channel values. */
function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null {
  const value = hex.trim().replace('#', '');
  const expand = (c: string) => parseInt(c + c, 16);
  if (value.length === 3 || value.length === 4) {
    return {
      r: expand(value[0]),
      g: expand(value[1]),
      b: expand(value[2]),
      a: value.length === 4 ? expand(value[3]) / 255 : 1,
    };
  }
  if (value.length === 6 || value.length === 8) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
      a: value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1,
    };
  }
  return null;
}

/** `alpha` is 0..100 and replaces any alpha already carried by the hex value. */
export function rgba(hex: string, alpha: number): string {
  const parsed = parseHex(hex);
  if (!parsed) return 'transparent';
  const a = Math.min(1, Math.max(0, alpha / 100));
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${round(a, 3)})`;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function buildShadow(kind: ChatOverlayShadow, color: string): string {
  if (kind === 'off') return 'none';
  if (kind === 'hard') return `0 0 20px ${rgba(color, 40)}`;
  return `0 10px 28px ${rgba(color, 28)}`;
}

const AVATAR_RADII: Record<string, string> = {
  circle: '50%',
  rounded: '8px',
  square: '2px',
  squircle: '28%',
};

/**
 * Produces the CSS custom properties for a settings object.
 *
 * `flow.sizeScale` is applied HERE, by multiplying pixel values before they
 * reach CSS. It is deliberately NOT a `transform: scale()` on the output - that
 * rasterizes at the base size and stretches the bitmap, which is what made the
 * overlay blurry when scaled up. Multiplying the values instead makes the font
 * engine redraw text at its true size.
 */
export function settingsToCssVars(settings: ChatOverlaySettings): CSSProperties {
  const s = settings.flow.sizeScale / 100;
  const px = (value: number) => `${round(value * s)}px`;

  /*
   * Role colours are NOT referenced from here.
   *
   * `--co-role-color` is defined per message (it depends on data-role), while
   * these tokens are declared on the canvas. A custom property's value is
   * substituted at its own declaration site, so `--co-x: var(--co-role-color)`
   * written here resolves against the canvas - where the role colour does not
   * exist - and computes to the guaranteed-invalid value, silently falling back
   * to inherited text colour.
   *
   * Instead each "custom" override is emitted only when the user actually chose
   * one, and the stylesheet expresses the fallback at the point of use:
   *   color: var(--co-username-custom, var(--co-role-color))
   * which resolves inside the message, where the role colour is in scope.
   */
  const accentCustom =
    settings.bubble.accent.colorMode === 'custom' ? settings.bubble.accent.color : undefined;

  const avatarBorderCustom =
    settings.avatar.borderColorMode === 'custom' ? settings.avatar.borderColor : undefined;

  // 'twitch' resolves per message from the user's own chat colour, applied
  // inline on the element, so it needs no token here.
  const usernameCustom =
    settings.username.colorMode === 'custom' ? settings.username.color : undefined;
  const inlineUsername = settings.username.position === 'inline';

  return {
    '--co-gap': px(settings.flow.gap),

    '--co-bubble-bg': rgba(settings.bubble.background.color, settings.bubble.background.alpha),
    '--co-bubble-border-width': px(settings.bubble.border.width),
    '--co-bubble-border-color': settings.bubble.border.color,
    '--co-bubble-radius': px(settings.bubble.border.radius),
    '--co-bubble-pad-x': px(settings.bubble.padding.x),
    '--co-bubble-pad-y': px(settings.bubble.padding.y),
    '--co-bubble-shadow': buildShadow(settings.bubble.shadow, settings.bubble.shadowColor),
    '--co-bubble-blur': settings.bubble.blur > 0 ? `blur(${px(settings.bubble.blur)})` : 'none',

    '--co-accent-width': px(settings.bubble.accent.width),
    '--co-accent-custom': accentCustom,

    '--co-username-font': resolveFontStack(settings.username.font),
    '--co-username-size': px(settings.username.size),
    '--co-username-weight': `${settings.username.weight}`,
    '--co-username-spacing': `${round(settings.username.letterSpacing, 3)}em`,
    '--co-username-custom': usernameCustom,
    '--co-username-transform': settings.username.transform,

    '--co-header-display': inlineUsername ? 'inline' : 'flex',
    '--co-header-margin-end': inlineUsername ? '0.4em' : '0',
    '--co-text-display': inlineUsername ? 'inline' : 'block',

    '--co-text-font': resolveFontStack(settings.text.font),
    '--co-text-size': px(settings.text.size),
    '--co-text-weight': `${settings.text.weight}`,
    '--co-text-color': settings.text.color,
    '--co-text-line-height': `${round(settings.text.lineHeight, 3)}`,
    '--co-text-spacing': `${round(settings.text.letterSpacing, 3)}em`,
    '--co-text-max-width': settings.text.maxWidth > 0 ? px(settings.text.maxWidth) : '100%',

    '--co-avatar-size': px(settings.avatar.size),
    '--co-avatar-radius': AVATAR_RADII[settings.avatar.shape] ?? '50%',
    '--co-avatar-border-width': px(settings.avatar.borderWidth),
    '--co-avatar-border-custom': avatarBorderCustom,

    '--co-badge-size': px(settings.badges.size),

    '--co-emote-size': `${round((settings.text.size * settings.emotes.sizeScale) / 100 * s)}px`,
    '--co-emote-only-scale': `${round(settings.emotes.emoteOnlyScale / 100, 3)}`,

    '--co-anim-duration': `${settings.animation.durationMs}ms`,
  } as CSSProperties;
}

/** Absolute placement of the chat block inside the 1920x1080 canvas. */
export function blockPositionStyle(settings: ChatOverlaySettings): CSSProperties {
  const { x, y, width, height } = settings.block;
  return {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}
