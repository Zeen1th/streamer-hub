// Where the guided tour's card goes next to the thing it points at. Pure so it can be unit tested.

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type TourSide = 'right' | 'left' | 'below' | 'above' | 'center';

export interface TourPlacement {
  top: number;
  left: number;
  side: TourSide;
}

const MARGIN = 12;

/**
 * Puts a card of `card` size beside `target`, trying the right, then the left, then below, then above, and keeps it on
 * screen. With no target (or a target that is not on screen) the card is centred.
 */
export function placeTourCard(
  target: Box | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 16,
): TourPlacement {
  const clamp = (value: number, max: number) => Math.max(MARGIN, Math.min(value, Math.max(MARGIN, max - MARGIN)));
  const centred = (): TourPlacement => ({
    top: clamp((viewport.height - card.height) / 2, viewport.height - card.height),
    left: clamp((viewport.width - card.width) / 2, viewport.width - card.width),
    side: 'center',
  });

  if (!target || target.width <= 0 || target.height <= 0) return centred();
  const offScreen =
    target.left + target.width < 0 || target.top + target.height < 0 || target.left > viewport.width || target.top > viewport.height;
  if (offScreen) return centred();

  const right = target.left + target.width + gap;
  const left = target.left - gap - card.width;
  const below = target.top + target.height + gap;
  const above = target.top - gap - card.height;
  // Line the card up with the middle of the target where it fits
  const alignTop = clamp(target.top + target.height / 2 - card.height / 2, viewport.height - card.height);
  const alignLeft = clamp(target.left + target.width / 2 - card.width / 2, viewport.width - card.width);

  if (right + card.width <= viewport.width - MARGIN) return { top: alignTop, left: right, side: 'right' };
  if (left >= MARGIN) return { top: alignTop, left, side: 'left' };
  if (below + card.height <= viewport.height - MARGIN) return { top: below, left: alignLeft, side: 'below' };
  if (above >= MARGIN) return { top: above, left: alignLeft, side: 'above' };
  return centred();
}
