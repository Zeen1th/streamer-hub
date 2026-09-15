import { create } from 'zustand';
import { rpc } from '../rpc';
import { Channels } from '../rpc/contracts';
import { chatterIdentifiersMatch, normalizeChatterIdentifier } from '../lib/chatterNormalization';
import { setChatterResolver } from '../lib/autoReplyRules';

export interface KnownChatter {
  userId: string;
  login: string;
  displayName: string;
  avatarUrl?: string;
  lastSeen?: number;
}

interface ChatterState {
  chatters: Record<string, KnownChatter>; // keyed by userId
  recordChatter: (info: {
    userId?: string | null;
    login?: string | null;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  }) => KnownChatter | null;
  findKnownChatter: (query: string) => KnownChatter | undefined;
  resolveChatter: (query: string) => Promise<KnownChatter | null>;
  getAllChatters: () => KnownChatter[];
}

const STORAGE_KEY = 'streamer-hub-known-chatters-v1';

function loadInitialChatters(): Record<string, KnownChatter> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persistChatters(chatters: Record<string, KnownChatter>) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatters));
  } catch {}
}

export const useChatterStore = create<ChatterState>((set, get) => ({
  chatters: loadInitialChatters(),

  recordChatter: (info) => {
    const rawId = info.userId?.trim();
    const rawLogin = (info.login || info.username || '').trim().replace(/^@+/, '');
    const rawDisplayName = (info.displayName || info.username || rawLogin).trim().replace(/^@+/, '');

    if (!rawId && !rawLogin && !rawDisplayName) return null;

    // Use userId as primary key if available, else login, else displayName
    const key = rawId || rawLogin.toLowerCase() || normalizeChatterIdentifier(rawDisplayName);
    const existing = get().chatters[key] || (rawId ? Object.values(get().chatters).find((c) => c.userId === rawId) : undefined);

    const record: KnownChatter = {
      userId: rawId || existing?.userId || '',
      login: rawLogin ? rawLogin.toLowerCase() : existing?.login || '',
      displayName: rawDisplayName || existing?.displayName || rawLogin,
      avatarUrl: info.avatarUrl || existing?.avatarUrl,
      lastSeen: Date.now(),
    };

    set((state) => {
      const next = { ...state.chatters, [record.userId || key]: record };
      // Also index by other unique keys if present
      if (record.userId && key !== record.userId) {
        next[record.userId] = record;
      }
      persistChatters(next);
      return { chatters: next };
    });

    return record;
  },

  findKnownChatter: (query: string) => {
    if (!query || !query.trim()) return undefined;
    const clean = query.trim().replace(/^@+/, '');
    const list = Object.values(get().chatters);

    // 1. Direct ID match
    const byId = list.find((c) => c.userId && c.userId === clean);
    if (byId) return byId;

    // 2. Direct login match
    const byLogin = list.find((c) => c.login && c.login.toLowerCase() === clean.toLowerCase());
    if (byLogin) return byLogin;

    // 3. Resilient identifier match (Arabic display name, casing, alef variants)
    return list.find(
      (c) =>
        chatterIdentifiersMatch(c.displayName, clean) ||
        chatterIdentifiersMatch(c.login, clean) ||
        chatterIdentifiersMatch(c.userId, clean),
    );
  },

  resolveChatter: async (query: string) => {
    if (!query || !query.trim()) return null;
    const clean = query.trim().replace(/^@+/, '');

    // 1. Check local cache first
    const existing = get().findKnownChatter(clean);
    if (existing && existing.userId) {
      return existing;
    }

    // 2. Query Helix via backend RPC
    try {
      const res = await rpc.invoke(Channels.TwitchCheckAvatar, { username: clean });
      if (res.ok && (res.userId || res.username || res.displayName)) {
        return get().recordChatter({
          userId: res.userId,
          login: res.username,
          displayName: res.displayName,
          avatarUrl: res.avatarUrl,
        });
      }
    } catch {}

    return existing ?? null;
  },

  getAllChatters: () => Object.values(get().chatters),
}));

setChatterResolver((query) => useChatterStore.getState().findKnownChatter(query));
