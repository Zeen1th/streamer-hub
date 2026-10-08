import { create } from 'zustand';
import { UndoHistory } from '../lib/undoHistory';
import { describeChange, serializeSnapshot, type UndoLabel, type UndoSnapshot } from '../lib/undoSnapshot';
import { useAutoReplyStore } from './autoReplyStore';
import { useCounterStore } from './counterStore';
import { useSequenceStore } from './sequenceStore';

export type UndoToast =
  | { type: 'undone' | 'redone'; label: UndoLabel; at: number }
  | { type: 'nothing-to-undo' | 'nothing-to-redo'; at: number };

interface UndoUiState {
  canUndo: boolean;
  canRedo: boolean;
  toast: UndoToast | null;
}

export const useUndoStore = create<UndoUiState>(() => ({ canUndo: false, canRedo: false, toast: null }));

const history = new UndoHistory<UndoSnapshot, UndoLabel>({
  equals: (a, b) => serializeSnapshot(a) === serializeSnapshot(b),
  limit: 100,
  mergeWindowMs: 1000,
});

function takeSnapshot(): UndoSnapshot {
  return {
    sequences: useSequenceStore.getState().sequences,
    rules: useAutoReplyStore.getState().rules,
    counters: useCounterStore.getState().counters,
  };
}

let armed = false;
let applying = false;

function refreshFlags() {
  useUndoStore.setState({ canUndo: history.canUndo, canRedo: history.canRedo });
}

function onStoreChange() {
  if (!armed || applying) return;
  const before = history.current;
  const after = takeSnapshot();
  if (!before) return;
  const { scope, label } = describeChange(before, after);
  if (history.record(after, scope, label, Date.now())) refreshFlags();
}

function apply(snapshot: UndoSnapshot) {
  applying = true;
  try {
    useSequenceStore.getState().restoreSequences(snapshot.sequences);
    useAutoReplyStore.getState().restoreRules(snapshot.rules);
    useCounterStore.getState().restoreCounters(snapshot.counters);
  } finally {
    applying = false;
  }
}

useSequenceStore.subscribe((state, prev) => {
  if (state.sequences !== prev.sequences) onStoreChange();
});
useAutoReplyStore.subscribe((state, prev) => {
  if (state.rules !== prev.rules) onStoreChange();
});
useCounterStore.subscribe((state, prev) => {
  if (state.counters !== prev.counters) onStoreChange();
});

export const undoManager = {
  /** Call once the saved commands have loaded: that state is the starting point and cannot be undone. */
  arm() {
    history.reset(takeSnapshot());
    armed = true;
    refreshFlags();
  },

  undo() {
    if (!armed) return;
    const entry = history.undo();
    if (!entry) {
      useUndoStore.setState({ toast: { type: 'nothing-to-undo', at: Date.now() } });
      return;
    }
    apply(entry.snapshot);
    refreshFlags();
    useUndoStore.setState({ toast: { type: 'undone', label: entry.label, at: Date.now() } });
  },

  redo() {
    if (!armed) return;
    const entry = history.redo();
    if (!entry) {
      useUndoStore.setState({ toast: { type: 'nothing-to-redo', at: Date.now() } });
      return;
    }
    apply(entry.snapshot);
    refreshFlags();
    useUndoStore.setState({ toast: { type: 'redone', label: entry.label, at: Date.now() } });
  },
};
