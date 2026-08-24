import { create } from 'zustand';
import type { LogKind, LogPayload } from '../rpc/contracts';
import { Channels } from '../rpc/contracts';
import { rpc } from '../rpc';

export interface LogEntry {
  id: string;
  timestamp: string;
  kind: LogKind;
  message: string;
  username?: string;
  count?: number;
}

interface LogState {
  entries: LogEntry[];
  add(entry: { kind: LogKind; message: string; username?: string; count?: number }): void;
  addLocal(entry: { kind: LogKind; message: string; username?: string; count?: number }): void;
  clear(): void;
}

const MAX_ENTRIES = 250;

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  add: (entry) => {
    const full: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    set((state) => ({ entries: [full, ...state.entries].slice(0, MAX_ENTRIES) }));
    const payload: LogPayload = {
      id: full.id,
      timestamp: full.timestamp,
      kind: full.kind,
      message: full.message,
      username: full.username,
      count: full.count,
    };
    rpc.invoke(Channels.LogAppend, payload).catch(() => undefined);
  },
  addLocal: (entry) => {
    const full: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    set((state) => ({ entries: [full, ...state.entries].slice(0, MAX_ENTRIES) }));
  },
  clear: () => set({ entries: [] }),
}));
