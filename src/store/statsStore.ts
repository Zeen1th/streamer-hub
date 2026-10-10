import { create } from 'zustand';
import { Events } from '../rpc/contracts';
import type {
  ChannelPointsRedemption,
  ChatMessage,
  TwitchFollowEvent,
  TwitchGiftEvent,
  TwitchRaidEvent,
  TwitchWatchStreakEvent,
} from '../rpc/contracts';
import { rpc } from '../rpc';
import {
  EMPTY_TOTALS,
  addFeedEvent,
  bumpUser,
  pruneUsers,
  recordMinute,
  type FeedEvent,
  type StreamTotals,
  type UserPatch,
  type UserStatsMap,
} from '../lib/stats';

const STORAGE_KEY = 'streamer-hub-stats-v1';
/** A session older than this when the app starts is treated as a previous stream and archived into all-time only. */
const STALE_SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_ALL_TIME_USERS = 2500;
const SAVE_DELAY_MS = 2000;

interface Persisted {
  allTime: UserStatsMap;
  session: SessionData;
  feed: FeedEvent[];
  minutes: Record<string, number>;
  giftIds: string[];
  lastActivity: number;
}

interface SessionData {
  startedAt: number;
  users: UserStatsMap;
  totals: StreamTotals;
}

interface StatsState {
  allTime: UserStatsMap;
  session: SessionData;
  feed: FeedEvent[];
  /** Messages per minute, keyed by minute since epoch. */
  minutes: Record<string, number>;
  /** Gift event ids already counted, so a replayed gift is never added twice. */
  giftIds: string[];
  /** Bumped on every change so selectors can re-run even though the maps are mutated in place. */
  rev: number;
  recordMessage(message: Pick<ChatMessage, 'username' | 'displayName' | 'userLogin'>): void;
  recordFollow(event: TwitchFollowEvent): void;
  recordRaid(event: TwitchRaidEvent): void;
  recordGift(event: TwitchGiftEvent): void;
  recordRedemption(event: ChannelPointsRedemption): void;
  recordWatchStreak(event: TwitchWatchStreakEvent): void;
  recordDuel(result: { winner: string; loser: string; kind: 'win' | 'no_winner' }): void;
  /** Starts a fresh "this stream" without touching all-time totals. */
  newStream(): void;
  /** Wipes everything: both leaderboards, the feed and the activity chart. */
  resetAll(): void;
}

const freshSession = (now: number): SessionData => ({ startedAt: now, users: {}, totals: { ...EMPTY_TOTALS } });

function load(now: number): Persisted {
  const fallback: Persisted = { allTime: {}, session: freshSession(now), feed: [], minutes: {}, giftIds: [], lastActivity: now };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const loaded: Persisted = {
      allTime: parsed.allTime && typeof parsed.allTime === 'object' ? parsed.allTime : {},
      session:
        parsed.session && typeof parsed.session === 'object' && parsed.session.users
          ? { startedAt: parsed.session.startedAt ?? now, users: parsed.session.users, totals: { ...EMPTY_TOTALS, ...(parsed.session.totals ?? {}) } }
          : freshSession(now),
      feed: Array.isArray(parsed.feed) ? parsed.feed : [],
      minutes: parsed.minutes && typeof parsed.minutes === 'object' ? parsed.minutes : {},
      giftIds: Array.isArray(parsed.giftIds) ? parsed.giftIds.filter((id): id is string => typeof id === 'string') : [],
      lastActivity: typeof parsed.lastActivity === 'number' ? parsed.lastActivity : now,
    };
    if (now - loaded.lastActivity > STALE_SESSION_MS) loaded.session = freshSession(now);
    return loaded;
  } catch {
    return fallback;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(read: () => StatsState) {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (typeof localStorage === 'undefined') return;
      const s = read();
      const data: Persisted = { allTime: s.allTime, session: s.session, feed: s.feed, minutes: s.minutes, giftIds: s.giftIds, lastActivity: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable: stats just stay in memory
    }
  }, SAVE_DELAY_MS);
}

const initial = load(Date.now());

