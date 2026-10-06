export type PollOutcome =
  | { kind: 'winner'; label: string; index: number }
  | { kind: 'tie'; labels: string[] }
  | { kind: 'none' };

/** Decide a finished poll's result from its vote counts. */
export function evaluatePollOutcome(options: Array<{ label: string; votes: number }>): PollOutcome {
  const top = options.reduce((max, o) => Math.max(max, o.votes), 0);
  if (top <= 0) return { kind: 'none' };
  const leaders = options
    .map((o, index) => ({ ...o, index }))
    .filter((o) => o.votes === top);
  if (leaders.length > 1) return { kind: 'tie', labels: leaders.map((o) => o.label) };
  return { kind: 'winner', label: leaders[0].label, index: leaders[0].index };
}
