import { create } from 'zustand';
import { Channels, Events } from '../rpc/contracts';
import type {
  ChannelPointsRedemption,
  ChatMessage,
  TwitchFollowEvent,
  TwitchGiftEvent,
  TwitchRaidEvent,
  TwitchWatchStreakEvent,
} from '../rpc/contracts';
import { rpc } from '../rpc';
import { useConnectionStore } from './connectionStore';
import {
  EMPTY_TOTALS,
  addFeedEvent,
  bumpUser,
  isIgnoredUser,
  mergeUsers,
  parseStatsSnapshot,
  pickStatsToKeep,
  pruneUsers,
  recordMinute,
  type FeedEvent,
  type StatsSession,
  type StatsSnapshot,
  type StreamTotals,
  type UserPatch,
  type UserStatsMap,
} from '../lib/stats';

const STORAGE_KEY = 'streamer-hub-stats-v1';
const MAX_ALL_TIME_USERS = 2500;
const SAVE_DELAY_MS = 2000;
/** The host's copy (stats.json) is refreshed at most this often, plus once when the page is hidden or closed. */
const BACKUP_EVERY_MS = 30_000;
const BACKUP_LOAD_TIMEOUT_MS = 8000;

type Persisted = StatsSnapshot;
type SessionData = StatsSession;

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
  /**
   * Whether Twitch says the channel is live. Nothing is counted while it is explicitly offline; while it is unknown
   * (not connected yet, or Twitch could not be asked) everything is counted as before.
   */
  streamLive: 'unknown' | 'live' | 'offline';
  /** Twitch said live or offline. A new live stream starts a fresh "this stream", and the on-air clock follows Twitch's start time. */
  setStreamStatus(status: 'unknown' | 'live' | 'offline', startedAt?: number): void;
  recordMessage(message: Pick<ChatMessage, 'username' | 'displayName' | 'userLogin'> & { id?: string; isSelf?: boolean }): void;
  recordFollow(event: TwitchFollowEvent): void;
  recordRaid(event: TwitchRaidEvent): void;
  recordGift(event: TwitchGiftEvent): void;
  recordRedemption(event: ChannelPointsRedemption): void;
  recordWatchStreak(event: TwitchWatchStreakEvent): void;
  /** A viewer made a clip with the clip command. Returns how many clips they have made in total (all time). */
  recordClip(clip: { login: string; name?: string; url: string }): number;
  recordDuel(result: { winner: string; loser: string; kind: 'win' | 'no_winner' }): void;
  /** Starts a fresh "this stream" without touching all-time totals. */
  newStream(): void;
  /** Wipes everything: both leaderboards, the feed and the activity chart. What was there is kept first in the host backups. */
  resetAll(): void;
  /** Loads a stats copy (a Settings > Backups snapshot) into the store and the page storage. False when it is not stats JSON. */
  restoreFromJson(json: string): boolean;
}

const freshSession = (now: number): SessionData => ({ startedAt: now, users: {}, totals: { ...EMPTY_TOTALS } });

function load(now: number): Persisted {
  const fallback: Persisted = { allTime: {}, session: freshSession(now), feed: [], minutes: {}, giftIds: [], lastActivity: now };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return parseStatsSnapshot(raw, now) ?? fallback;
  } catch {
    return fallback;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function snapshotOf(s: StatsState): Persisted {
  return { allTime: s.allTime, session: s.session, feed: s.feed, minutes: s.minutes, giftIds: s.giftIds, lastActivity: Date.now() };
}

function writeLocal(json: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // storage full or unavailable: stats just stay in memory (the host copy below still has them)
  }
}

// ---- the host copy (stats.json): protects the leaderboards when the page storage is cleared or lost ----

/** False until the host copy has been compared with the page storage, so an empty page never overwrites a good backup. */
let backupReady = false;
/** After "Reset everything" the page must not write its old stats back to the host before the app restarts. */
let backupSuspended = false;
let backupDirty = false;
let lastBackupAt = 0;
let backupTimer: ReturnType<typeof setTimeout> | null = null;
let pendingJson: string | null = null;

function sendBackup(json: string, reason: 'save' | 'reset' = 'save') {
  void rpc.invoke(Channels.StatsBackupSave, { json, reason }).catch(() => {
    // no host (plain browser) or it refused: the page storage still has the stats
  });
}

function flushBackup() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }
  if (!pendingJson || !backupReady || backupSuspended) return;
  const json = pendingJson;
  pendingJson = null;
  backupDirty = false;
  lastBackupAt = Date.now();
  sendBackup(json);
}

/** Called after each page save: sends to the host at most every 30 seconds (the newest data wins). */
function queueBackup(json: string) {
  pendingJson = json;
  if (!backupReady || backupSuspended || backupTimer) return;
  const wait = lastBackupAt + BACKUP_EVERY_MS - Date.now();
  if (wait <= 0) flushBackup();
  else backupTimer = setTimeout(flushBackup, wait);
}