export const useStatsStore = create<StatsState>((set, get) => {
  /** Applies one change to both the stream and all-time tallies, then notifies subscribers. */
  const apply = (
    login: string,
    name: string | undefined,
    patch: UserPatch,
    totals: Partial<StreamTotals>,
    feed?: Omit<FeedEvent, 'id'>,
  ) => {
    const now = Date.now();
    const s = get();
    if (login) {
      bumpUser(s.allTime, login, name, patch, now);
      bumpUser(s.session.users, login, name, patch, now);
      if (Object.keys(s.allTime).length > MAX_ALL_TIME_USERS + 200) pruneUsers(s.allTime, MAX_ALL_TIME_USERS);
    }
    for (const key of Object.keys(totals) as (keyof StreamTotals)[]) {
      s.session.totals[key] += totals[key] ?? 0;
    }
    set({ rev: s.rev + 1, ...(feed ? { feed: addFeedEvent(s.feed, feed) } : {}) });
    scheduleSave(get);
  };

  return {
    allTime: initial.allTime,
    session: initial.session,
    feed: initial.feed,
    minutes: initial.minutes,
    giftIds: initial.giftIds,
    rev: 0,

    recordMessage: (message) => {
      const login = message.userLogin || message.username;
      if (!login) return;
      const now = Date.now();
      recordMinute(get().minutes, now);
      apply(login, message.displayName || message.username, { messages: 1 }, { messages: 1 });
    },

    recordFollow: (event) => {
      apply(event.userLogin, event.userName, {}, { follows: 1 }, { kind: 'follow', at: Date.now(), who: event.userName || event.userLogin, detail: '' });
    },

    recordRaid: (event) => {
      apply('', undefined, {}, { raids: 1, raidViewers: event.viewers }, {
        kind: 'raid',
        at: Date.now(),
        who: event.fromUserName || event.fromUserLogin,
        detail: String(event.viewers),
      });
    },

    recordGift: (event) => {
      if (event.id && get().giftIds.includes(event.id)) return;
      if (event.id) set({ giftIds: [event.id, ...get().giftIds].slice(0, 300) });
      const count = Math.max(1, event.count || 1);
      const who = event.anonymous ? 'Anonymous' : event.gifterName || event.gifterLogin;
      apply(event.anonymous ? '' : event.gifterLogin, who, { gifts: count }, { gifts: count }, { kind: 'gift', at: Date.now(), who, detail: String(count) });
    },

    recordRedemption: (event) => {
      apply(
        event.userLogin,
        event.userName,
        { redemptions: 1, points: event.rewardCost ?? 0 },
        { redemptions: 1 },
        { kind: 'redeem', at: Date.now(), who: event.userName || event.userLogin, detail: event.rewardTitle },
      );
    },

    recordWatchStreak: (event) => {
      apply('', undefined, {}, {}, { kind: 'streak', at: Date.now(), who: event.userName || event.userLogin, detail: String(event.streak) });
    },

    recordDuel: ({ winner, loser, kind }) => {
      if (kind !== 'win' || !winner || !loser) return;
      const now = Date.now();
      const s = get();
      bumpUser(s.allTime, winner, winner, { duelWins: 1 }, now);
      bumpUser(s.session.users, winner, winner, { duelWins: 1 }, now);
      bumpUser(s.allTime, loser, loser, { duelLosses: 1 }, now);
      bumpUser(s.session.users, loser, loser, { duelLosses: 1 }, now);
      s.session.totals.duels += 1;
      set({ rev: s.rev + 1, feed: addFeedEvent(s.feed, { kind: 'duel', at: now, who: winner, detail: loser }) });
      scheduleSave(get);
    },

    newStream: () => {
      set((s) => ({ session: freshSession(Date.now()), rev: s.rev + 1 }));
      scheduleSave(get);
    },

    resetAll: () => {
      set((s) => ({ allTime: {}, session: freshSession(Date.now()), feed: [], minutes: {}, giftIds: [], rev: s.rev + 1 }));
      scheduleSave(get);
    },
  };
});

// Everything that is not a chat message arrives here, so no component has to be open for stats to accumulate.
rpc.on(Events.TwitchFollow, (event) => useStatsStore.getState().recordFollow(event));
rpc.on(Events.TwitchRaid, (event) => useStatsStore.getState().recordRaid(event));
rpc.on(Events.TwitchChannelPointsRedeemed, (event) => useStatsStore.getState().recordRedemption(event));
rpc.on(Events.TwitchGift, (event) => useStatsStore.getState().recordGift(event));
rpc.on(Events.TwitchWatchStreak, (event) => useStatsStore.getState().recordWatchStreak(event));
