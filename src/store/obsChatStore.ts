import { create } from 'zustand';
import type { ChatClearScope, ChatMessage } from '../rpc/contracts.ts';
import { Channels } from '../rpc/contracts.ts';

export type ObsChatFontFamily = 'barlow' | 'cairo' | 'cinzel' | 'jetbrains-mono' | 'system' | 'custom';

export interface ObsChatDockSettings {
  fontSize: number;
  nameFontSize: number;
  textFontSize: number;
  fontFamily: ObsChatFontFamily;
  customFontName: string;
  customFontUrl: string;
  density: 'compact' | 'comfortable';
  showTimestamps: boolean;
  showBadges: boolean;
  showAvatars: boolean;
  highlightMentions: boolean;
  soundOnMention: boolean;
}

export interface ObsChatMessage extends ChatMessage {
  deleted?: boolean;
}

const STORAGE_KEY = 'streamer-hub-obs-chat-settings';

export const DEFAULT_DOCK_SETTINGS: ObsChatDockSettings = {
  fontSize: 13,
  nameFontSize: 13,
  textFontSize: 13,
  fontFamily: 'system',
  customFontName: '',
  customFontUrl: '',
  density: 'comfortable',
  showTimestamps: true,
  showBadges: true,
  showAvatars: true,
  highlightMentions: true,
  soundOnMention: false,
};

export function loadSavedDockSettings(): ObsChatDockSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_DOCK_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DOCK_SETTINGS;
    const parsed = JSON.parse(raw);
    const fallbackSize = typeof parsed.fontSize === 'number' && parsed.fontSize >= 9 && parsed.fontSize <= 48
      ? parsed.fontSize
      : 13;
    return {
      ...DEFAULT_DOCK_SETTINGS,
      ...parsed,
      fontSize: fallbackSize,
      nameFontSize: typeof parsed.nameFontSize === 'number' ? parsed.nameFontSize : fallbackSize,
      textFontSize: typeof parsed.textFontSize === 'number' ? parsed.textFontSize : fallbackSize,
      fontFamily: parsed.fontFamily || 'system',
      customFontName: typeof parsed.customFontName === 'string' ? parsed.customFontName : '',
      customFontUrl: typeof parsed.customFontUrl === 'string' ? parsed.customFontUrl : '',
      showBadges: typeof parsed.showBadges === 'boolean' ? parsed.showBadges : true,
      showAvatars: typeof parsed.showAvatars === 'boolean' ? parsed.showAvatars : true,
    };
  } catch {
    return DEFAULT_DOCK_SETTINGS;
  }
}

