export interface UndoEntry<S, L> {
  label: L;
  /** The state to go back to. */
  snapshot: S;
  at: number;
  /** Which thing was edited; quick consecutive edits to the same scope are merged into one step. */
  scope: string;
}

export interface UndoHistoryOptions<S> {
  equals: (a: S, b: S) => boolean;
  limit?: number;
  mergeWindowMs?: number;
}

/**
 * Snapshot-based undo / redo. `baseline` is always the current state; every recorded change pushes the
 * state it replaced. Typing in a field produces dozens of changes a second, so changes to the same scope
 * within `mergeWindowMs` of each other collapse into a single undo step.
 */
export class UndoHistory<S, L> {
  private past: UndoEntry<S, L>[] = [];
  private future: UndoEntry<S, L>[] = [];
  private baseline: S | null = null;
  private readonly options: UndoHistoryOptions<S>;
  private readonly limit: number;
  private readonly mergeWindowMs: number;

  constructor(options: UndoHistoryOptions<S>) {
    this.options = options;
    this.limit = options.limit ?? 100;
    this.mergeWindowMs = options.mergeWindowMs ?? 1000;
  }

  /** Start (or restart) from this state with no history. */
  reset(state: S) {
    this.baseline = state;
    this.past = [];
    this.future = [];
  }

  get current(): S | null {
    return this.baseline;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  /** Note that the state is now `next`. Returns true when it counted as a real change. */
  record(next: S, scope: string, label: L, now: number): boolean {
    if (this.baseline === null) return false;
    if (this.options.equals(this.baseline, next)) {
      this.baseline = next; // nothing worth undoing changed, but keep the latest values
      return false;
    }
    const previous = this.baseline;
    this.baseline = next;
    this.future = [];

    const last = this.past[this.past.length - 1];
    if (last && last.scope === scope && now - last.at <= this.mergeWindowMs) {
      last.at = now; // keep the older snapshot: one undo reverts the whole burst
      return true;
    }
    this.past.push({ label, snapshot: previous, at: now, scope });
    if (this.past.length > this.limit) this.past.shift();
    return true;
  }

  /** Step back. The caller applies `snapshot` to the app. */
  undo(): UndoEntry<S, L> | null {
    const entry = this.past.pop();
    if (!entry || this.baseline === null) return null;
    this.future.push({ ...entry, snapshot: this.baseline });
    this.baseline = entry.snapshot;
    return entry;
  }

  redo(): UndoEntry<S, L> | null {
    const entry = this.future.pop();
    if (!entry || this.baseline === null) return null;
    this.past.push({ ...entry, snapshot: this.baseline });
    this.baseline = entry.snapshot;
    return entry;
  }
}
