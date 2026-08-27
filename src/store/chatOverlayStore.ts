import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ChatMessage, ChatOverlaySettings } from '../rpc/contracts.ts';
import { Channels } from '../rpc/contracts.ts';
import {
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
  type NormalizedChatOverlayMessage,
} from '../lib/chatOverlay.ts';

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
  updateSettings(patch: Partial<ChatOverlaySettings>): Promise<void>;
  load(): Promise<void>;
}

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
  if (state.settings.displayMode === 'latest') {
    return state.messages.slice(-1);
  }
  return state.messages.slice(-state.settings.maxMessages);
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

      const normalized = normalizeChatOverlayMessage(rawMessage);
      if (state.messages.some((m) => m.id === normalized.id)) {
        return;
      }

      const timerId = deps.schedule(() => {
        get().removeMessage(normalized.id);
      }, state.settings.durationSeconds * 1000);

      const overlayMessage: OverlayMessage = {
        ...normalized,
        receivedAt: Date.now(),
        timerId,
      };

      const nextMessages = [...state.messages, overlayMessage];
      const maxLimit = state.settings.maxMessages;
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

    updateSettings: async (patch) => {
      const current = get().settings;
      const normalized = normalizeChatOverlaySettings({ ...current, ...patch });
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
