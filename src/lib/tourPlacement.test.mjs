import test from 'node:test';
import assert from 'node:assert/strict';
import { placeTourCard } from './tourPlacement.ts';

const viewport = { width: 1200, height: 800 };
const card = { width: 340, height: 200 };

test('no target means the card is centred', () => {
  const p = placeTourCard(null, card, viewport);
  assert.equal(p.side, 'center');
  assert.equal(p.left, (1200 - 340) / 2);
  assert.equal(p.top, (800 - 200) / 2);
});

test('a sidebar item gets the card on its right, lined up with it', () => {
  const p = placeTourCard({ top: 100, left: 10, width: 220, height: 34 }, card, viewport);
  assert.equal(p.side, 'right');
  assert.equal(p.left, 10 + 220 + 16);
  assert.equal(p.top, 100 + 17 - 100, 'centred on the item');
  const nearTop = placeTourCard({ top: 20, left: 10, width: 220, height: 34 }, card, viewport);
  assert.equal(nearTop.top, 12, 'kept on screen when centring would go above the top');
});

test('a target at the right edge gets the card on its left', () => {
  const p = placeTourCard({ top: 300, left: 1000, width: 180, height: 40 }, card, viewport);
  assert.equal(p.side, 'left');
  assert.equal(p.left, 1000 - 16 - 340);
});

test('a full-width bar gets the card below it', () => {
  const p = placeTourCard({ top: 40, left: 0, width: 1200, height: 40 }, card, viewport);
  assert.equal(p.side, 'below');
  assert.equal(p.top, 40 + 40 + 16);
});

test('a target that is off screen falls back to the centre', () => {
  assert.equal(placeTourCard({ top: -500, left: 10, width: 100, height: 30 }, card, viewport).side, 'center');
  assert.equal(placeTourCard({ top: 10, left: 10, width: 0, height: 0 }, card, viewport).side, 'center');
});

test('the card never leaves a small window', () => {
  const small = { width: 300, height: 260 };
  const p = placeTourCard({ top: 100, left: 100, width: 50, height: 30 }, card, small);
  assert.ok(p.left >= 12 && p.top >= 12);
});
