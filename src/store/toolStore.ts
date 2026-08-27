import { create } from 'zustand';

export type ToolId = 'home' | 'counter' | 'autoReplies' | 'chat' | 'feed' | 'settings';

interface ToolState {
  activeTool: ToolId;
  setActiveTool(tool: ToolId): void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'home',
  setActiveTool: (activeTool) => set({ activeTool }),
}));
