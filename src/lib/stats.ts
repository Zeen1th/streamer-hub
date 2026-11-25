// Pure helpers behind the Home dashboard: per-viewer tallies (leaderboards), messages-per-minute, and the
// event feed. The store (statsStore.ts) owns persistence; everything here is deterministic and unit tested.

export type LeaderboardMetric = 'messages' | 'duelWins' | 'gifts' | 'redemptions' | 'clips';
export type LeaderboardPeriod = 'stream' | 'allTime';

export interface UserStats {
  login: string;
  name: string;
  messages: number;
  duelWins: number;
  duelLosses: number;
  gifts: number;
  redemptions: number;
  /** Clips this viewer made with the clip command. Missing on stats saved before it existed. */
  clips: number;
  /** Channel points spent on redemptions. */
  points: number;
  lastSeen: number;
}

export type UserStatsMap = Record<string, UserStats>;

export interface StreamTotals {
  messages: number;
  follows: number;
  raids: number;
  raidViewers: number;
  gifts: number;
  redemptions: number;
  duels: number;
  clips?: number;
}

export type FeedKind = 'follow' | 'raid' | 'gift' | 'redeem' | 'duel' | 'streak' | 'clip';

export interface FeedEvent {
  id: string;
  kind: FeedKind;
  at: number;
  /** Who it is about (display name). */
  who: string;
  /** Short detail: reward name, "12 viewers", "3 subs", "beat Bob"... */
  detail: string;
}

export const EMPTY_TOTALS: StreamTotals = { messages: 0, follows: 0, raids: 0, raidViewers: 0, gifts: 0, redemptions: 0, duels: 0 };

/** Accounts that chat a lot but are not viewers; hidden from leaderboards. */
export const KNOWN_BOTS: readonly string[] = [
  'nightbot',
  'streamelements',
  'streamlabs',
  'moobot',
  'fossabot',
  'wizebot',
  'sery_bot',
  'soundalerts',
  'commanderroot',
  'streamlootsbot',
];

/**
 * Older versions credited clips made by the streamer to a made-up viewer with the login "streamer". It is not a real
 * viewer, so it never shows on a leaderboard and is dropped from saved stats when they load.
 */
export const LEGACY_FAKE_LOGINS: readonly string[] = ['streamer'];