/** The page is being hidden or closed: send what has not been sent yet, right now. */
function flushBackupNow() {
  if (!backupReady || backupSuspended || !backupDirty) return;
  try {
    pendingJson = JSON.stringify(snapshotOf(useStatsStore.getState()));
  } catch {
    return;
  }
  flushBackup();
}

/** Used by Settings > System > Reset everything: nothing more goes to the host before the restart. */
export function suspendStatsBackup() {
  backupSuspended = true;
  pendingJson = null;
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }
}

function scheduleSave(read: () => StatsState) {
  backupDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const json = JSON.stringify(snapshotOf(read()));
      writeLocal(json);
      queueBackup(json);
    } catch {
      // not serializable: stats just stay in memory
    }
  }, SAVE_DELAY_MS);
}

const initial = load(Date.now());
/** What the page storage held at start, for choosing between it and the host copy. */
const localAtStart = { allTime: { ...initial.allTime }, lastActivity: initial.lastActivity };

/** The streamer, their bot account and known bots are never counted as viewers. */
const isNotViewer = (login: string) => {
  const connection = useConnectionStore.getState();
  return isIgnoredUser(login, connection.twitchChannel?.replace(/^#+/, ''), connection.botLogin);
};

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
    streamLive: 'unknown',

    setStreamStatus: (status, startedAt) => {
      const s = get();
      if (status !== 'live') {
        if (s.streamLive !== status) set({ streamLive: status, rev: s.rev + 1 });
        return;
      }
      const start = startedAt && startedAt > 0 ? startedAt : s.session.startedAt;
      // The saved numbers belong to an earlier stream when it began before this one did
      const isNewStream = s.session.startedAt < start - 5 * 60_000;
      const session = isNewStream ? { ...freshSession(start) } : { ...s.session, startedAt: Math.min(s.session.startedAt, start) };
      set({ streamLive: 'live', session, rev: s.rev + 1 });
      scheduleSave(get);
    },

    recordMessage: (message) => {
      if (get().streamLive === 'offline') return;
      // What the app itself says in chat (replies, announcements) comes back as a chat line: it is not a viewer talking
      if (message.isSelf || message.id?.startsWith('self-')) return;
      const login = message.userLogin || message.username;
      if (!login) return;
      // The Home dashboard is about the viewers: the streamer, the app's bot and known bots count nowhere
      // (not in the message total, the chat activity curve or the chatter count)
      if (isNotViewer(login)) return;
      const now = Date.now();
      recordMinute(get().minutes, now);
      apply(login, message.displayName || message.username, { messages: 1 }, { messages: 1 });
    },

    recordFollow: (event) => {
      if (get().streamLive === 'offline') return;
      apply(event.userLogin, event.userName, {}, { follows: 1 }, { kind: 'follow', at: Date.now(), who: event.userName || event.userLogin, detail: '' });
    },

    recordRaid: (event) => {
      if (get().streamLive === 'offline') return;
      apply('', undefined, {}, { raids: 1, raidViewers: event.viewers }, {
        kind: 'raid',
        at: Date.now(),
        who: event.fromUserName || event.fromUserLogin,
        detail: String(event.viewers),
      });
    },

    recordGift: (event) => {
      if (get().streamLive === 'offline') return;
      if (event.id && get().giftIds.includes(event.id)) return;
      if (event.id) set({ giftIds: [event.id, ...get().giftIds].slice(0, 300) });
      const count = Math.max(1, event.count || 1);
      const who = event.anonymous ? 'Anonymous' : event.gifterName || event.gifterLogin;
      const gifter = event.anonymous || isNotViewer(event.gifterLogin) ? '' : event.gifterLogin;
      apply(gifter, who, { gifts: count }, { gifts: count }, { kind: 'gift', at: Date.now(), who, detail: String(count) });
    },

    recordRedemption: (event) => {
      if (get().streamLive === 'offline') return;
      // The streamer testing their own rewards is not viewer activity
      if (isNotViewer(event.userLogin)) return;
      apply(
        event.userLogin,
        event.userName,
        { redemptions: 1, points: event.rewardCost ?? 0 },
        { redemptions: 1 },
        { kind: 'redeem', at: Date.now(), who: event.userName || event.userLogin, detail: event.rewardTitle },
      );
    },

    recordWatchStreak: (event) => {
      if (get().streamLive === 'offline') return;
      apply('', undefined, {}, {}, { kind: 'streak', at: Date.now(), who: event.userName || event.userLogin, detail: String(event.streak) });
    },

    recordDuel: ({ winner, loser, kind }) => {
      if (kind !== 'win' || !winner || !loser || get().streamLive === 'offline') return;
      const now = Date.now();
      const s = get();
      // The streamer can play a duel too, but only viewers are ranked
      if (!isNotViewer(winner)) {
        bumpUser(s.allTime, winner, winner, { duelWins: 1 }, now);
        bumpUser(s.session.users, winner, winner, { duelWins: 1 }, now);
      }
      if (!isNotViewer(loser)) {
        bumpUser(s.allTime, loser, loser, { duelLosses: 1 }, now);
        bumpUser(s.session.users, loser, loser, { duelLosses: 1 }, now);
      }
      s.session.totals.duels += 1;
      set({ rev: s.rev + 1, feed: addFeedEvent(s.feed, { kind: 'duel', at: now, who: winner, detail: loser }) });
      scheduleSave(get);
    },

    recordClip: ({ login, name, url }) => {
      const now = Date.now();
      const s = get();
      // A clip the streamer makes themself is not credited to anyone
      const credited = isNotViewer(login) ? null : login;
      const entry = credited ? bumpUser(s.allTime, credited, name, { clips: 1 }, now) : null;
      if (credited) bumpUser(s.session.users, credited, name, { clips: 1 }, now);
      if (!credited) {
        // The streamer's own clip is not viewer activity: it stays off the Home totals and feed
        scheduleSave(get);
        return 1;
      }
      s.session.totals.clips = (s.session.totals.clips ?? 0) + 1;
      set({ rev: s.rev + 1, feed: addFeedEvent(s.feed, { kind: 'clip', at: now, who: name || login, detail: url }) });
      scheduleSave(get);
      return entry?.clips ?? 1;
    },

    newStream: () => {
      set((s) => ({ session: freshSession(Date.now()), rev: s.rev + 1 }));
      scheduleSave(get);
    },

    resetAll: () => {
      keepBeforeReset(get());
      set((s) => ({ allTime: {}, session: freshSession(Date.now()), feed: [], minutes: {}, giftIds: [], rev: s.rev + 1 }));
      // The empty table goes to the host too, otherwise a restart within 30 s would bring the old board back
      lastBackupAt = 0;
      scheduleSave(get);
    },

    restoreFromJson: (json) => {
      const restored = parseStatsSnapshot(json, Date.now());
      if (!restored) return false;
      keepBeforeReset(get());
      adopt(restored);
      return true;
    },
  };
});

