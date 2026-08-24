import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels, type UpdateState } from '../rpc/contracts';

interface UpdateStore extends UpdateState {
  checked: boolean;
  check: () => Promise<void>;
}

const initial: UpdateState = {
  currentVersion: '0.1.0',
  latestVersion: '0.1.0',
  updateAvailable: false,
  releaseUrl: 'https://github.com/Zeen1th/streamer-hub/releases/latest',
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  ...initial,
  checked: false,
  check: async () => {
    try {
      const result = await rpc.invoke(Channels.UpdateCheck);
      set({ ...result, checked: true });
    } catch {
      set({ checked: true });
    }
  },
}));