export function userKey(login: string): string {
  return login.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Accounts that never appear on a leaderboard or in the chatter count: bots, the streamer, and the app's own bot account.
 * `excluded` is the streamer's login and the bot account's login (either can be missing).
 */
export function isIgnoredUser(login: string, ...excluded: Array<string | null | undefined>): boolean {
  const key = userKey(login);
  if (!key) return true;
  if (KNOWN_BOTS.includes(key) || LEGACY_FAKE_LOGINS.includes(key)) return true;
  return excluded.some((other) => !!other && userKey(other) === key);
}

export function emptyUser(login: string, name?: string): UserStats {
  const key = userKey(login);
  return { login: key, name: (name || login).trim().replace(/^@+/, '') || key, messages: 0, duelWins: 0, duelLosses: 0, gifts: 0, redemptions: 0, clips: 0, points: 0, lastSeen: 0 };
}

export type UserPatch = Partial<Pick<UserStats, 'messages' | 'duelWins' | 'duelLosses' | 'gifts' | 'redemptions' | 'clips' | 'points'>>;

/** Adds the deltas in `patch` to a viewer's tally, creating the entry when needed. Mutates `users`. */
export function bumpUser(users: UserStatsMap, login: string, name: string | undefined, patch: UserPatch, now: number): UserStats | null {
  const key = userKey(login);
  if (!key) return null;
  const entry = users[key] ?? (users[key] = emptyUser(key, name));
  if (name && name.trim()) entry.name = name.trim().replace(/^@+/, '');
  entry.messages += patch.messages ?? 0;
  entry.duelWins += patch.duelWins ?? 0;
  entry.duelLosses += patch.duelLosses ?? 0;
  entry.gifts += patch.gifts ?? 0;
  entry.redemptions += patch.redemptions ?? 0;
  entry.clips = (entry.clips ?? 0) + (patch.clips ?? 0);
  entry.points += patch.points ?? 0;
  entry.lastSeen = now;
  return entry;
}

export interface StatsSession {
  startedAt: number;
  users: UserStatsMap;
  totals: StreamTotals;
}

/** Everything the stats store keeps (page storage and the host's backup copy share this shape). */
export interface StatsSnapshot {
  allTime: UserStatsMap;
  session: StatsSession;
  feed: FeedEvent[];
  minutes: Record<string, number>;
  giftIds: string[];
  lastActivity: number;
}

/** A session older than this when the app starts is treated as a previous stream and archived into all-time only. */
export const STALE_SESSION_MS = 8 * 60 * 60 * 1000;

/** Removes the made-up "streamer" viewer (see LEGACY_FAKE_LOGINS) from a tally. Mutates `users`. */
export function dropLegacyUsers(users: UserStatsMap): void {
  for (const key of Object.keys(users)) {
    if (LEGACY_FAKE_LOGINS.includes(userKey(key)) || LEGACY_FAKE_LOGINS.includes(userKey(users[key]?.login ?? ''))) delete users[key];
  }
}

/**
 * Reads saved stats JSON (or an already parsed object) defensively. Returns null when it is not stats at all. The made-up
 * "streamer" viewer is dropped, and a session older than a long stream is replaced by a fresh one.
 */
export function parseStatsSnapshot(raw: unknown, now: number): StatsSnapshot | null {
  let parsed: Partial<StatsSnapshot> | null;
  try {
    parsed = typeof raw === 'string' ? (JSON.parse(raw) as Partial<StatsSnapshot>) : (raw as Partial<StatsSnapshot>);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const fresh = (): StatsSession => ({ startedAt: now, users: {}, totals: { ...EMPTY_TOTALS } });
  const loaded: StatsSnapshot = {
    allTime: parsed.allTime && typeof parsed.allTime === 'object' ? parsed.allTime : {},
    session:
      parsed.session && typeof parsed.session === 'object' && parsed.session.users
        ? { startedAt: parsed.session.startedAt ?? now, users: parsed.session.users, totals: { ...EMPTY_TOTALS, ...(parsed.session.totals ?? {}) } }
        : fresh(),
    feed: Array.isArray(parsed.feed) ? parsed.feed : [],
    minutes: parsed.minutes && typeof parsed.minutes === 'object' ? parsed.minutes : {},
    giftIds: Array.isArray(parsed.giftIds) ? parsed.giftIds.filter((id): id is string => typeof id === 'string') : [],
    lastActivity: typeof parsed.lastActivity === 'number' ? parsed.lastActivity : now,
  };
  dropLegacyUsers(loaded.allTime);
  dropLegacyUsers(loaded.session.users);
  if (now - loaded.lastActivity > STALE_SESSION_MS) loaded.session = fresh();
  return loaded;
}

/**
 * Which copy of the stats to start with. The page's own storage wins normally. The host's backup wins when the page has
 * no all-time viewers but the backup does (storage was cleared), or when the backup is newer (another profile saved it).
 */
export function pickStatsToKeep(
  local: { allTime?: UserStatsMap; lastActivity?: number } | null | undefined,
  backup: { allTime?: UserStatsMap; lastActivity?: number } | null | undefined,
): 'local' | 'backup' {
  const backupUsers = backup ? Object.keys(backup.allTime ?? {}).length : 0;
  if (!backup || backupUsers === 0) return 'local';
  const localUsers = local ? Object.keys(local.allTime ?? {}).length : 0;
  if (localUsers === 0) return 'backup';
  return (backup.lastActivity ?? 0) > (local?.lastActivity ?? 0) ? 'backup' : 'local';
}

/** Adds every counter of `extra` onto `base` (creating viewers that are missing). Mutates `base`. */
export function mergeUsers(base: UserStatsMap, extra: UserStatsMap): void {
  for (const [key, add] of Object.entries(extra)) {
    const have = base[key];
    if (!have) {
      base[key] = { ...add };
      continue;
    }
    have.messages += add.messages;
    have.duelWins += add.duelWins;
    have.duelLosses += add.duelLosses;
    have.gifts += add.gifts;
    have.redemptions += add.redemptions;
    have.clips = (have.clips ?? 0) + (add.clips ?? 0);
    have.points += add.points;
    have.lastSeen = Math.max(have.lastSeen, add.lastSeen);
    if (add.name) have.name = add.name;
  }
}

export interface RankedUser {
  rank: number;
  user: UserStats;
  value: number;
}

/** Highest first; ties keep the more recently active viewer ahead. Zero scores never appear. */
export function topUsers(
  users: UserStatsMap,
  metric: LeaderboardMetric,
  limit: number,
  isIgnored: (login: string) => boolean = () => false,
): RankedUser[] {
  const rows = Object.values(users)
    .filter((u) => !isIgnored(u.login) && (u[metric] ?? 0) > 0)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0) || b.lastSeen - a.lastSeen || a.login.localeCompare(b.login));
  return rows.slice(0, Math.max(0, limit)).map((user, i) => ({ rank: i + 1, user, value: user[metric] ?? 0 }));
}

