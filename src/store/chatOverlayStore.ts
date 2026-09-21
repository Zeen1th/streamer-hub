import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ChatMessage, ChatOverlayInstance, ChatOverlaySettings } from '../rpc/contracts.ts';
import { Channels } from '../rpc/contracts.ts';
import {
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from '../lib/chatOverlay.ts';
import { applyChatFilters } from '../lib/chatOverlayFilters.ts';

/**
 * Settings are nested, so a shallow spread would wipe sibling fields whenever a
 * caller patches one property of a group. Arrays are replaced wholesale, which
 * is what the filter lists want.
 */
function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return (patch === undefined ? base : patch) as T;
  }
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = deepMerge((base as Record<string, unknown>)[key], value);
  }
  return out as T;
}

export type ServerState = 'connected' | 'reconnecting' | 'unavailable' | 'idle';
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface OverlayMessage extends NormalizedChatOverlayMessage {
  receivedAt: number;
  timerId?: number;
}

export interface ChatOverlayState {
  settings: ChatOverlaySettings;
  overlays: ChatOverlayInstance[];
  activeOverlayId: string;
  copiedSettings: ChatOverlaySettings | null;
  messages: OverlayMessage[];
  overlayUrl: string;
  serverState: ServerState;
  loadState: LoadState;
  saveState: SaveState;
  obsPreviewEnabled: boolean;
  hydrate(settings: Partial<ChatOverlaySettings>, overlayUrl?: string): void;
  setCoreConnected(connected: boolean): void;
  addMessage(message: Partial<ChatMessage>): void;
  removeMessage(id: string): void;
  clearMessages(): void;
  /** Patches a resolved avatar onto messages already on screen. */
  applyProfile(userId: string, avatarUrl: string, color?: string): void;
  /** Moderation: remove one message, every message from a user, or all. */
  clearByScope(scope: 'message' | 'user' | 'all', id?: string): void;
  updateSettings(patch: DeepPartial<ChatOverlaySettings>): Promise<void>;
  saveNow(): Promise<boolean>;
  load(): Promise<void>;
  setObsPreviewEnabled(
    enabled: boolean,
    sampleMessages?: readonly (NormalizedChatOverlayMessage | ChatMessage)[],
  ): Promise<void>;
  reloadObs(): Promise<boolean>;
  setActiveOverlay(id: string): Promise<void>;
  createOverlay(name: string, templateSettings?: ChatOverlaySettings): Promise<string>;
  duplicateOverlay(id: string, newName?: string): Promise<string>;
  renameOverlay(id: string, newName: string): Promise<boolean>;
  deleteOverlay(id: string): Promise<boolean>;
  copySettings(settings?: ChatOverlaySettings): void;
  pasteSettings(): Promise<boolean>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

export interface ChatOverlayStoreDeps {
  loadSettings: () => Promise<ChatOverlaySettings>;
  saveSettings: (settings: ChatOverlaySettings) => Promise<boolean>;
  getOverlayUrl: (overlayId?: string) => Promise<string>;
  loadOverlays?: () => Promise<ChatOverlayInstance[]>;
  saveOverlay?: (overlay: ChatOverlayInstance) => Promise<boolean>;
  deleteOverlay?: (id: string) => Promise<boolean>;
  setPreview?: (
    enabled: boolean,
    sampleMessages?: readonly (NormalizedChatOverlayMessage | ChatMessage)[],
    overlayId?: string,
  ) => Promise<void>;
  reloadObs?: (overlayId?: string) => Promise<boolean>;
  schedule: (callback: () => void, ms: number) => number;
  cancel: (id: number) => void;
}

export const defaultOverlayDeps: ChatOverlayStoreDeps = {
  loadSettings: async () => {
    const { rpc } = await import('../rpc');
    return await rpc.invoke(Channels.ChatOverlayGetState);
  },
  saveSettings: async (settings: ChatOverlaySettings) => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ChatOverlaySaveSettings, settings);
    return res.ok;
  },
  getOverlayUrl: async (overlayId?: string) => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ChatOverlayGetUrl, { overlayId });
    return res.url;
  },
  loadOverlays: async () => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.ChatOverlaysList);
      return res.overlays;
    } catch {
      return [];
    }
  },
  saveOverlay: async (overlay: ChatOverlayInstance) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.ChatOverlaysSave, { overlay });
      return res.ok;
    } catch {
      return false;
    }
  },
  deleteOverlay: async (id: string) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.ChatOverlaysDelete, { id });
      return res.ok;
    } catch {
      return false;
    }
  },
  setPreview: async (enabled, sampleMessages, overlayId) => {
    const { rpc } = await import('../rpc');
    await rpc.invoke(Channels.ChatOverlaySetPreview, {
      enabled,
      overlayId,
      messages: enabled && sampleMessages ? (sampleMessages as ChatMessage[]) : undefined,
    });
  },
  reloadObs: async (overlayId) => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ChatOverlayReload, { overlayId });
    return Boolean(res.ok);
  },
  schedule: (cb, ms) => {
    if (typeof window !== 'undefined') {
      return window.setTimeout(cb, ms);
    }
    return setTimeout(cb, ms) as unknown as number;
  },
  cancel: (id) => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(id);
    } else {
      clearTimeout(id);
    }
  },
};

