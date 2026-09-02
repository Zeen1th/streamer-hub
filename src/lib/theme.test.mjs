import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTheme } from './theme.ts';

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
    '--surface: #1b1817',
    '--surface-2: #141112',
    '--ink: #ece8e5',
    '--accent: #ff5436',
    '--accent-deep: #ff8f79',
    '--on-accent: #16100e',
  ]) assert.equal(css.includes(token), true, token);
});
