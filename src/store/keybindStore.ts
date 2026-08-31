import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels } from '../rpc/contracts';
import type { ActionKeybind, KeybindRegistration } from '../rpc/contracts';
import { useAutoReplyStore } from './autoReplyStore';
import { useCounterStore } from './counterStore';

interface KeybindStoreState {
  bindings: ActionKeybind[];
  registrations: KeybindRegistration[];
  loading: boolean;
  saving: boolean;
  load(): Promise<void>;
  save(bindings: ActionKeybind[]): Promise<void>;
  remove(id: string): Promise<void>;
  trigger(id: string): boolean;
}

export const useKeybindStore = create<KeybindStoreState>((set, get) => ({
  bindings: [],
  registrations: [],
  loading: false,
  saving: false,
  load: async () => {
    set({ loading: true });
    try {
      const state = await rpc.invoke(Channels.KeybindsGetState);
      set({ bindings: state.bindings, registrations: state.registrations });
    } finally {
      set({ loading: false });
    }
  },
  save: async (bindings) => {
    set({ bindings, saving: true });
    try {
      const state = await rpc.invoke(Channels.KeybindsSave, { bindings });
      set({ bindings: state.bindings, registrations: state.registrations });
    } finally {
      set({ saving: false });
    }
  },
  remove: async (id) => get().save(get().bindings.filter((binding) => binding.id !== id)),
  trigger: (id) => {
    const binding = get().bindings.find((item) => item.id === id && item.enabled);
    if (!binding) return false;
    if (binding.targetType === 'counter') {
      if (binding.action === 'apply') return false;
      return useCounterStore.getState().triggerAction(binding.targetId, binding.action, 'keybind');
    }
    return useAutoReplyStore.getState().triggerTitleAction(binding.targetId, binding.action);
  },
}));
