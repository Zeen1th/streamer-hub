/** Default interface size for everyone who has not picked one (Settings -> Display). */
export const DEFAULT_UI_SCALE = 1.1;

/** Layout needs roughly this many CSS pixels of width before panels start to feel cramped. */
export const MIN_LAYOUT_WIDTH = 1100;

/** Scale suggested by the monitor alone (screen size in CSS pixels). */
export function baseAutoScale(screenWidth: number, screenHeight: number): number {
  if (screenHeight >= 2000) return 1.35;
  if (screenHeight >= 1350) return 1.25;
  if (screenHeight < 900 || screenWidth < 1600) return 0.9;
  return 1.0;
}

/**
 * Auto scale = monitor-based scale, capped so the window keeps at least MIN_LAYOUT_WIDTH
 * CSS pixels of layout width. The cap moves in 0.05 steps so resizing doesn't make text jitter,
 * and it never pushes the scale below 1.0 (small monitors keep their reduced scale).
 */
export function autoScaleFor(screenWidth: number, screenHeight: number, windowWidth: number): number {
  const base = baseAutoScale(screenWidth, screenHeight);
  if (base <= 1) return base;
  const cap = Math.floor((windowWidth / MIN_LAYOUT_WIDTH) * 20) / 20;
  return Math.round(Math.max(1, Math.min(base, cap)) * 100) / 100;
}
