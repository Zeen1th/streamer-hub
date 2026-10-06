import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_UPDATE_RETRY_AFTER_MS, decideAutoUpdate } from './autoUpdate.ts';

const base = {
  enabled: true,
  updateAvailable: true,
  downloadUrl: 'https://github.com/x/y/releases/download/v1/setup.exe',
  latestVersion: '1.2.0',
  trigger: 'startup',
  lastAttempt: null,
  declinedVersion: null,
  now: 1_000_000,
};

test('installs soon when found at startup, defers when found mid-session', () => {
  assert.equal(decideAutoUpdate(base), 'install_soon');
  assert.equal(decideAutoUpdate({ ...base, trigger: 'periodic' }), 'defer');
});

test('does nothing when disabled, up to date, or there is no installer', () => {
  assert.equal(decideAutoUpdate({ ...base, enabled: false }), 'none');
  assert.equal(decideAutoUpdate({ ...base, updateAvailable: false }), 'none');
  assert.equal(decideAutoUpdate({ ...base, downloadUrl: null }), 'none');
});

test('respects a cancelled update for this session', () => {
  assert.equal(decideAutoUpdate({ ...base, declinedVersion: '1.2.0' }), 'none');
  assert.equal(decideAutoUpdate({ ...base, declinedVersion: '1.1.0' }), 'install_soon');
});

test('does not loop on a version whose install already ran recently', () => {
  const recent = { version: '1.2.0', at: base.now - 60_000 };
  assert.equal(decideAutoUpdate({ ...base, lastAttempt: recent }), 'none');
  const old = { version: '1.2.0', at: base.now - AUTO_UPDATE_RETRY_AFTER_MS - 1 };
  assert.equal(decideAutoUpdate({ ...base, lastAttempt: old }), 'install_soon');
  const other = { version: '1.1.0', at: base.now - 60_000 };
  assert.equal(decideAutoUpdate({ ...base, lastAttempt: other }), 'install_soon');
});
