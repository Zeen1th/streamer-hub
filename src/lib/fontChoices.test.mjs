import assert from 'node:assert/strict';
import test from 'node:test';
import { matchInstalledFontFamily, normalizeInstalledFontFamilies } from './fontChoices.ts';

test('normalizes the installed font list for a stable searchable picker', () => {
  assert.deepEqual(
    normalizeInstalledFontFamilies([' Inter ', 'Arial', '', 'arial', 'Cairo']),
    ['Arial', 'Cairo', 'Inter'],
  );
});

test('resolves a typed font name to the installed family casing', () => {
  const fonts = ['Arial', 'Cairo', 'Inter'];
  assert.equal(matchInstalledFontFamily(' inter ', fonts), 'Inter');
  assert.equal(matchInstalledFontFamily('Missing Font', fonts), null);
});
