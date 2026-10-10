// Layout model for the customizable Home dashboard: which widgets are shown, in what order, at what width.
// Pure and unit tested; homeLayoutStore.ts persists it.

export type WidgetId =
  | 'pulse'
  | 'activity'
  | 'feed'
  | 'leaderboard'
  | 'counter'
  | 'title'
  | 'keybinds'
  | 'reply'
  | 'overlay'
  | 'quickrun'
  | 'checklist';

/** Width in a 12-column grid. */
export type WidgetSize = 4 | 6 | 8 | 12;

export const WIDGET_SIZES: readonly WidgetSize[] = [4, 6, 8, 12];

export interface LayoutItem {
  id: WidgetId;
  size: WidgetSize;
  /** Widget-specific settings (selected tab, visible tiles...). Values are plain strings. */
  config?: Record<string, string>;
}

export interface WidgetMeta {
  id: WidgetId;
  defaultSize: WidgetSize;
  /** Sizes this widget looks right at. */
  sizes: readonly WidgetSize[];
}

export const WIDGETS: readonly WidgetMeta[] = [
  { id: 'pulse', defaultSize: 12, sizes: [8, 12] },
  { id: 'activity', defaultSize: 8, sizes: [6, 8, 12] },
  { id: 'feed', defaultSize: 4, sizes: [4, 6, 8] },
  { id: 'leaderboard', defaultSize: 6, sizes: [4, 6, 8] },
  { id: 'counter', defaultSize: 6, sizes: [4, 6, 8] },
  { id: 'title', defaultSize: 4, sizes: [4, 6, 8, 12] },
  { id: 'keybinds', defaultSize: 4, sizes: [4, 6, 8] },
  { id: 'reply', defaultSize: 4, sizes: [4, 6, 8] },
  { id: 'overlay', defaultSize: 4, sizes: [4, 6] },
  { id: 'quickrun', defaultSize: 6, sizes: [4, 6, 8, 12] },
  { id: 'checklist', defaultSize: 6, sizes: [4, 6, 8] },
];

const META = new Map<WidgetId, WidgetMeta>(WIDGETS.map((w) => [w.id, w]));

export function widgetMeta(id: WidgetId): WidgetMeta {
  return META.get(id) as WidgetMeta;
}

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && META.has(value as WidgetId);
}

const item = (id: WidgetId, size?: WidgetSize): LayoutItem => ({ id, size: size ?? widgetMeta(id).defaultSize });

export const DEFAULT_LAYOUT: readonly LayoutItem[] = [
  item('pulse'),
  item('activity'),
  item('feed'),
  item('leaderboard'),
  item('counter'),
  item('title'),
  item('keybinds'),
  item('reply'),
  item('quickrun'),
  item('checklist'),
];

export interface LayoutPreset {
  id: string;
  items: readonly LayoutItem[];
}

/** One-click starting points for the stream profile switcher. */
export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  {
    id: 'ranked',
    items: [item('pulse'), item('counter', 8), item('feed'), item('title'), item('keybinds'), item('leaderboard'), item('activity', 12), item('quickrun')],
  },
  {
    id: 'chatting',
    items: [item('pulse'), item('activity'), item('feed'), item('leaderboard', 8), item('reply'), item('title'), item('overlay'), item('quickrun', 8)],
  },
  {
    id: 'speedrun',
    items: [item('pulse', 8), item('feed'), item('counter', 8), item('keybinds'), item('title'), item('checklist'), item('overlay')],
  },
];

/** Cleans a stored layout: drops unknown/duplicate widgets and invalid sizes. Falls back to the default when empty or malformed. */
export function normalizeLayout(raw: unknown): LayoutItem[] {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map(cloneItem);
  const seen = new Set<WidgetId>();
  const items: LayoutItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, size, config } = entry as { id?: unknown; size?: unknown; config?: unknown };
    if (!isWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    const meta = widgetMeta(id);
    const validSize = (WIDGET_SIZES as readonly unknown[]).includes(size) ? (size as WidgetSize) : meta.defaultSize;
    const next: LayoutItem = { id, size: validSize };
    if (config && typeof config === 'object') {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
        if (typeof v === 'string') cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) next.config = cleaned;
    }
    items.push(next);
  }
  return items;
}

function cloneItem(i: LayoutItem): LayoutItem {
  return { ...i, config: i.config ? { ...i.config } : undefined };
}

export function addWidget(items: readonly LayoutItem[], id: WidgetId): LayoutItem[] {
  if (items.some((i) => i.id === id)) return [...items];
  return [...items, item(id)];
}

export function removeWidget(items: readonly LayoutItem[], id: WidgetId): LayoutItem[] {
  return items.filter((i) => i.id !== id);
}

export function resizeWidget(items: readonly LayoutItem[], id: WidgetId, size: WidgetSize): LayoutItem[] {
  return items.map((i) => (i.id === id ? { ...i, size } : i));
}

/** Moves a widget to sit where `targetId` is (before it when moving up/left, after it when moving down/right). */
export function moveWidget(items: readonly LayoutItem[], id: WidgetId, targetId: WidgetId): LayoutItem[] {
  const from = items.findIndex((i) => i.id === id);
  const to = items.findIndex((i) => i.id === targetId);
  if (from < 0 || to < 0 || from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Steps a widget one place earlier (-1) or later (+1). */
export function nudgeWidget(items: readonly LayoutItem[], id: WidgetId, direction: -1 | 1): LayoutItem[] {
  const from = items.findIndex((i) => i.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function setWidgetConfig(items: readonly LayoutItem[], id: WidgetId, patch: Record<string, string>): LayoutItem[] {
  return items.map((i) => (i.id === id ? { ...i, config: { ...(i.config ?? {}), ...patch } } : i));
}

export function availableWidgets(items: readonly LayoutItem[]): WidgetMeta[] {
  const used = new Set(items.map((i) => i.id));
  return WIDGETS.filter((w) => !used.has(w.id));
}
