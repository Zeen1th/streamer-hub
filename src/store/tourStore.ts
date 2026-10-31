import { create } from 'zustand';

const DONE_KEY = 'streamer-hub-tour-done';

function readDone(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDone() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // storage unavailable: the tour may simply be offered again
  }
}

interface TourState {
  open: boolean;
  index: number;
  start(): void;
  /** Starts the tour only for someone who has never finished or skipped it. */
  startIfNew(): void;
  next(total: number): void;
  back(): void;
  close(): void;
}

export const useTourStore = create<TourState>((set, get) => ({
  open: false,
  index: 0,
  start: () => set({ open: true, index: 0 }),
  startIfNew: () => {
    if (!readDone()) get().start();
  },
  next: (total) => {
    const { index } = get();
    if (index + 1 >= total) get().close();
    else set({ index: index + 1 });
  },
  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  // Finishing and skipping both count: the tour is not pushed on the streamer again
  close: () => {
    writeDone();
    set({ open: false, index: 0 });
  },
}));
