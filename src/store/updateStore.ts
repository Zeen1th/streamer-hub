import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels, type UpdateState } from '../rpc/contracts';
import { createDebugUpdateState } from '../lib/updateDebug';

interface UpdateStore extends UpdateState {
  checked: boolean;
  installing: boolean;
  check: () => Promise<UpdateState | null>;
  install: () => Promise<boolean>;
  debugPromptRequested: boolean;
  simulateUpdate: () => Promise<boolean>;
  clearDebugPrompt: () => void;
}

const initial: UpdateState = {
  currentVersion: '0.1.0',
  latestVersion: '0.1.0',
  updateAvailable: false,
  releaseUrl: 'https://github.com/Zeen1th/streamer-hub/releases/latest',
};

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  ...initial,
  checked: false,
  installing: false,
  debugPromptRequested: false,
  check: async () => {
    try {
      const result = await rpc.invoke(Channels.UpdateCheck);
      set({ ...result, checked: true });
      return result;
    } catch {
      set({ checked: true });
      return null;
    }
  },
  simulateUpdate: async () => {
    const result = await get().check();
    const simulated = result ? createDebugUpdateState(result) : null;
    if (!simulated) return false;
    set({ ...simulated, debugPromptRequested: true });
    return true;
  },
  clearDebugPrompt: () => set({ debugPromptRequested: false }),
  install: async () => {
    const state = get();
    if (!state.downloadUrl) return false;
    set({ installing: true });
    try {
      const result = await rpc.invoke(Channels.UpdateInstall, { downloadUrl: state.downloadUrl });
      if (!result.ok) set({ installing: false });
      return result.ok;
    } catch {
      set({ installing: false });
      return false;
    }
  },
}));