/** Keeps the all-time table bounded: drops the least valuable, least recent viewers once over `max`. */
export function pruneUsers(users: UserStatsMap, max: number): void {
  const entries = Object.values(users);
  if (entries.length <= max) return;
  const score = (u: UserStats) => u.messages + u.duelWins * 5 + u.gifts * 10 + u.redemptions * 3 + (u.clips ?? 0) * 3;
  entries.sort((a, b) => score(a) - score(b) || a.lastSeen - b.lastSeen);
  for (const doomed of entries.slice(0, entries.length - max)) delete users[doomed.login];
}

export function minuteOf(timestamp: number): number {
  return Math.floor(timestamp / 60_000);
}

/** Counts a message in its minute bucket and forgets buckets older than `keepMinutes`. Mutates `buckets`. */
export function recordMinute(buckets: Record<string, number>, now: number, keepMinutes = 180): void {
  const minute = minuteOf(now);
  buckets[minute] = (buckets[minute] ?? 0) + 1;
  const cutoff = minute - keepMinutes;
  for (const key of Object.keys(buckets)) {
    if (Number(key) < cutoff) delete buckets[key];
  }
}

/** Messages per minute for the last `minutes` minutes, oldest first, ending with the current minute. */
export function activitySeries(buckets: Record<string, number>, now: number, minutes: number): number[] {
  const end = minuteOf(now);
  const series: number[] = [];
  for (let m = end - minutes + 1; m <= end; m++) series.push(buckets[m] ?? 0);
  return series;
}

/** Average over the most recent `window` minutes of a series (ignores an unfinished current minute when there is history). */
export function recentRate(series: number[], window = 5): number {
  if (series.length === 0) return 0;
  const slice = series.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function addFeedEvent(feed: FeedEvent[], event: Omit<FeedEvent, 'id'>, max = 60): FeedEvent[] {
  const entry: FeedEvent = { ...event, id: `${event.at}-${feed.length}-${event.kind}-${event.who}` };
  return [entry, ...feed].slice(0, max);
}

export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value));
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 45) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/** Chat line for the leaderboard "post to chat" button, kept under Twitch's 500 character limit. */
export function leaderboardChatLine(title: string, rows: RankedUser[], unit: string): string {
  const medals = ['🥇', '🥈', '🥉'];
  const parts = rows.slice(0, 5).map((r) => `${medals[r.rank - 1] ?? `${r.rank}.`} ${r.user.name} (${r.value}${unit ? ` ${unit}` : ''})`);
  return `🏆 ${title}: ${parts.join(' · ')}`.slice(0, 480);
}
