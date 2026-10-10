import test from 'node:test';
import assert from 'node:assert/strict';
import { moveInList } from './listOrder.ts';

test('moveInList moves an item and leaves the input untouched', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveInList(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveInList(list, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('moveInList clamps the target and ignores a bad source', () => {
  assert.deepEqual(moveInList(['a', 'b', 'c'], 0, 99), ['b', 'c', 'a']);
  assert.deepEqual(moveInList(['a', 'b', 'c'], 2, -5), ['c', 'a', 'b']);
  assert.deepEqual(moveInList(['a', 'b'], 5, 0), ['a', 'b']);
  assert.deepEqual(moveInList([], 0, 0), []);
});