export const defaultObsChatDeps: ChatOverlayStoreDeps = {
  loadSettings: async () => {
    const { rpc } = await import('../rpc');
    return await rpc.invoke(Channels.ObsChatGetState);
  },
  saveSettings: async (settings: ChatOverlaySettings) => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ObsChatSaveSettings, settings);
    return res.ok;
  },
  getOverlayUrl: async () => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ObsChatGetUrl);
    return res.url;
  },
  setPreview: async (enabled, sampleMessages) => {
    const { rpc } = await import('../rpc');
    await rpc.invoke(Channels.ObsChatSetPreview, {
      enabled,
      messages: enabled && sampleMessages ? (sampleMessages as ChatMessage[]) : undefined,
    });
  },
  reloadObs: async () => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ObsChatReload);
    return Boolean(res.ok);
  },
  schedule: (cb, ms) => {
    if (typeof window !== 'undefined') {
      return window.setTimeout(cb, ms);
    }
    return setTimeout(cb, ms) as unknown as number;
  },
  cancel: (id) => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(id);
    } else {
      clearTimeout(id);
    }
  },
};

export function selectVisibleChatMessages(state: { settings: ChatOverlaySettings; messages: OverlayMessage[] }): OverlayMessage[] {
  if (state.settings.flow.displayMode === 'latest') {
    return state.messages.slice(-1);
  }
  return state.messages.slice(-state.settings.flow.maxMessages);
}

