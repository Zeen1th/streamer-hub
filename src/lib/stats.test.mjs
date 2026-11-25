import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bumpUser,
  topUsers,
  pruneUsers,
  recordMinute,
  activitySeries,
  recentRate,
  isIgnoredUser,
  addFeedEvent,
  formatCompact,
  formatDuration,
  formatAgo,
  leaderboardChatLine,
  userKey,
  dropLegacyUsers,
  parseStatsSnapshot,
  pickStatsToKeep,
  mergeUsers,
} from './stats.ts';

test('bumpUser creates and accumulates a viewer, keyed by lowercase login', () => {
  const users = {};
  bumpUser(users, '@Alice', 'Alice', { messages: 1 }, 100);
  bumpUser(users, 'alice', 'ALICE', { messages: 2, gifts: 3 }, 200);
  assert.equal(Object.keys(users).length, 1);
  assert.equal(users.alice.messages, 3);
  assert.equal(users.alice.gifts, 3);
  assert.equal(users.alice.name, 'ALICE');
  assert.equal(users.alice.lastSeen, 200);
  assert.equal(bumpUser(users, '  ', 'x', { messages: 1 }, 1), null);
});

test('topUsers ranks by metric, hides zero scores and ignored accounts, breaks ties by recency', () => {
  const users = {};
  bumpUser(users, 'a', 'A', { messages: 5 }, 10);
  bumpUser(users, 'b', 'B', { messages: 9 }, 10);
  bumpUser(users, 'c', 'C', { messages: 5 }, 50);
  bumpUser(users, 'nightbot', 'Nightbot', { messages: 99 }, 10);
  bumpUser(users, 'z', 'Z', { duelWins: 1 }, 10);
  const ignored = (login) => isIgnoredUser(login, 'streamer');
  const rows = topUsers(users, 'messages', 10, ignored);
  assert.deepEqual(rows.map((r) => r.user.login), ['b', 'c', 'a']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.equal(topUsers(users, 'messages', 2, ignored).length, 2);
  assert.deepEqual(topUsers(users, 'duelWins', 5, ignored).map((r) => r.user.login), ['z']);
  assert.deepEqual(topUsers(users, 'gifts', 5, ignored), []);
});

test('the streamer is hidden unless included; bots are always hidden', () => {
  assert.equal(isIgnoredUser('Streamer', 'streamer'), true);
  assert.equal(isIgnoredUser('@STREAMER', '#streamer'.replace('#', '')), true);
  assert.equal(isIgnoredUser('helper_bot', 'streamer', 'Helper_Bot'), true, 'the app bot account is hidden too');
  assert.equal(isIgnoredUser('viewer', 'streamer', null, undefined), false);
  assert.equal(isIgnoredUser('StreamElements', 'streamer'), true);
  assert.equal(isIgnoredUser('', 'streamer'), true);
  assert.equal(userKey('  @Bob '), 'bob');
});

test('pruneUsers drops the least valuable viewers first', () => {
  const users = {};
  for (let i = 0; i < 6; i++) bumpUser(users, `u${i}`, `U${i}`, { messages: i + 1 }, i);
  pruneUsers(users, 3);
  assert.deepEqual(Object.keys(users).sort(), ['u3', 'u4', 'u5']);
});

test('minute buckets count messages, expire old minutes and build a series', () => {
  const buckets = {};
  const t0 = 60_000 * 1000;
  recordMinute(buckets, t0);
  recordMinute(buckets, t0 + 5_000);
  recordMinute(buckets, t0 + 120_000);
  assert.deepEqual(activitySeries(buckets, t0 + 120_000, 4), [0, 2, 0, 1]);
  recordMinute(buckets, t0 + 60_000 * 400, 180);
  assert.equal(Object.keys(buckets).length, 1);
  assert.equal(recentRate([0, 10, 20], 2), 15);
  assert.equal(recentRate([]), 0);
});

test('feed keeps the newest events first and caps its length', () => {
  let feed = [];
  for (let i = 0; i < 5; i++) feed = addFeedEvent(feed, { kind: 'follow', at: i, who: `u${i}`, detail: '' }, 3);
  assert.equal(feed.length, 3);
  assert.deepEqual(feed.map((e) => e.who), ['u4', 'u3', 'u2']);
  assert.equal(new Set(feed.map((e) => e.id)).size, 3);
});

test('number and time formatting', () => {
  assert.equal(formatCompact(950), '950');
  assert.equal(formatCompact(1500), '1.5k');
  assert.equal(formatCompact(12_400), '12k');
  assert.equal(formatCompact(2_000_000), '2M');
  assert.equal(formatDuration(5 * 60_000), '5m');
  assert.equal(formatDuration(3_900_000), '1h 05m');
  assert.equal(formatAgo(10_000), 'now');
  assert.equal(formatAgo(5 * 60_000), '5m');
  assert.equal(formatAgo(3 * 3_600_000), '3h');
});

test('leaderboard chat line lists the top five with medals and stays short', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ rank: i + 1, user: { name: `User${i + 1}` }, value: 100 - i }));
  const line = leaderboardChatLine('Top chatters', rows, 'msgs');
  assert.ok(line.startsWith('🏆 Top chatters: 🥇 User1 (100 msgs) · 🥈 User2'));
  assert.ok(line.includes('4. User4'));
  assert.ok(!line.includes('User6'));
  assert.ok(line.length <= 480);
});

