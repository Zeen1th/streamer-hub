import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native window frame and WebView loading surface stay chromatically neutral', async () => {
  const source = await readFile(new URL('./MainForm.cs', import.meta.url), 'utf8');
  const assignments = [...source.matchAll(/(?:BackColor|DefaultBackgroundColor)\s*=\s*Color\.FromArgb\(([^)]+)\)/g)];

  assert.equal(assignments.length, 2, 'expected native frame and WebView background assignments');

  for (const [, channels] of assignments) {
    const [red, green, blue] = channels.split(',').map((value) => Number(value.trim()));
    assert.equal(red, green, `red/green mismatch in ${channels}`);
    assert.equal(green, blue, `green/blue mismatch in ${channels}`);
  }
});
