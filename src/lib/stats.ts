// Pure helpers behind the Home dashboard: per-viewer tallies (leaderboards), messages-per-minute, and the
// event feed. The store (statsStore.ts) owns persistence; everything here is deterministic and unit tested.

export type LeaderboardMetric = 'messages' | 'duelWins' | 'gifts' | 'redemptions';
export type LeaderboardPeriod = 'stream' | 'allTime';

export interface UserStats {
  login: string;
  name: string;
  messages: number;
  duelWins: number;
  duelLosses: number;
  gifts: number;
  redemptions: number;
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
}

export type FeedKind = 'follow' | 'raid' | 'gift' | 'redeem' | 'duel' | 'streak';

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

export function userKey(login: string): string {
  return login.trim().replace(/^@+/, '').toLowerCase();
}

export function isIgnoredUser(login: string, broadcasterLogin: string | undefined, includeStreamer: boolean): boolean {
  const key = userKey(login);
  if (!key) return true;
  if (KNOWN_BOTS.includes(key)) return true;
  if (!includeStreamer && broadcasterLogin && key === userKey(broadcasterLogin)) return true;
  return false;
}

export function emptyUser(login: string, name?: string): UserStats {
  const key = userKey(login);
  return { login: key, name: (name || login).trim().replace(/^@+/, '') || key, messages: 0, duelWins: 0, duelLosses: 0, gifts: 0, redemptions: 0, points: 0, lastSeen: 0 };
}

export type UserPatch = Partial<Pick<UserStats, 'messages' | 'duelWins' | 'duelLosses' | 'gifts' | 'redemptions' | 'points'>>;

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
  entry.points += patch.points ?? 0;
  entry.lastSeen = now;
  return entry;
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
    .filter((u) => !isIgnored(u.login) && u[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || b.lastSeen - a.lastSeen || a.login.localeCompare(b.login));
  return rows.slice(0, Math.max(0, limit)).map((user, i) => ({ rank: i + 1, user, value: user[metric] }));
}

/** Keeps the all-time table bounded: drops the least valuable, least recent viewers once over `max`. */
export function pruneUsers(users: UserStatsMap, max: number): void {
  const entries = Object.values(users);
  if (entries.length <= max) return;
  const score = (u: UserStats) => u.messages + u.duelWins * 5 + u.gifts * 10 + u.redemptions * 3;
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
