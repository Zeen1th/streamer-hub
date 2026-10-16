import test from 'node:test';
import assert from 'node:assert/strict';
import { needsReload } from './overlayVersion.ts';

test('a page built for another version than the app reloads', () => {
  assert.equal(needsReload('0.4.17', '0.4.16'), true);
  assert.equal(needsReload('0.4.16', '0.4.17'), true);
});

test('the same version, or an unknown version on either side, never reloads', () => {
  assert.equal(needsReload('0.4.16', '0.4.16'), false);
  assert.equal(needsReload(' 0.4.16 ', '0.4.16'), false);
  assert.equal(needsReload('', '0.4.16'), false);
  assert.equal(needsReload(undefined, '0.4.16'), false);
  assert.equal(needsReload(42, '0.4.16'), false);
  assert.equal(needsReload('0.4.16', ''), false);
});
