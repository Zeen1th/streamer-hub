import { create } from 'zustand';
import { isMockMode, rpc } from '../rpc';
import { Channels, type UpdateState } from '../rpc/contracts';
import { createDebugUpdateState } from '../lib/updateDebug';
import { AUTO_UPDATE_COUNTDOWN_SECONDS, decideAutoUpdate } from '../lib/autoUpdate';

const AUTO_UPDATE_KEY = 'streamer-hub-auto-update';
const ATTEMPT_KEY = 'streamer-hub-auto-update-attempt';

function loadAutoUpdate(): boolean {
  try {
    return localStorage.getItem(AUTO_UPDATE_KEY) !== '0';
  } catch {
    return true;
  }
}

function readAttempt(): { version: string; at: number } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? 'null');
    return parsed && typeof parsed.version === 'string' && typeof parsed.at === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function writeAttempt(version: string) {
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ version, at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

interface UpdateStore extends UpdateState {
  checked: boolean;
  installing: boolean;
  check: () => Promise<UpdateState | null>;
  install: () => Promise<boolean>;
  debugPromptRequested: boolean;
  simulateUpdate: () => Promise<boolean>;
  clearDebugPrompt: () => void;

  /** Install updates automatically (default on). */
  autoUpdate: boolean;
  setAutoUpdate: (enabled: boolean) => void;
  /** An auto-install is about to start; the toast counts down to `deadline`. */
  pendingAutoInstall: { version: string; deadline: number } | null;
  /** An update was found mid-session and will install on the next launch. */
  deferredVersion: string | null;
  declinedVersion: string | null;
  autoInstallError: string | null;
  runAutoCheck: (trigger: 'startup' | 'periodic') => Promise<void>;
  confirmAutoInstall: () => Promise<void>;
  cancelAutoInstall: () => void;
  dismissDeferred: () => void;

  /** The "What's new" window (opened automatically after an update, or from Settings). */
  whatsNewOpen: boolean;
  openWhatsNew: () => void;
  closeWhatsNew: () => void;
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
  autoUpdate: loadAutoUpdate(),
  pendingAutoInstall: null,
  deferredVersion: null,
  declinedVersion: null,
  autoInstallError: null,
  whatsNewOpen: false,
  openWhatsNew: () => set({ whatsNewOpen: true }),
  closeWhatsNew: () => set({ whatsNewOpen: false }),
  setAutoUpdate: (autoUpdate) => {
    try {
      localStorage.setItem(AUTO_UPDATE_KEY, autoUpdate ? '1' : '0');
    } catch {
      // storage unavailable
    }
    set({ autoUpdate, ...(autoUpdate ? {} : { pendingAutoInstall: null, deferredVersion: null }) });
  },
  runAutoCheck: async (trigger) => {
    if (isMockMode || get().installing || get().pendingAutoInstall) return;
    const result = await get().check();
    if (!result) return;
    const decision = decideAutoUpdate({
      enabled: get().autoUpdate,
      updateAvailable: result.updateAvailable,
      downloadUrl: result.downloadUrl,
      latestVersion: result.latestVersion,
      trigger,
      lastAttempt: readAttempt(),
      declinedVersion: get().declinedVersion,
      now: Date.now(),
    });
    if (decision === 'install_soon') {
      set({ pendingAutoInstall: { version: result.latestVersion, deadline: Date.now() + AUTO_UPDATE_COUNTDOWN_SECONDS * 1000 } });
    } else if (decision === 'defer') {
      set({ deferredVersion: result.latestVersion });
    }
  },
  confirmAutoInstall: async () => {
    const pending = get().pendingAutoInstall;
    if (!pending) return;
    set({ pendingAutoInstall: null, autoInstallError: null });
    // Recorded before installing: a failed installer restarts the old app, and without this it would try again forever
    writeAttempt(pending.version);
    const ok = await get().install();
    if (!ok) set({ autoInstallError: pending.version });
  },
  cancelAutoInstall: () => {
    const pending = get().pendingAutoInstall;
    set({ pendingAutoInstall: null, declinedVersion: pending?.version ?? get().declinedVersion });
  },
  dismissDeferred: () => set({ deferredVersion: null }),
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
      const result = await rpc.invoke(Channels.UpdateInstall, { downloadUrl: state.downloadUrl }, 300_000);
      if (!result.ok) set({ installing: false });
      return result.ok;
    } catch {
      set({ installing: false });
      return false;
    }
  },
}));