export interface ObsChatStoreDeps {
  sendChat: (message: string) => Promise<{ ok: boolean; error?: string }>;
  timeoutUser: (target: string, durationSeconds: number, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  banUser: (target: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ ok: boolean; error?: string }>;
  shoutoutUser: (target: string) => Promise<{ ok: boolean; error?: string }>;
  getDockUrl?: () => Promise<{ url: string; dockUrl?: string }>;
  saveSettings?: (settings: ObsChatDockSettings) => Promise<{ ok: boolean }>;
}

export const defaultDeps: ObsChatStoreDeps = {
  sendChat: async (message) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.TwitchSendChatMessage, { message });
      return { ok: res.ok, error: res.error };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  timeoutUser: async (target, durationSeconds, reason) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.TwitchModerationTimeout, { target, durationSeconds, reason });
      return { ok: res.ok, error: res.error };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  banUser: async (target, reason) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.TwitchModerationBan, { target, reason });
      return { ok: res.ok, error: res.error };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.TwitchModerationDeleteMessage, { messageId });
      return { ok: res.ok, error: res.error };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  shoutoutUser: async (target) => {
    try {
      const { rpc } = await import('../rpc');
      const res = await rpc.invoke(Channels.TwitchModerationShoutout, { target });
      return { ok: res.ok, error: res.error };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  getDockUrl: async () => {
    try {
      const { rpc } = await import('../rpc');
      return await rpc.invoke(Channels.ChatOverlayGetUrl);
    } catch {
      return { url: 'http://127.0.0.1:49178/chat-overlay.html', dockUrl: 'http://127.0.0.1:49178/obs-chat.html' };
    }
  },
  saveSettings: async (settings) => {
    try {
      const { rpc } = await import('../rpc');
      const { DEFAULT_CHAT_OVERLAY_SETTINGS } = await import('../lib/chatOverlay');
      await rpc.invoke(Channels.ObsChatSaveSettings, {
        ...DEFAULT_CHAT_OVERLAY_SETTINGS,
        avatar: {
          ...DEFAULT_CHAT_OVERLAY_SETTINGS.avatar,
          show: settings.showAvatars,
          size: 16,
        },
        badges: {
          ...DEFAULT_CHAT_OVERLAY_SETTINGS.badges,
          show: settings.showBadges,
          size: 12,
        },
        username: {
          ...DEFAULT_CHAT_OVERLAY_SETTINGS.username,
          show: true,
          size: settings.nameFontSize,
          font: {
            family: settings.fontFamily,
            customName: settings.customFontName,
          },
        },
        text: {
          ...DEFAULT_CHAT_OVERLAY_SETTINGS.text,
          size: settings.textFontSize,
          font: {
            family: settings.fontFamily,
            customName: settings.customFontName,
          },
        },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
};

export interface ObsChatState {
  messages: ObsChatMessage[];
  dockSettings: ObsChatDockSettings;
  dockUrl: string;
  maxMessages: number;
  addMessage: (msg: ChatMessage) => void;
  applyProfile: (userId: string, avatarUrl?: string | null, color?: string | null) => void;
  clearByScope: (scope: ChatClearScope, id?: string | null) => void;
  clearAll: () => void;
  updateSettings: (patch: Partial<ObsChatDockSettings>) => void;
  setDockUrl: (url: string) => void;
  sendMessage: (text: string) => Promise<{ ok: boolean; error?: string }>;
  timeoutUser: (target: string, durationSeconds?: number, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  banUser: (target: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ ok: boolean; error?: string }>;
  shoutoutUser: (target: string) => Promise<{ ok: boolean; error?: string }>;
}

export function createObsChatStore(deps: ObsChatStoreDeps = defaultDeps) {
  return create<ObsChatState>((set, get) => ({
    messages: [],
    dockSettings: loadSavedDockSettings(),
    dockUrl: 'http://127.0.0.1:49178/obs-chat.html',
    maxMessages: 250,

    addMessage: (msg) => {
      set((state) => {
        const item: ObsChatMessage = {
          ...msg,
          id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: msg.timestamp || new Date().toISOString(),
        };
        if (state.messages.some((m) => m.id === item.id)) {
          return state;
        }

        const isSelfItem = Boolean(item.isSelf || item.id.startsWith('self-'));
        let recentDuplicateIndex = -1;
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          const isSelfM = Boolean(m.isSelf || m.id.startsWith('self-'));
          if (!isSelfItem && !isSelfM) continue;
          const sameUser =
            (m.userId && item.userId && m.userId.toLowerCase() === item.userId.toLowerCase()) ||
            m.username.toLowerCase() === item.username.toLowerCase();
          const sameText = m.message.trim() === item.message.trim();
          if (!sameUser || !sameText) continue;
          const mTime = new Date(m.timestamp).getTime();
          const itemTime = new Date(item.timestamp).getTime();
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
            updated[recentDuplicateIndex] = { ...existing, ...item, isSelf: true };
            return { messages: updated };
          }
          return state;
        }

        const next = [...state.messages, item];
        if (next.length > state.maxMessages) {
          next.splice(0, next.length - state.maxMessages);
        }
        return { messages: next };
      });
    },

    applyProfile: (userId, avatarUrl, color) => {
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.userId === userId || m.username.toLowerCase() === userId.toLowerCase()) {
            return {
              ...m,
              avatarUrl: avatarUrl || m.avatarUrl,
              color: color || m.color,
            };
          }
          return m;
        }),
      }));
    },

    clearByScope: (scope, id) => {
      set((state) => {
        const normalized = (scope || '').toLowerCase();
        if (normalized === 'all' || !id) {
          return { messages: [] };
        }
        if (normalized === 'user') {
          return {
            messages: state.messages.map((m) =>
              m.userId === id || m.username.toLowerCase() === id.toLowerCase()
                ? { ...m, deleted: true }
                : m,
            ),
          };
        }
        return {
          messages: state.messages.map((m) => (m.id === id ? { ...m, deleted: true } : m)),
        };
      });
    },

    clearAll: () => set({ messages: [] }),

    updateSettings: (patch) => {
      set((state) => {
        const next = { ...state.dockSettings, ...patch };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // ignore
        }
        deps.saveSettings?.(next).catch(() => {});
        return { dockSettings: next };
      });
    },

    setDockUrl: (dockUrl) => set({ dockUrl }),

    sendMessage: async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, error: 'Message cannot be empty' };
      return deps.sendChat(trimmed);
    },

    timeoutUser: async (target, durationSeconds = 60, reason) => {
      const trimmed = target.replace(/^@+/, '').trim();
      if (!trimmed) return { ok: false, error: 'Username required' };
      const res = await deps.timeoutUser(trimmed, durationSeconds, reason);
      if (res.ok) {
        get().clearByScope('user', trimmed);
      }
      return res;
    },

    banUser: async (target, reason) => {
      const trimmed = target.replace(/^@+/, '').trim();
      if (!trimmed) return { ok: false, error: 'Username required' };
      const res = await deps.banUser(trimmed, reason);
      if (res.ok) {
        get().clearByScope('user', trimmed);
      }
      return res;
    },

    deleteMessage: async (messageId) => {
      get().clearByScope('message', messageId);
      return deps.deleteMessage(messageId);
    },

    shoutoutUser: async (target) => {
      const trimmed = target.replace(/^@+/, '').trim();
      if (!trimmed) return { ok: false, error: 'Username required' };
      return deps.shoutoutUser(trimmed);
    },
  }));
}

export const useObsChatStore = createObsChatStore();
