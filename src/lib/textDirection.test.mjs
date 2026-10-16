import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldDir } from './textDirection.ts';

test('Arabic typing is right-to-left, even after a token', () => {
  assert.equal(fieldDir('شكراً على المتابعه  {mention} اسمتع معنا'), 'rtl');
  assert.equal(fieldDir('{mention} شكراً'), 'rtl');
  assert.equal(fieldDir('  😀 {username} مرحبا'), 'rtl');
});

test('English typing stays left-to-right', () => {
  assert.equal(fieldDir('Thanks for following {mention}'), 'ltr');
  assert.equal(fieldDir('{mention} thanks شكراً'), 'ltr');
  assert.equal(fieldDir('C:\\sounds\\hi.mp3'), 'ltr');
});

test('a field with no letters yet uses the fallback', () => {
  assert.equal(fieldDir(''), undefined);
  assert.equal(fieldDir('{mention} 123', 'rtl'), 'rtl');
  assert.equal(fieldDir(undefined, 'ltr'), 'ltr');
});
