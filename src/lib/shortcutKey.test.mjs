import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutKey } from './shortcutKey.ts';

test('a Latin letter is used as typed, so AZERTY and Dvorak still follow the printed key', () => {
  assert.equal(shortcutKey({ key: 'z', code: 'KeyZ' }), 'z');
  assert.equal(shortcutKey({ key: 'Z', code: 'KeyZ' }), 'z');
  assert.equal(shortcutKey({ key: 'z', code: 'KeyW' }), 'z'); // AZERTY: the key printed Z sits where QWERTY has W
});

test('with an Arabic layout the physical key decides', () => {
  assert.equal(shortcutKey({ key: 'ئ', code: 'KeyZ' }), 'z');
  assert.equal(shortcutKey({ key: 'ؤ', code: 'KeyY' }), 'y');
  assert.equal(shortcutKey({ key: '٠', code: 'Digit0' }), '0');
  assert.equal(shortcutKey({ key: '=', code: 'Equal' }), '=');
  assert.equal(shortcutKey({ key: 'ـ', code: 'Equal' }), '=');
  assert.equal(shortcutKey({ key: 'ـ', code: 'Minus' }), '-');
});

test('named keys and unknown characters pass through', () => {
  assert.equal(shortcutKey({ key: 'Escape', code: 'Escape' }), 'Escape');
  assert.equal(shortcutKey({ key: 'ArrowUp' }), 'ArrowUp');
  assert.equal(shortcutKey({ key: 'ئ' }), 'ئ');
});
