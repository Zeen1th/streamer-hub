import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTheme, resolveTheme, skinFor, THEME_OPTIONS } from './theme.ts';

test('only Dark and Fluent are offered; older saved themes map onto them', () => {
  assert.deepEqual(THEME_OPTIONS.map((o) => o.id), ['dark', 'fluent']);
  assert.equal(normalizeTheme('fluent'), 'fluent');
  assert.equal(normalizeTheme('ember'), 'fluent');
  for (const old of ['light', 'system', 'graphite', null, undefined, 'dark']) assert.equal(normalizeTheme(old), 'dark');
  assert.equal(skinFor('fluent'), 'fluent');
  assert.equal(skinFor('dark'), 'default');
});

test('resolves system preference and explicit overrides', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('keeps the approved light and dark command-sheet tokens intact', async () => {
  const css = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../index.css', import.meta.url), 'utf8'));
  for (const token of [
    '--surface: #f3f2f2',
    '--surface-2: #e8e7e5',
    '--ink: #201e1d',
    '--accent: #ec3013',
    '--accent-text: #ae1800',
    '--accent-fill: #d62608',
    '--on-accent: #faf9f8',
    '--surface: #23282e',
    '--surface-2: #1a2228',
    '--surface-3: #2e3438',
    '--ink: #f0f3f7',
    '--accent: #6366f1',
    '--accent-deep: #4f46e5',
    '--on-accent: #ffffff',
  ]) assert.equal(css.includes(token), true, token);
});


