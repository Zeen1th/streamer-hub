import { create } from 'zustand';
import type { LogKind } from '../rpc/contracts';
import { clampInspectorWidth, DEFAULT_INSPECTOR_WIDTH, type CommandGroup } from '../lib/commandProjection';

export type ToolId = 'home' | 'counter' | 'autoReplies' | 'chat' | 'feed' | 'settings' | 'votes' | 'alerts';
export type AppTab = 'home' | 'commands' | 'overlay' | 'obs-chat' | 'votes' | 'alerts' | 'activity' | 'settings';
/** Settings pages, grouped like Windows 11 Settings. */
export type SettingsSection = 'connections' | 'appearance' | 'ai' | 'keybinds' | 'backups' | 'app' | 'help';

interface ToolState {
  activeTool: ToolId;
  activeTab: AppTab;
  group: CommandGroup;
  selected: string[];
  query: string;
  logOpen: boolean;
  /** Whether the log bar under the Commands list is shown at all (off by default). */
  logBarVisible: boolean;
  logFilter: 'all' | LogKind;
  menu: { x: number; y: number; rowId: string } | null;
  section: SettingsSection;
  inspectorWidth: number;
  setActiveTool(tool: ToolId): void;
  setTab(tab: AppTab): void;
  setGroup(group: CommandGroup): void;
  setSelected(selected: string[]): void;
  setQuery(query: string): void;
  setLogOpen(open: boolean): void;
  setLogBarVisible(visible: boolean): void;
  setLogFilter(filter: 'all' | LogKind): void;
  setMenu(menu: ToolState['menu']): void;
  setSection(section: SettingsSection): void;
  setInspectorWidth(width: number): void;
}

/** A remembered on/off choice; off when never set or when storage is unavailable. */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

const toolToTab =(tool: ToolId): AppTab =>
  tool === 'home'
    ? 'home'
    : tool === 'chat'
      ? 'overlay'
      : tool === 'feed'
        ? 'activity'
        : tool === 'votes'
          ? 'votes'
          : tool === 'alerts'
            ? 'alerts'
            : tool === 'settings'
              ? 'settings'
              : 'commands';

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'home',
  activeTab: 'home',
  group: 'all',
  selected: [],
  query: '',
  // The log is for troubleshooting, so it stays out of the way unless the streamer turns it on in Settings > System
  logOpen: readFlag('streamer-hub-log-open'),
  logBarVisible: readFlag('streamer-hub-log-bar'),
  logFilter: 'all',
  menu: null,
  section: 'connections',
  inspectorWidth: clampInspectorWidth(
    typeof localStorage !== 'undefined'
      ? Number(localStorage.getItem('streamer-hub-inspector-width')) || DEFAULT_INSPECTOR_WIDTH
      : DEFAULT_INSPECTOR_WIDTH,
  ),
  setActiveTool: (activeTool) => set({ activeTool, activeTab: toolToTab(activeTool) }),
  setTab: (activeTab) => set({
    activeTab,
    activeTool:
      activeTab === 'home'
        ? 'home'
        : activeTab === 'overlay' || activeTab === 'obs-chat'
          ? 'chat'
          : activeTab === 'votes'
            ? 'votes'
            : activeTab === 'alerts'
              ? 'alerts'
              : activeTab === 'activity'
                ? 'feed'
                : activeTab === 'settings'
                  ? 'settings'
                  : 'counter',
    menu: null,
  }),
  setGroup: (group) => set({ group, selected: [], menu: null }),
  setSelected: (selected) => set({ selected, menu: null }),
  setQuery: (query) => set({ query }),
  setLogOpen: (logOpen) => {
    try {
      localStorage.setItem('streamer-hub-log-open', String(logOpen));
    } catch {
      // ignore
    }
    set({ logOpen });
  },
  setLogBarVisible: (logBarVisible) => {
    try {
      localStorage.setItem('streamer-hub-log-bar', String(logBarVisible));
    } catch {
      // ignore
    }
    set({ logBarVisible });
  },
  setLogFilter: (logFilter) => set({ logFilter }),
  setMenu: (menu) => set({ menu }),
  setSection: (section) => set({ section }),
  setInspectorWidth: (inspectorWidth) => {
    const clamped = clampInspectorWidth(inspectorWidth);
    try {
      localStorage.setItem('streamer-hub-inspector-width', String(clamped));
    } catch {
      // ignore
    }
    set({ inspectorWidth: clamped });
  },
}));
