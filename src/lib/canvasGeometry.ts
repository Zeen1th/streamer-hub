/**
 * Pure geometry for the overlay canvas editor.
 *
 * Everything here works on plain rects in 1920x1080 canvas space and has no
 * React or DOM dependency, so drag/resize/snap behaviour can be tested directly
 * instead of through simulated pointer events.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface CanvasBounds {
  width: number;
  height: number;
}

export interface SnapOptions {
  /** Distance in canvas px within which a snap engages. */
  threshold: number;
  /** Inset from the canvas edges offered as a snap target. */
  safeArea: number;
  /** Set when the user holds Alt to move freely. */
  disabled?: boolean;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
}

export interface SnapResult {
  rect: Rect;
  guides: SnapGuide[];
}

export const DEFAULT_SNAP: SnapOptions = { threshold: 8, safeArea: 48 };

export const MIN_BLOCK_SIZE = { width: 160, height: 80 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Snap targets on each axis: canvas edges, safe-area inset, centre, and thirds. */
export function snapTargets(bounds: CanvasBounds, safeArea: number) {
  return {
    x: [0, safeArea, bounds.width / 3, bounds.width / 2, (bounds.width * 2) / 3, bounds.width - safeArea, bounds.width],
    y: [0, safeArea, bounds.height / 3, bounds.height / 2, (bounds.height * 2) / 3, bounds.height - safeArea, bounds.height],
  };
}

/**
 * Snaps a moving rect's leading, centre, and trailing edges to the nearest
 * target on each axis. Only the closest candidate per axis wins, so a rect never
 * gets pulled in two directions at once.
 */
export function snapRect(rect: Rect, bounds: CanvasBounds, options: SnapOptions = DEFAULT_SNAP): SnapResult {
  if (options.disabled) return { rect, guides: [] };

  const targets = snapTargets(bounds, options.safeArea);
  const guides: SnapGuide[] = [];
  let { x, y } = rect;

  const best = (edges: Array<{ value: number; delta: number }>, candidates: number[]) => {
    let winner: { offset: number; position: number } | null = null;
    for (const edge of edges) {
      for (const candidate of candidates) {
        const distance = Math.abs(edge.value - candidate);
        if (distance > options.threshold) continue;
        if (winner === null || distance < Math.abs(winner.offset)) {
          winner = { offset: candidate - edge.value, position: candidate };
        }
      }
    }
    return winner;
  };

  const xWinner = best(
    [
      { value: rect.x, delta: 0 },
      { value: rect.x + rect.width / 2, delta: rect.width / 2 },
      { value: rect.x + rect.width, delta: rect.width },
    ],
    targets.x,
  );
  if (xWinner) {
    x = rect.x + xWinner.offset;
    guides.push({ axis: 'x', position: xWinner.position });
  }

  const yWinner = best(
    [
      { value: rect.y, delta: 0 },
      { value: rect.y + rect.height / 2, delta: rect.height / 2 },
      { value: rect.y + rect.height, delta: rect.height },
    ],
    targets.y,
  );
  if (yWinner) {
    y = rect.y + yWinner.offset;
    guides.push({ axis: 'y', position: yWinner.position });
  }

  return { rect: { ...rect, x, y }, guides };
}

/** Keeps a rect fully inside the canvas without changing its size. */
export function clampToCanvas(rect: Rect, bounds: CanvasBounds): Rect {
  const width = clamp(rect.width, MIN_BLOCK_SIZE.width, bounds.width);
  const height = clamp(rect.height, MIN_BLOCK_SIZE.height, bounds.height);
  return {
    width,
    height,
    x: clamp(rect.x, 0, bounds.width - width),
    y: clamp(rect.y, 0, bounds.height - height),
  };
}

export function moveRect(start: Rect, dx: number, dy: number, bounds: CanvasBounds): Rect {
  return clampToCanvas({ ...start, x: start.x + dx, y: start.y + dy }, bounds);
}

/**
 * Resizes from a handle. Dragging a north or west handle moves the opposite edge
 * to stay put, which is why x/y are adjusted alongside width/height.
 */
export function resizeRect(start: Rect, handle: ResizeHandle, dx: number, dy: number, bounds: CanvasBounds): Rect {
  let { x, y, width, height } = start;

  if (handle.includes('e')) {
    width = start.width + dx;
  }
  if (handle.includes('w')) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (handle.includes('s')) {
    height = start.height + dy;
  }
  if (handle.includes('n')) {
    height = start.height - dy;
    y = start.y + dy;
  }

  // Enforce the minimum by pinning the anchored edge rather than letting the
  // rect invert when dragged past itself.
  if (width < MIN_BLOCK_SIZE.width) {
    if (handle.includes('w')) x = start.x + start.width - MIN_BLOCK_SIZE.width;
    width = MIN_BLOCK_SIZE.width;
  }
  if (height < MIN_BLOCK_SIZE.height) {
    if (handle.includes('n')) y = start.y + start.height - MIN_BLOCK_SIZE.height;
    height = MIN_BLOCK_SIZE.height;
  }

  return clampToCanvas({ x, y, width, height }, bounds);
}

/** Converts a pointer position in screen px into canvas coordinates. */
export function screenToCanvas(
  point: { x: number; y: number },
  origin: { left: number; top: number },
  scale: number,
): { x: number; y: number } {
  const safeScale = scale > 0 ? scale : 1;
  return {
    x: (point.x - origin.left) / safeScale,
    y: (point.y - origin.top) / safeScale,
  };
}

/** Scale that fits the canvas inside a viewport, never enlarging past 1:1. */
export function fitScale(viewport: { width: number; height: number }, bounds: CanvasBounds): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 1;
  return Math.min(viewport.width / bounds.width, viewport.height / bounds.height, 1);
}

/** Which corner the block sits nearest, used to keep the anchor presets honest. */
export function nearestAnchor(rect: Rect, bounds: CanvasBounds): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
  const centreX = rect.x + rect.width / 2;
  const centreY = rect.y + rect.height / 2;
  const vertical = centreY < bounds.height / 2 ? 'top' : 'bottom';
  const horizontal = centreX < bounds.width / 2 ? 'left' : 'right';
  return `${vertical}-${horizontal}` as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}
