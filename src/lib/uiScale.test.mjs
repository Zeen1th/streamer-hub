import assert from 'node:assert/strict';
import test from 'node:test';
import { autoScaleFor, baseAutoScale } from './uiScale.ts';

test('base scale follows monitor height', () => {
  assert.equal(baseAutoScale(3840, 2160), 1.35);
  assert.equal(baseAutoScale(2560, 1440), 1.25);
  assert.equal(baseAutoScale(1920, 1080), 1.0);
  assert.equal(baseAutoScale(2560, 1080), 1.0); // ultrawide 1080p is not scaled up
  assert.equal(baseAutoScale(1366, 768), 0.9);
});

test('maximized or large windows get the full monitor scale', () => {
  assert.equal(autoScaleFor(2560, 1440, 2560), 1.25);
  assert.equal(autoScaleFor(2560, 1440, 1920), 1.25);
});

test('small windows are capped so layout keeps ~1100 CSS px', () => {
  // 1280 / 1100 = 1.16 -> floored to 1.15
  assert.equal(autoScaleFor(2560, 1440, 1280), 1.15);
  // never below 1.0 on a big monitor
  assert.equal(autoScaleFor(2560, 1440, 960), 1.0);
});

test('small monitors keep their reduced scale', () => {
  assert.equal(autoScaleFor(1366, 768, 1280), 0.9);
});
