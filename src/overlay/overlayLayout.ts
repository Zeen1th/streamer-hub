import type { CSSProperties } from 'react';
import type { OverlayAnimation, OverlayPosition } from '../rpc/contracts';

/*
 * Layout for pop-ups (pictures, GIFs, clips) on the 1920x1080 browser source.
 *
 * Inline styles on purpose: the standalone image/clip page ships no stylesheet,
 * so Tailwind class names would silently do nothing there.
 */

const EDGE = 32;

/** The fixed frame that places a pop-up on the screen. */
export function overlayPositionStyle(position: OverlayPosition | undefined): CSSProperties {
  const frame: CSSProperties = { position: 'fixed', display: 'flex', pointerEvents: 'none', zIndex: 9999 };
  switch (position) {
    case 'top-left':
      return { ...frame, top: EDGE, left: EDGE, alignItems: 'flex-start', justifyContent: 'flex-start' };
    case 'top-right':
      return { ...frame, top: EDGE, right: EDGE, alignItems: 'flex-start', justifyContent: 'flex-end' };
    case 'bottom-left':
      return { ...frame, bottom: EDGE, left: EDGE, alignItems: 'flex-end', justifyContent: 'flex-start' };
    case 'bottom-right':
      return { ...frame, bottom: EDGE, right: EDGE, alignItems: 'flex-end', justifyContent: 'flex-end' };
    case 'top-center':
      return { ...frame, top: EDGE, left: 0, right: 0, alignItems: 'flex-start', justifyContent: 'center' };
    case 'bottom-center':
      return { ...frame, bottom: EDGE, left: 0, right: 0, alignItems: 'flex-end', justifyContent: 'center' };
    case 'fullscreen':
    case 'center':
    default:
      return { ...frame, inset: 0, alignItems: 'center', justifyContent: 'center' };
  }
}

/** Where a pop-up starts from (and returns to when it leaves). */
const HIDDEN_TRANSFORM: Record<OverlayAnimation, string> = {
  bounce: 'scale(0.75)',
  zoom: 'scale(0.5)',
  fade: 'none',
  'slide-up': 'translateY(64px)',
  'slide-down': 'translateY(-64px)',
  none: 'none',
};

const ENTER_TRANSITION: Record<OverlayAnimation, string> = {
  bounce: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  zoom: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
  fade: 'opacity 400ms ease-out',
  'slide-up': 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
  'slide-down': 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
  none: 'none',
};

/** Entering (visible) or leaving (not visible) motion for a pop-up. */
export function overlayMotionStyle(animation: OverlayAnimation | undefined, visible: boolean): CSSProperties {
  const kind: OverlayAnimation = animation ?? 'bounce';
  if (visible) {
    return { opacity: 1, transform: 'none', transition: ENTER_TRANSITION[kind] };
  }
  return { opacity: 0, transform: HIDDEN_TRANSFORM[kind], transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)' };
}
