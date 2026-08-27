import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ChatMessage, ChatOverlaySettings } from '../rpc/contracts.ts';
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
  messages: OverlayMessage[];
  overlayUrl: string;
  serverState: ServerState;
  loadState: LoadState;
  saveState: SaveState;
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
  load(): Promise<void>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

export interface ChatOverlayStoreDeps {
  loadSettings: () => Promise<ChatOverlaySettings>;
  saveSettings: (settings: ChatOverlaySettings) => Promise<boolean>;
  getOverlayUrl: () => Promise<string>;
  schedule: (callback: () => void, ms: number) => number;
  cancel: (id: number) => void;
}

const defaultDeps: ChatOverlayStoreDeps = {
  loadSettings: async () => {
    const { rpc } = await import('../rpc');
    return await rpc.invoke(Channels.ChatOverlayGetState);
  },
  saveSettings: async (settings: ChatOverlaySettings) => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ChatOverlaySaveSettings, settings);
    return res.ok;
  },
  getOverlayUrl: async () => {
    const { rpc } = await import('../rpc');
    const res = await rpc.invoke(Channels.ChatOverlayGetUrl);
    return res.url;
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
  const deps: ChatOverlayStoreDeps = { ...defaultDeps, ...customDeps };

  return create<ChatOverlayState>((set, get) => ({
    settings: DEFAULT_CHAT_OVERLAY_SETTINGS,
    messages: [],
    overlayUrl: '',
    serverState: 'idle',
    loadState: 'idle',
    saveState: 'idle',

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
      set((state) => {
        let changed = false;
        const messages = state.messages.map((message) => {
          if (message.userId !== userId) return message;
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
        if (scope === 'user') return m.userId === id;
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
      set({ settings: normalized, saveState: 'saving' });

      try {
        const ok = await deps.saveSettings(normalized);
        set({ saveState: ok ? 'saved' : 'error' });
      } catch {
        set({ saveState: 'error' });
      }
    },

    load: async () => {
      set({ loadState: 'loading' });
      try {
        const [settings, overlayUrl] = await Promise.all([
          deps.loadSettings(),
          deps.getOverlayUrl(),
        ]);
        const normalized = normalizeChatOverlaySettings(settings);
        set({
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
  }));
}

export const useChatOverlayStore = createChatOverlayStore();
