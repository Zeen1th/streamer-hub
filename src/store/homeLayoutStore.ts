import { create } from 'zustand';
import {
  DEFAULT_LAYOUT,
  addWidget,
  moveWidget,
  normalizeLayout,
  nudgeWidget,
  removeWidget,
  resizeWidget,
  setWidgetConfig,
  type LayoutItem,
  type WidgetId,
  type WidgetSize,
} from '../lib/homeLayout';

const LAYOUT_KEY = 'streamer-hub-home-layout-v2';
const CHECKLIST_KEY = 'streamer-hub-home-checklist-v1';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface HomeLayoutState {
  items: LayoutItem[];
  checklist: ChecklistItem[];
  add(id: WidgetId): void;
  remove(id: WidgetId): void;
  resize(id: WidgetId, size: WidgetSize): void;
  nudge(id: WidgetId, direction: -1 | 1): void;
  move(id: WidgetId, targetId: WidgetId): void;
  configure(id: WidgetId, patch: Record<string, string>): void;
  replaceLayout(items: readonly LayoutItem[]): void;
  resetLayout(): void;
  addChecklistItem(text: string): void;
  toggleChecklistItem(id: string): void;
  removeChecklistItem(id: string): void;
  resetChecklist(): void;
}

function read<T>(key: string, fallback: T, parse: (raw: unknown) => T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // preferences just won't persist
  }
}

const parseChecklist = (raw: unknown): ChecklistItem[] =>
  Array.isArray(raw)
    ? raw
        .filter((r): r is ChecklistItem => !!r && typeof r.id === 'string' && typeof r.text === 'string')
        .map((r) => ({ id: r.id, text: r.text, done: !!r.done }))
    : [];

const DEFAULT_CHECKLIST: ChecklistItem[] = ['Check mic and camera', 'Start OBS recording', 'Update stream title', 'Test the chat overlay'].map((text, i) => ({
  id: `default-${i}`,
  text,
  done: false,
}));

export const useHomeLayoutStore = create<HomeLayoutState>((set, get) => {
  const commit = (items: LayoutItem[]) => {
    set({ items });
    write(LAYOUT_KEY, items);
  };
  const commitChecklist = (checklist: ChecklistItem[]) => {
    set({ checklist });
    write(CHECKLIST_KEY, checklist);
  };

  return {
    items: read(LAYOUT_KEY, normalizeLayout(DEFAULT_LAYOUT), normalizeLayout),
    checklist: read(CHECKLIST_KEY, DEFAULT_CHECKLIST, parseChecklist),
    add: (id) => commit(addWidget(get().items, id)),
    remove: (id) => commit(removeWidget(get().items, id)),
    resize: (id, size) => commit(resizeWidget(get().items, id, size)),
    nudge: (id, direction) => commit(nudgeWidget(get().items, id, direction)),
    move: (id, targetId) => commit(moveWidget(get().items, id, targetId)),
    configure: (id, patch) => commit(setWidgetConfig(get().items, id, patch)),
    replaceLayout: (items) => commit(normalizeLayout(items)),
    resetLayout: () => commit(normalizeLayout(DEFAULT_LAYOUT)),
    addChecklistItem: (text) => {
      const clean = text.trim().slice(0, 120);
      if (!clean) return;
      commitChecklist([...get().checklist, { id: crypto.randomUUID(), text: clean, done: false }]);
    },
    toggleChecklistItem: (id) => commitChecklist(get().checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c))),
    removeChecklistItem: (id) => commitChecklist(get().checklist.filter((c) => c.id !== id)),
    resetChecklist: () => commitChecklist(get().checklist.map((c) => ({ ...c, done: false }))),
  };
});