test('clips are counted per viewer, rank the Top clippers board, and old saved stats without clips still work', () => {
  const users = {
    // saved by an older version: no clips field at all
    legacy: { login: 'legacy', name: 'Legacy', messages: 4, duelWins: 0, duelLosses: 0, gifts: 0, redemptions: 0, points: 0, lastSeen: 1 },
  };
  bumpUser(users, 'fan', 'Fan', { clips: 1 }, 10);
  bumpUser(users, 'fan', 'Fan', { clips: 1 }, 20);
  bumpUser(users, 'legacy', 'Legacy', { clips: 1 }, 30);
  assert.equal(users.fan.clips, 2);
  assert.equal(users.legacy.clips, 1);
  assert.deepEqual(topUsers(users, 'clips', 5).map((r) => [r.user.login, r.value]), [['fan', 2], ['legacy', 1]]);
  assert.deepEqual(topUsers({ legacy: users.legacy, other: { ...users.legacy, login: 'other', clips: undefined } }, 'clips', 5).map((r) => r.user.login), ['legacy']);
});

test('the made-up "streamer" viewer from older versions is always ignored and dropped on load', () => {
  assert.equal(isIgnoredUser('streamer'), true);
  assert.equal(isIgnoredUser('@Streamer'), true);
  assert.equal(isIgnoredUser('somebody'), false);
  const users = {};
  bumpUser(users, 'streamer', 'streamer', { clips: 4 }, 1);
  bumpUser(users, 'bob', 'Bob', { clips: 1 }, 1);
  assert.deepEqual(topUsers(users, 'clips', 10, (l) => isIgnoredUser(l)).map((r) => r.user.login), ['bob']);
  dropLegacyUsers(users);
  assert.deepEqual(Object.keys(users), ['bob']);

  const now = 1_000_000;
  const raw = JSON.stringify({
    allTime: { streamer: { login: 'streamer', clips: 3 }, bob: { login: 'bob', clips: 1 } },
    session: { startedAt: now, users: { streamer: { login: 'streamer' }, bob: { login: 'bob' } }, totals: {} },
    lastActivity: now,
  });
  const parsed = parseStatsSnapshot(raw, now);
  assert.deepEqual(Object.keys(parsed.allTime), ['bob']);
  assert.deepEqual(Object.keys(parsed.session.users), ['bob']);
});

test('parseStatsSnapshot rejects non-stats and starts a fresh session when the saved one is old', () => {
  assert.equal(parseStatsSnapshot('not json', 1), null);
  assert.equal(parseStatsSnapshot('[1]', 1), null);
  assert.equal(parseStatsSnapshot(null, 1), null);
  const old = parseStatsSnapshot({ allTime: { a: { login: 'a', messages: 1 } }, session: { startedAt: 5, users: { a: { login: 'a' } }, totals: {} }, lastActivity: 5 }, 5 + 9 * 3600_000);
  assert.deepEqual(Object.keys(old.allTime), ['a']);
  assert.deepEqual(old.session.users, {});
  assert.equal(parseStatsSnapshot({}, 7).lastActivity, 7);
});

test('pickStatsToKeep keeps local unless the backup has what local lost or is newer', () => {
  const some = { a: { login: 'a' } };
  assert.equal(pickStatsToKeep({ allTime: some, lastActivity: 10 }, { allTime: some, lastActivity: 10 }), 'local');
  assert.equal(pickStatsToKeep({ allTime: some, lastActivity: 10 }, { allTime: some, lastActivity: 5 }), 'local');
  assert.equal(pickStatsToKeep({ allTime: some, lastActivity: 10 }, { allTime: some, lastActivity: 11 }), 'backup');
  assert.equal(pickStatsToKeep({ allTime: {}, lastActivity: 999 }, { allTime: some, lastActivity: 1 }), 'backup');
  assert.equal(pickStatsToKeep(null, { allTime: some, lastActivity: 1 }), 'backup');
  assert.equal(pickStatsToKeep({ allTime: some, lastActivity: 1 }, null), 'local');
  assert.equal(pickStatsToKeep({ allTime: some, lastActivity: 1 }, { allTime: {}, lastActivity: 99 }), 'local');
  assert.equal(pickStatsToKeep({ allTime: {}, lastActivity: 1 }, { allTime: {}, lastActivity: 99 }), 'local');
});

test('mergeUsers adds counters onto existing viewers and creates missing ones', () => {
  const base = {};
  bumpUser(base, 'a', 'A', { messages: 5, clips: 1 }, 10);
  const extra = {};
  bumpUser(extra, 'a', 'A', { messages: 2, clips: 1 }, 20);
  bumpUser(extra, 'b', 'B', { messages: 1 }, 5);
  mergeUsers(base, extra);
  assert.equal(base.a.messages, 7);
  assert.equal(base.a.clips, 2);
  assert.equal(base.a.lastSeen, 20);
  assert.equal(base.b.messages, 1);
});

test('topUsers with no limit lists everyone above zero, ignored accounts never appear', () => {
  const users = {};
  for (let i = 0; i < 30; i++) bumpUser(users, `u${i}`, `U${i}`, { messages: i }, i);
  bumpUser(users, 'streamer', 'streamer', { messages: 500 }, 1);
  const rows = topUsers(users, 'messages', Number.MAX_SAFE_INTEGER, (l) => isIgnoredUser(l));
  assert.equal(rows.length, 29);
  assert.equal(rows[0].user.login, 'u29');
  assert.equal(rows[28].rank, 29);
});
