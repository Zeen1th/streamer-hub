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
  const ignored = (login) => isIgnoredUser(login, 'streamer', false);
  const rows = topUsers(users, 'messages', 10, ignored);
  assert.deepEqual(rows.map((r) => r.user.login), ['b', 'c', 'a']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.equal(topUsers(users, 'messages', 2, ignored).length, 2);
  assert.deepEqual(topUsers(users, 'duelWins', 5, ignored).map((r) => r.user.login), ['z']);
  assert.deepEqual(topUsers(users, 'gifts', 5, ignored), []);
});

test('the streamer is hidden unless included; bots are always hidden', () => {
  assert.equal(isIgnoredUser('Streamer', 'streamer', false), true);
  assert.equal(isIgnoredUser('Streamer', 'streamer', true), false);
  assert.equal(isIgnoredUser('StreamElements', 'streamer', true), true);
  assert.equal(isIgnoredUser('', 'streamer', true), true);
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
