import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { createDebugUpdateState } from './updateDebug.ts';

test('creates a test update prompt from a downloadable release', () => {
  const state = {
    currentVersion: '0.2.5',
    latestVersion: '0.2.5',
    updateAvailable: false,
    releaseUrl: 'https://github.com/Zeen1th/streamer-hub/releases/latest',
    downloadUrl: 'https://github.com/Zeen1th/streamer-hub/releases/download/v0.2.5/StreamerHub-Setup-v0.2.5.exe',
    releaseNotes: 'Latest release',
  };

  const simulated = createDebugUpdateState(state);

  assert.equal(simulated?.updateAvailable, true);
  assert.equal(simulated?.downloadUrl, state.downloadUrl);
  assert.equal(simulated?.latestVersion, state.latestVersion);
  assert.match(simulated?.releaseNotes ?? '', /test/i);
});

test('does not create a test prompt without an installer URL', () => {
  const state = {
    currentVersion: '0.2.5',
    latestVersion: '0.2.5',
    updateAvailable: false,
    releaseUrl: 'https://github.com/Zeen1th/streamer-hub/releases/latest',
  };

  assert.equal(createDebugUpdateState(state), null);
});

test('update popup is excluded from titlebar window dragging', () => {
  const sourcePath = path.join(process.cwd(), 'src/components/titlebar/Titlebar.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.match(source, /<section[^>]*data-drag-exclude[^>]*aria-label=/s);
});
