import type { CommandSequence, SequenceStep } from '../rpc/contracts';

/*
 * Numbered image sources. Each "show picture/GIF/video" step can have its own browser source
 * (image-overlay.html?slot=2), so two sequences never cover each other, or share the main source
 * (image-overlay.html), where a newer picture replaces the one showing. Steps made before this keep the main source.
 */

export const MAIN_IMAGE_SLOT = 'main';
export const IMAGE_OVERLAY_BASE_URL = 'http://127.0.0.1:49178/image-overlay.html';

/** The source a step shows on: its own number, or "main". */
export function imageSlotOf(step: Pick<SequenceStep, 'imageSlot'>): string {
  const slot = step.imageSlot?.trim();
  return slot ? slot : MAIN_IMAGE_SLOT;
}

function* walkSteps(steps: SequenceStep[]): Generator<SequenceStep> {
  for (const step of steps) {
    yield step;
    if (step.ifThen) yield* walkSteps(step.ifThen);
    if (step.ifElse) yield* walkSteps(step.ifElse);
  }
}

/** The numbered sources image steps already use, across every sequence (If branches included). */
export function usedImageSlots(sequences: CommandSequence[]): Set<string> {
  const used = new Set<string>();
  for (const seq of sequences) {
    for (const step of walkSteps(seq.steps ?? [])) {
      if (step.type === 'obs_image') {
        const slot = imageSlotOf(step);
        if (slot !== MAIN_IMAGE_SLOT) used.add(slot);
      }
    }
  }
  return used;
}

/** The lowest number no image step uses yet ("1", "2", ...). */
export function nextImageSlot(sequences: CommandSequence[], alsoTaken: Iterable<string> = []): string {
  const used = usedImageSlots(sequences);
  for (const slot of alsoTaken) used.add(slot);
  let n = 1;
  while (used.has(String(n))) n++;
  return String(n);
}

/** The browser source URL to add in OBS for this slot. */
export function imageOverlayUrl(slot: string | undefined): string {
  const clean = slot?.trim();
  return !clean || clean === MAIN_IMAGE_SLOT ? IMAGE_OVERLAY_BASE_URL : `${IMAGE_OVERLAY_BASE_URL}?slot=${encodeURIComponent(clean)}`;
}

/** Whether an image source page (its ?slot=, or none for main) shows a picture sent for `payloadSlot`. */
export function pageShowsImage(pageSlot: string | null | undefined, payloadSlot: string | null | undefined): boolean {
  const page = pageSlot?.trim() || MAIN_IMAGE_SLOT;
  const sent = payloadSlot?.trim() || MAIN_IMAGE_SLOT;
  return page === sent;
}
