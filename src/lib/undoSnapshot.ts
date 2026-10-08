import type { AutoReply, CommandSequence, Counter } from '../rpc/contracts.ts';

/** What Ctrl+Z / Ctrl+Y cover: every command (sequences, replies, counters), not live data like counts. */
export interface UndoSnapshot {
  sequences: CommandSequence[];
  rules: AutoReply[];
  counters: Counter[];
}

export interface UndoLabel {
  kind: 'sequence' | 'reply' | 'counter';
  action: 'added' | 'removed' | 'edited';
  name: string;
}

/** Counters keep counting while you work, so the live count must not count as an edit. */
export const withoutCount = (counter: Counter) => {
  const { count: _count, ...rest } = counter;
  return rest;
};

export const serializeSnapshot = (snapshot: UndoSnapshot) =>
  JSON.stringify({
    sequences: snapshot.sequences,
    rules: snapshot.rules,
    counters: snapshot.counters.map(withoutCount),
  });

function diffItems<T extends { id: string }>(
  kind: UndoLabel['kind'],
  before: T[],
  after: T[],
  name: (item: T) => string,
  fingerprint: (item: T) => string,
): { scope: string; label: UndoLabel } | null {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  for (const item of after) {
    const old = beforeById.get(item.id);
    if (!old) return { scope: `${kind}:${item.id}`, label: { kind, action: 'added', name: name(item) } };
    if (fingerprint(old) !== fingerprint(item)) return { scope: `${kind}:${item.id}`, label: { kind, action: 'edited', name: name(old) || name(item) } };
  }
  for (const item of before) {
    if (!afterById.has(item.id)) return { scope: `${kind}:${item.id}`, label: { kind, action: 'removed', name: name(item) } };
  }
  return null;
}

/** Which thing changed (used to merge quick edits) and a label for the "Undone: ..." message. */
export function describeChange(before: UndoSnapshot, after: UndoSnapshot): { scope: string; label: UndoLabel } {
  return (
    diffItems('sequence', before.sequences, after.sequences, (s) => s.name || '', (s) => JSON.stringify(s)) ??
    diffItems('reply', before.rules, after.rules, (r) => r.triggers[0] ?? '', (r) => JSON.stringify(r)) ??
    diffItems('counter', before.counters, after.counters, (c) => c.name, (c) => JSON.stringify(withoutCount(c))) ?? {
      scope: 'misc',
      label: { kind: 'sequence', action: 'edited', name: '' },
    }
  );
}

