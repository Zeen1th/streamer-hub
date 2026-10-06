import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHANGELOG, changelogSince, compareVersions } from './changelog.ts';

test('compareVersions orders dotted versions numerically', () => {
  assert.equal(compareVersions('0.4.10', '0.4.9'), 1);
  assert.equal(compareVersions('0.4.8', '0.4.8'), 0);
  assert.equal(compareVersions('0.4.7', '0.5.0'), -1);
});

test('changelogSince returns everything newer than last seen, up to the running version', () => {
  assert.deepEqual(changelogSince('0.4.7', '0.4.8').map((e) => e.version), ['0.4.8']);
  assert.deepEqual(changelogSince('0.4.5', '0.4.8').map((e) => e.version), ['0.4.8', '0.4.7', '0.4.6']);
  assert.deepEqual(changelogSince('0.4.8', '0.4.8'), []);
  // entries newer than the running build are never shown
  assert.deepEqual(changelogSince('0.4.5', '0.4.6').map((e) => e.version), ['0.4.6']);
});

test('every entry has content in both languages and the list is newest first', () => {
  for (const entry of CHANGELOG) {
    assert.ok(entry.en.added.length + entry.en.fixed.length > 0, `${entry.version} has no English notes`);
    assert.ok(entry.ar.added.length + entry.ar.fixed.length > 0, `${entry.version} has no Arabic notes`);
    assert.equal(entry.en.added.length, entry.ar.added.length, `${entry.version} added bullets differ between languages`);
    assert.equal(entry.en.fixed.length, entry.ar.fixed.length, `${entry.version} fixed bullets differ between languages`);
  }
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.equal(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version), 1);
  }
});

test('the version in package.json has a changelog entry (add one before releasing)', () => {
  const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.ok(CHANGELOG.some((e) => e.version === version), `Add a CHANGELOG entry for ${version} in src/lib/changelog.ts`);
});
