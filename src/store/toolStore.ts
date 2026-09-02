import { create } from 'zustand';
import type { LogKind } from '../rpc/contracts';
import { clampInspectorWidth, DEFAULT_INSPECTOR_WIDTH, type CommandGroup } from '../lib/commandProjection';

export type ToolId = 'home' | 'counter' | 'autoReplies' | 'chat' | 'feed' | 'settings';
export type AppTab = 'commands' | 'overlay' | 'activity' | 'settings';
export type SettingsSection = 'general' | 'system' | 'keybinds' | 'twitch' | 'ai' | 'guide';

interface ToolState {
  activeTool: ToolId;
  activeTab: AppTab;
  group: CommandGroup;
  selected: string[];
  query: string;
  logOpen: boolean;
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
  setLogFilter(filter: 'all' | LogKind): void;
  setMenu(menu: ToolState['menu']): void;
  setSection(section: SettingsSection): void;
  setInspectorWidth(width: number): void;
}

const toolToTab = (tool: ToolId): AppTab =>
  tool === 'chat' ? 'overlay' : tool === 'feed' ? 'activity' : tool === 'settings' ? 'settings' : 'commands';

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'home',
  activeTab: 'commands',
  group: 'all',
  selected: [],
  query: '',
  logOpen: localStorage.getItem('streamer-hub-log-open') !== 'false',
  logFilter: 'all',
  menu: null,
  section: 'general',
  inspectorWidth: clampInspectorWidth(
    typeof localStorage !== 'undefined'
      ? Number(localStorage.getItem('streamer-hub-inspector-width')) || DEFAULT_INSPECTOR_WIDTH
      : DEFAULT_INSPECTOR_WIDTH,
  ),
  setActiveTool: (activeTool) => set({ activeTool, activeTab: toolToTab(activeTool) }),
  setTab: (activeTab) => set({ activeTab, activeTool: activeTab === 'overlay' ? 'chat' : activeTab === 'activity' ? 'feed' : activeTab === 'settings' ? 'settings' : 'home', menu: null }),
  setGroup: (group) => set({ group, selected: [], menu: null }),
  setSelected: (selected) => set({ selected, menu: null }),
  setQuery: (query) => set({ query }),
  setLogOpen: (logOpen) => {
    localStorage.setItem('streamer-hub-log-open', String(logOpen));
    set({ logOpen });
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