/** Sends the current numbers to the host as a "before reset" copy (only when there is something worth keeping). */
function keepBeforeReset(s: StatsState) {
  if (backupSuspended || Object.keys(s.allTime).length === 0) return;
  try {
    sendBackup(JSON.stringify(snapshotOf(s)), 'reset');
  } catch {
    // too big to serialize: nothing to keep
  }
}

/** Replaces the live stats with `next`, in the store, the page storage and the host copy. */
function adopt(next: Persisted) {
  useStatsStore.setState((s) => ({
    allTime: next.allTime,
    session: next.session,
    feed: next.feed,
    minutes: next.minutes,
    giftIds: next.giftIds,
    rev: s.rev + 1,
  }));
  try {
    const json = JSON.stringify(snapshotOf(useStatsStore.getState()));
    writeLocal(json);
    backupDirty = true;
    lastBackupAt = 0;
    queueBackup(json);
  } catch {
    // stays in memory
  }
}

/** At start: compare the host copy with the page storage and keep the better one (see pickStatsToKeep). */
async function reconcileWithHost() {
  try {
    const res = await Promise.race([
      rpc.invoke(Channels.StatsBackupLoad, undefined),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), BACKUP_LOAD_TIMEOUT_MS)),
    ]);
    const backup = res?.json ? parseStatsSnapshot(res.json, Date.now()) : null;
    if (backup && pickStatsToKeep(localAtStart, backup) === 'backup') {
      const live = useStatsStore.getState();
      // Counted between start and now while the page had nothing: add it on top of the backup
      if (live.rev > 0 && Object.keys(localAtStart.allTime).length === 0) {
        mergeUsers(backup.allTime, live.allTime);
        mergeUsers(backup.session.users, live.session.users);
      }
      adopt(backup);
    }
  } catch {
    // the host has no copy or is not there: carry on with the page storage
  } finally {
    backupReady = true;
    if (pendingJson) queueBackup(pendingJson);
  }
}

void reconcileWithHost();
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushBackupNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBackupNow();
  });
}

// Everything that is not a chat message arrives here, so no component has to be open for stats to accumulate.
rpc.on(Events.TwitchFollow, (event) => useStatsStore.getState().recordFollow(event));
rpc.on(Events.TwitchRaid, (event) => useStatsStore.getState().recordRaid(event));
rpc.on(Events.TwitchChannelPointsRedeemed, (event) => useStatsStore.getState().recordRedemption(event));
rpc.on(Events.TwitchGift, (event) => useStatsStore.getState().recordGift(event));
rpc.on(Events.TwitchWatchStreak, (event) => useStatsStore.getState().recordWatchStreak(event));
