import test from 'node:test';
import assert from 'node:assert/strict';
import { activeGifts, GIFT_TTL_MS, giftText, mergeGift } from './giftStrip.ts';

const gift = (id, extra = {}) => ({ id, gifterName: 'Alice', gifterLogin: 'alice', anonymous: false, count: 1, tier: '1000', recipientName: null, totalGifted: 0, at: new Date().toISOString(), ...extra });

test('describes single gifts, bundles and anonymous gifts', () => {
  assert.equal(giftText(gift('1', { recipientName: 'Bob', tier: '2000' }), 'en'), 'Alice gifted a Tier 2 sub to Bob');
  assert.equal(giftText(gift('2', { count: 5 }), 'en'), 'Alice gifted 5 Tier 1 subs');
  assert.equal(giftText(gift('3', { anonymous: true, count: 10, tier: '3000' }), 'en'), 'Anonymous gifted 10 Tier 3 subs');
  assert.equal(giftText(gift('4'), 'en'), 'Alice gifted a Tier 1 sub');
  assert.ok(giftText(gift('5', { count: 5 }), 'ar').includes('5'));
});

test('a gift seen twice is kept once, newest first', () => {
  let list = [];
  list = mergeGift(list, gift('a'));
  list = mergeGift(list, gift('b'));
  list = mergeGift(list, gift('a'));
  assert.deepEqual(list.map((g) => g.id), ['b', 'a']);
});

test('only recent gifts stay pinned, at most three', () => {
  const now = Date.now();
  const old = gift('old', { at: new Date(now - GIFT_TTL_MS - 1000).toISOString() });
  const fresh = ['f1', 'f2', 'f3', 'f4'].map((id) => gift(id, { at: new Date(now - 1000).toISOString() }));
  const shown = activeGifts([...fresh, old], now);
  assert.deepEqual(shown.map((g) => g.id), ['f1', 'f2', 'f3']);
  assert.deepEqual(activeGifts([old], now), []);
});
