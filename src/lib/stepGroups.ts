import type { SequenceStep } from '../rpc/contracts';

/** Steps whose result an If can check. A poll reset clears the result, so it is not one. */
export function isGameStep(step: SequenceStep): boolean {
  return (
    step.type === 'duel' ||
    step.type === 'duel_streamer' ||
    (step.type === 'poll' && step.pollAction !== 'reset')
  );
}

/**
 * If the step at `index` is an If sitting directly under a game step (only other Ifs in between),
 * return that game's index. Such an If is shown nested inside the game and moves with it.
 */
export function attachedGameIndex(steps: SequenceStep[], index: number): number {
  if (steps[index]?.type !== 'if') return -1;
  for (let i = index - 1; i >= 0; i--) {
    if (steps[i].type === 'if') continue;
    return isGameStep(steps[i]) ? i : -1;
  }
  return -1;
}

/** A game step plus the Ifs attached under it; any other step is a block of one. */
export function stepBlock(steps: SequenceStep[], index: number): [number, number] {
  if (!isGameStep(steps[index])) return [index, index];
  let end = index;
  while (steps[end + 1]?.type === 'if') end++;
  return [index, end];
}

/** Where a new If goes: right under the nearest earlier game (after its attached Ifs), else the end. */
export function insertIndexForIf(steps: SequenceStep[]): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (isGameStep(steps[i])) return stepBlock(steps, i)[1] + 1;
  }
  return steps.length;
}

function moveRange(steps: SequenceStep[], start: number, end: number, insertAt: number): SequenceStep[] {
  const next = [...steps];
  const moved = next.splice(start, end - start + 1);
  next.splice(insertAt, 0, ...moved);
  return next;
}

/** One step up/down, carrying a game's attached Ifs with it. */
export function moveStepBlock(steps: SequenceStep[], index: number, direction: 'up' | 'down'): SequenceStep[] {
  if (index < 0 || index >= steps.length) return steps;
  const attached = attachedGameIndex(steps, index) >= 0;
  const [start, end] = attached ? [index, index] : stepBlock(steps, index);

  if (direction === 'up') {
    if (start === 0) return steps;
    const prev = start - 1;
    const game = attachedGameIndex(steps, prev);
    const prevStart = attached ? prev : game >= 0 ? game : prev;
    return moveRange(steps, start, end, prevStart);
  }

  const nextStart = end + 1;
  if (nextStart >= steps.length) return steps;
  const nextEnd = attached ? nextStart : stepBlock(steps, nextStart)[1];
  // after removing the block, the target block shifts up by the block length
  return moveRange(steps, start, end, nextEnd - (end - start));
}

/** Drag and drop: move `from` onto the row at `to`, carrying a game's attached Ifs. */
export function reorderStepBlock(steps: SequenceStep[], from: number, to: number): SequenceStep[] {
  if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps;
  const [start, end] = stepBlock(steps, from);
  if (to >= start && to <= end) return steps;
  const count = end - start + 1;
  if (to < start) return moveRange(steps, start, end, to);
  const targetEnd = stepBlock(steps, to)[1];
  return moveRange(steps, start, end, targetEnd - count + 1);
}
