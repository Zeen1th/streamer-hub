import test from 'node:test';
import assert from 'node:assert/strict';
import { challengerChanceWithDevLuck, devInDuel } from './devLuck.ts';

const on = { enabled: true, chance: 75 };

test('the file is only worth reading when the developer is in the duel', () => {
  assert.equal(devInDuel('Zeen1_TH', 'bob'), true);
  assert.equal(devInDuel('bob', '@zeen1_th'), true);
  assert.equal(devInDuel('bob', 'alice'), false);
});

test('the developer gets their chance as challenger or as opponent', () => {
  assert.equal(challengerChanceWithDevLuck(50, 'zeen1_th', 'bob', on), 75);
  assert.equal(challengerChanceWithDevLuck(50, 'bob', '@Zeen1_th', on), 25);
});

test('off, missing or not playing leaves the normal odds', () => {
  assert.equal(challengerChanceWithDevLuck(40, 'zeen1_th', 'bob', { enabled: false, chance: 90 }), 40);
  assert.equal(challengerChanceWithDevLuck(40, 'zeen1_th', 'bob', null), 40);
  assert.equal(challengerChanceWithDevLuck(40, 'alice', 'bob', on), 40);
  assert.equal(challengerChanceWithDevLuck(40, 'zeen1_th', 'zeen1_th', on), 40);
});

test('a chance outside 1 to 99 is kept inside it', () => {
  assert.equal(challengerChanceWithDevLuck(50, 'zeen1_th', 'bob', { enabled: true, chance: 100 }), 99);
  assert.equal(challengerChanceWithDevLuck(50, 'bob', 'zeen1_th', { enabled: true, chance: 0 }), 99);
});
