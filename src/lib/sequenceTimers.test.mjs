import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimerInterval, shouldFireTimer } from './sequenceTimers.ts';

const MIN = 60_000;
const base = { intervalMinutes: 30, minChatMessages: 5, lastFiredAt: 0, now: 30 * MIN, chatLinesSince: 5 };

test('fires once the interval has passed and chat has been active enough', () => {
  assert.equal(shouldFireTimer(base), true);
  assert.equal(shouldFireTimer({ ...base, now: 30 * MIN - 1 }), false);
});

test('waits for chat activity, then fires as soon as it arrives', () => {
  assert.equal(shouldFireTimer({ ...base, chatLinesSince: 4 }), false);
  assert.equal(shouldFireTimer({ ...base, now: 90 * MIN, chatLinesSince: 5 }), true);
});

test('a minimum of 0 messages sends even in a silent chat', () => {
  assert.equal(shouldFireTimer({ ...base, minChatMessages: 0, chatLinesSince: 0 }), true);
});

test('interval is clamped to a sane range and defaults when missing', () => {
  assert.equal(shouldFireTimer({ ...base, intervalMinutes: 0, now: 29 * MIN }), false); // 0 -> default 30
  assert.equal(shouldFireTimer({ ...base, intervalMinutes: 0, now: 30 * MIN }), true);
  assert.equal(shouldFireTimer({ ...base, intervalMinutes: -5, now: 0.5 * MIN }), false); // clamped up to 1 min
  assert.equal(shouldFireTimer({ ...base, intervalMinutes: -5, now: 1 * MIN }), true);
  assert.equal(shouldFireTimer({ ...base, intervalMinutes: 99999, now: 24 * 60 * MIN }), true); // capped at 24 h
});

test('formats intervals for lists', () => {
  assert.equal(formatTimerInterval(30), '30 min');
  assert.equal(formatTimerInterval(60), '1 h');
  assert.equal(formatTimerInterval(90), '1 h 30 min');
});
