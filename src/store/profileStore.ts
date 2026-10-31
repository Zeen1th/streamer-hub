import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels } from '../rpc/contracts';
import type { ProfilesState } from '../rpc/contracts';
import { buildStarterProfile } from '../lib/starterProfile';
import { useAutoReplyStore, flushPendingAutoReplies } from './autoReplyStore';
import { useCounterStore } from './counterStore';
import { useKeybindStore } from './keybindStore';
import { useSequenceStore } from './sequenceStore';
import { useSettingsStore } from './settingsStore';
import { undoManager } from './undoStore';

/*
 * Command profiles: complete sets of counters, replies, sequences and keybinds, one live at a time. The host swaps the
 * set; this store reloads the command stores from it so everything that reads commands (chat matching, timers, the
 * Commands page) sees the new set at once. A sequence that is already running keeps going on the steps it started with.
 */

interface ProfileStoreState {
  profiles: ProfilesState['profiles'];
  activeId: string;
  starterSeeded: boolean;
  loaded: boolean;
  busy: boolean;
  /** The profile whose commands the command stores currently hold. */
  loadedActiveId: string;
  load(): Promise<void>;
  applyState(state: ProfilesState): Promise<void>;
  switchTo(id: string): Promise<boolean>;
  add(name: string): Promise<string | null>;
  duplicate(id: string, name: string): Promise<string | null>;
  rename(id: string, name: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /** Adds Starter once, in the app language at this moment. */
  ensureStarter(): Promise<void>;
}

/** Pull the live command set from the host into the stores. */
export async function reloadCommandStores(): Promise<void> {
  const [counters, rules, sequences] = await Promise.all([
    rpc.invoke(Channels.CountersGetState),
    rpc.invoke(Channels.AutoRepliesGetState),
    rpc.invoke(Channels.SequencesGetState),
  ]);
  await useKeybindStore.getState().load();
  useCounterStore.getState().hydrate(counters);
  useAutoReplyStore.getState().hydrate(rules);
  useSequenceStore.getState().hydrate(sequences);
  // The previous profile's edits must not be undoable into this one
  undoManager.arm();
}

/** Anything still waiting to be saved belongs to the profile being left: write it before the host swaps the set. */
async function flushPendingEdits(): Promise<void> {
  flushPendingAutoReplies();
  try { await useCounterStore.getState().flushPending(); } catch { void 0; }
}

let reloading: Promise<void> | null = null;

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  profiles: [],
  activeId: '',
  starterSeeded: false,
  loaded: false,
  busy: false,
  loadedActiveId: '',

  load: async () => {
    const state = await rpc.invoke(Channels.ProfilesGetState);
    set({ profiles: state.profiles, activeId: state.activeId, starterSeeded: state.starterSeeded, loaded: true, loadedActiveId: get().loadedActiveId || state.activeId });
  },

  applyState: async (state) => {
    set({ profiles: state.profiles, activeId: state.activeId, starterSeeded: state.starterSeeded, loaded: true });
    if (state.activeId !== get().loadedActiveId) {
      set({ loadedActiveId: state.activeId });
      reloading = reloadCommandStores().finally(() => { reloading = null; });
    }
    // The host event and the reply to the request both land here: whichever comes second waits for the same reload
    if (reloading) await reloading;
  },

  switchTo: async (id) => {
    if (get().busy || id === get().activeId) return false;
    set({ busy: true });
    try {
      await flushPendingEdits();
      const res = await rpc.invoke(Channels.ProfilesSwitch, { id });
      await get().applyState(res.state);
      return res.ok;
    } catch {
      return false;
    } finally {
      set({ busy: false });
    }
  },

  add: async (name) => {
    const res = await rpc.invoke(Channels.ProfilesAdd, { name });
    await get().applyState(res.state);
    return res.ok ? res.id ?? null : null;
  },

  duplicate: async (id, name) => {
    await flushPendingEdits();
    const res = await rpc.invoke(Channels.ProfilesDuplicate, { id, name });
    await get().applyState(res.state);
    return res.ok ? res.id ?? null : null;
  },

  rename: async (id, name) => {
    const res = await rpc.invoke(Channels.ProfilesRename, { id, name });
    await get().applyState(res.state);
    return res.ok;
  },

  remove: async (id) => {
    const res = await rpc.invoke(Channels.ProfilesDelete, { id });
    await get().applyState(res.state);
    return res.ok;
  },

  ensureStarter: async () => {
    try {
      await get().load();
      if (get().starterSeeded) return;
      const language = useSettingsStore.getState().language === 'ar' ? 'ar' : 'en';
      const res = await rpc.invoke(Channels.ProfilesSeedStarter, buildStarterProfile(language));
      await get().applyState(res.state);
    } catch {
      // Starter is tried again on the next start
    }
  },
}));