export function createChatOverlayStore(
  customDeps?: Partial<ChatOverlayStoreDeps>,
): UseBoundStore<StoreApi<ChatOverlayState>> {
  const deps: ChatOverlayStoreDeps = { ...defaultOverlayDeps, ...customDeps };

  let activeSave: Promise<boolean> | null = null;
  let queuedSettings: ChatOverlaySettings | null = null;

  return create<ChatOverlayState>((set, get) => {
    const flushSave = async (settingsToSave: ChatOverlaySettings): Promise<boolean> => {
      queuedSettings = settingsToSave;
      if (activeSave) {
        return activeSave;
      }

      set({ saveState: 'saving' });
      let lastResult = false;
      while (queuedSettings !== null) {
        const nextBatch = queuedSettings;
        queuedSettings = null;
        try {
          activeSave = deps.saveSettings(nextBatch);
          lastResult = await activeSave;
        } catch {
          lastResult = false;
        } finally {
          activeSave = null;
        }
      }
      set({ saveState: lastResult ? 'saved' : 'error' });
      return lastResult;
    };

    return {
      settings: DEFAULT_CHAT_OVERLAY_SETTINGS,
      overlays: [
        {
          id: 'default',
          name: 'Main Overlay',
          isMain: true,
          settings: DEFAULT_CHAT_OVERLAY_SETTINGS,
        },
      ],
      activeOverlayId: 'default',
      copiedSettings: null,
      messages: [],
      overlayUrl: '',
      serverState: 'idle',
      loadState: 'idle',
      saveState: 'idle',
      obsPreviewEnabled: false,

    hydrate: (settings, overlayUrl) => {
      const normalized = normalizeChatOverlaySettings(settings);
      set({
        settings: normalized,
        overlayUrl: overlayUrl !== undefined ? overlayUrl : get().overlayUrl,
        loadState: 'ready',
        serverState: 'connected',
      });
    },

    setCoreConnected: (connected) => {
      set({
        serverState: connected ? 'connected' : 'reconnecting',
      });
    },

    addMessage: (rawMessage) => {
      const state = get();
      if (!rawMessage) return;

      // Filtering is applied here so the in-app preview and the OBS overlay
      // always agree on what is visible.
      const verdict = applyChatFilters(
        { username: rawMessage.username ?? '', message: rawMessage.message ?? '' },
        state.settings.filters,
      );
      if (!verdict.visible) return;

      const normalized = normalizeChatOverlayMessage({ ...rawMessage, message: verdict.message });
      if (state.messages.some((m) => m.id === normalized.id)) {
        return;
      }

      const isSelfItem = Boolean(normalized.isSelf || normalized.id.startsWith('self-'));
      let recentDuplicateIndex = -1;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i];
        const isSelfM = Boolean(m.isSelf || m.id.startsWith('self-'));
        if (!isSelfItem && !isSelfM) continue;
        const sameUser =
          (m.userId && normalized.userId && m.userId.toLowerCase() === normalized.userId.toLowerCase()) ||
          m.username.toLowerCase() === normalized.username.toLowerCase();
        const sameText = m.message.trim() === normalized.message.trim();
        if (!sameUser || !sameText) continue;
        const mTime = new Date(m.timestamp).getTime();
        const itemTime = new Date(normalized.timestamp).getTime();
        const withinWindow = Number.isFinite(mTime) && Number.isFinite(itemTime) ? Math.abs(itemTime - mTime) < 15000 : true;
        if (withinWindow) {
          recentDuplicateIndex = i;
          break;
        }
      }

      if (recentDuplicateIndex >= 0) {
        const existing = state.messages[recentDuplicateIndex];
        const existingIsSelf = Boolean(existing.isSelf || existing.id.startsWith('self-'));
        if (existingIsSelf && !isSelfItem) {
          const updated = [...state.messages];
          updated[recentDuplicateIndex] = { ...existing, ...normalized, isSelf: true };
          set({ messages: updated });
        }
        return;
      }

      // A duration of 0 means messages never expire, so no timer is scheduled.
      const duration = state.settings.flow.durationSeconds;
      const timerId =
        duration > 0
          ? deps.schedule(() => {
              get().removeMessage(normalized.id);
            }, duration * 1000)
          : undefined;

      const overlayMessage: OverlayMessage = {
        ...normalized,
        receivedAt: Date.now(),
        timerId,
      };

      const nextMessages = [...state.messages, overlayMessage];
      const maxLimit = state.settings.flow.maxMessages;
      const trimmed = nextMessages.length > maxLimit ? nextMessages.slice(-maxLimit) : nextMessages;

      // Cancel timers of trimmed messages that were dropped from the front
      const droppedCount = nextMessages.length - trimmed.length;
      if (droppedCount > 0) {
        for (let i = 0; i < droppedCount; i++) {
          const dropped = nextMessages[i];
          if (dropped.timerId !== undefined) {
            deps.cancel(dropped.timerId);
          }
        }
      }

      set({ messages: trimmed });
    },

    removeMessage: (id) => {
      set((state) => {
        const target = state.messages.find((m) => m.id === id);
        if (target?.timerId !== undefined) {
          deps.cancel(target.timerId);
        }
        return {
          messages: state.messages.filter((m) => m.id !== id),
        };
      });
    },

    clearMessages: () => {
      const state = get();
      for (const m of state.messages) {
        if (m.timerId !== undefined) {
          deps.cancel(m.timerId);
        }
      }
      set({ messages: [] });
    },

    applyProfile: (userId, avatarUrl, color) => {
      if (!userId) return;
      const targetId = userId.toLowerCase();
      set((state) => {
        let changed = false;
        const messages = state.messages.map((message) => {
          const match =
            message.userId === userId ||
            (Boolean(message.username) && message.username.toLowerCase() === targetId) ||
            (Boolean(message.userLogin) && message.userLogin!.toLowerCase() === targetId) ||
            (Boolean(message.displayName) && message.displayName!.toLowerCase() === targetId);
          if (!match) return message;
          const nextAvatar = avatarUrl || message.avatarUrl;
          const nextColor = color || message.color;
          if (nextAvatar === message.avatarUrl && nextColor === message.color) return message;
          changed = true;
          return { ...message, avatarUrl: nextAvatar, color: nextColor };
        });
        return changed ? { messages } : {};
      });
    },

    clearByScope: (scope, id) => {
      const state = get();
      const doomed = state.messages.filter((m) => {
        if (scope === 'all') return true;
        if (scope === 'user') {
          if (!id) return false;
          const targetId = id.toLowerCase();
          return (
            m.userId === id ||
            (Boolean(m.username) && m.username.toLowerCase() === targetId) ||
            (Boolean(m.userLogin) && m.userLogin!.toLowerCase() === targetId) ||
            (Boolean(m.displayName) && m.displayName!.toLowerCase() === targetId)
          );
        }
        return m.id === id;
      });
      for (const message of doomed) {
        if (message.timerId !== undefined) deps.cancel(message.timerId);
      }
      const doomedIds = new Set(doomed.map((m) => m.id));
      set({ messages: state.messages.filter((m) => !doomedIds.has(m.id)) });
    },

    updateSettings: async (patch) => {
      const current = get().settings;
      const normalized = normalizeChatOverlaySettings(deepMerge(current, patch));
      const activeId = get().activeOverlayId || 'default';
      const nextOverlays = get().overlays.map((o) =>
        o.id === activeId ? { ...o, settings: normalized } : o,
      );
      set({ settings: normalized, overlays: nextOverlays });
      const currentOverlay = nextOverlays.find((o) => o.id === activeId);
      if (activeId !== 'default' && currentOverlay && deps.saveOverlay) {
        deps.saveOverlay(currentOverlay).catch(() => {});
      }
      await flushSave(normalized);
    },

    saveNow: async () => {
      const activeId = get().activeOverlayId || 'default';
      const currentOverlay = get().overlays.find((o) => o.id === activeId);
      if (activeId !== 'default' && currentOverlay && deps.saveOverlay) {
        deps.saveOverlay(currentOverlay).catch(() => {});
      }
      return await flushSave(get().settings);
    },

    load: async () => {
      set({ loadState: 'loading' });
      try {
        let overlaysList: ChatOverlayInstance[] = [];
        if (deps.loadOverlays) {
          try {
            overlaysList = await deps.loadOverlays();
          } catch {
            // ignore
          }
        }
        if (!overlaysList || overlaysList.length === 0) {
          const defaultSettings = await deps.loadSettings();
          overlaysList = [
            {
              id: 'default',
              name: 'Main Overlay',
              isMain: true,
              settings: defaultSettings,
            },
          ];
        }

        const activeId = get().activeOverlayId || 'default';
        const active = overlaysList.find((o) => o.id === activeId) || overlaysList[0];
        const overlayUrl = await deps.getOverlayUrl(active.id);
        const normalized = normalizeChatOverlaySettings(active.settings);

        set({
          overlays: overlaysList,
          activeOverlayId: active.id,
          settings: normalized,
          overlayUrl,
          loadState: 'ready',
          serverState: 'connected',
        });
      } catch {
        set({
          loadState: 'error',
          serverState: 'unavailable',
          overlayUrl: '',
        });
      }
    },

    setObsPreviewEnabled: async (enabled, sampleMessages) => {
      set({ obsPreviewEnabled: enabled });
      try {
        const activeId = get().activeOverlayId || 'default';
        if (deps.setPreview) {
          await deps.setPreview(enabled, sampleMessages, activeId);
        } else {
          const { rpc } = await import('../rpc');
          await rpc.invoke(Channels.ChatOverlaySetPreview, {
            enabled,
            overlayId: activeId,
            messages: enabled && sampleMessages ? (sampleMessages as ChatMessage[]) : undefined,
          });
        }
      } catch {
        // ignore
      }
    },

    reloadObs: async () => {
      try {
        const activeId = get().activeOverlayId || 'default';
        if (deps.reloadObs) {
          return await deps.reloadObs(activeId);
        }
        const { rpc } = await import('../rpc');
        const res = await rpc.invoke(Channels.ChatOverlayReload, { overlayId: activeId });
        return Boolean(res.ok);
      } catch {
        return false;
      }
    },

    setActiveOverlay: async (id: string) => {
      const target = get().overlays.find((o) => o.id === id);
      if (!target) return;
      const url = await deps.getOverlayUrl(id);
      set({
        activeOverlayId: id,
        settings: normalizeChatOverlaySettings(target.settings),
        overlayUrl: url,
      });
    },

    createOverlay: async (name: string, templateSettings?: ChatOverlaySettings) => {
      const id = `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const baseSettings = templateSettings ?? get().settings;
      const initialSettings = normalizeChatOverlaySettings(baseSettings);
      const newOverlay: ChatOverlayInstance = {
        id,
        name: name.trim() || 'New Overlay',
        isMain: false,
        settings: initialSettings,
      };
      const nextOverlays = [...get().overlays, newOverlay];
      set({ overlays: nextOverlays });
      try {
        await deps.saveOverlay?.(newOverlay);
      } catch {
        // ignore
      }
      await get().setActiveOverlay(id);
      return id;
    },

    duplicateOverlay: async (id: string, newName?: string) => {
      const target = get().overlays.find((o) => o.id === id) || get().overlays[0];
      const name = newName || `${target.name} (Copy)`;
      return await get().createOverlay(name, target.settings);
    },

    renameOverlay: async (id: string, newName: string) => {
      const target = get().overlays.find((o) => o.id === id);
      if (!target || !newName.trim()) return false;
      const updated: ChatOverlayInstance = { ...target, name: newName.trim() };
      const nextOverlays = get().overlays.map((o) => (o.id === id ? updated : o));
      set({ overlays: nextOverlays });
      try {
        await deps.saveOverlay?.(updated);
        return true;
      } catch {
        return false;
      }
    },

    deleteOverlay: async (id: string) => {
      if (id === 'default') return false;
      const target = get().overlays.find((o) => o.id === id);
      if (!target || target.isMain) return false;
      const nextOverlays = get().overlays.filter((o) => o.id !== id);
      set({ overlays: nextOverlays });
      if (get().activeOverlayId === id) {
        await get().setActiveOverlay('default');
      }
      try {
        await deps.deleteOverlay?.(id);
        return true;
      } catch {
        return false;
      }
    },

    copySettings: (settingsToCopy?: ChatOverlaySettings) => {
      const toCopy = settingsToCopy || get().settings;
      const cloned = structuredClone(toCopy);
      set({ copiedSettings: cloned });
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          void navigator.clipboard.writeText(JSON.stringify(cloned, null, 2));
        }
      } catch {
        // ignore
      }
    },

    pasteSettings: async () => {
      let toPaste = get().copiedSettings;
      if (!toPaste) {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            const text = await navigator.clipboard.readText();
            if (text) {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === 'object') {
                toPaste = parsed;
              }
            }
          }
        } catch {
          // ignore
        }
      }
      if (!toPaste) return false;
      await get().updateSettings(toPaste);
      return true;
    },
  };
});
}

export const useChatOverlayStore = createChatOverlayStore(defaultOverlayDeps);
export const useObsChatOverlayStore = createChatOverlayStore(defaultObsChatDeps);

