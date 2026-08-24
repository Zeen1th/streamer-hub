import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels, type UpdateState } from '../rpc/contracts';

interface UpdateStore extends UpdateState {
  checked: boolean;
  installing: boolean;
  check: () => Promise<void>;
  install: () => Promise<boolean>;
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
  check: async () => {
    try {
      const result = await rpc.invoke(Channels.UpdateCheck);
      set({ ...result, checked: true });
    } catch {
      set({ checked: true });
    }
  },
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

