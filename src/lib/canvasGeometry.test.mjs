import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SNAP,
  MIN_BLOCK_SIZE,
  clampToCanvas,
  fitScale,
  moveRect,
  nearestAnchor,
  resizeRect,
  screenToCanvas,
  snapRect,
} from './canvasGeometry.ts';

const CANVAS = { width: 1920, height: 1080 };
const rect = (x, y, width = 400, height = 200) => ({ x, y, width, height });

// --- clamping --------------------------------------------------------------

test('keeps a rect inside the canvas without resizing it', () => {
  assert.deepEqual(clampToCanvas(rect(-50, -50), CANVAS), rect(0, 0));
  assert.deepEqual(clampToCanvas(rect(5000, 5000), CANVAS), rect(1520, 880));
});

test('enforces the minimum block size', () => {
  const result = clampToCanvas({ x: 0, y: 0, width: 10, height: 10 }, CANVAS);
  assert.equal(result.width, MIN_BLOCK_SIZE.width);
  assert.equal(result.height, MIN_BLOCK_SIZE.height);
});

// --- moving ----------------------------------------------------------------

test('moves by a delta and clamps at the edge', () => {
  assert.deepEqual(moveRect(rect(100, 100), 50, -30, CANVAS), rect(150, 70));
  assert.deepEqual(moveRect(rect(10, 10), -100, -100, CANVAS), rect(0, 0));
});

// --- snapping --------------------------------------------------------------

test('snaps a near edge to the canvas edge', () => {
  const { rect: snapped, guides } = snapRect(rect(3, 500), CANVAS, DEFAULT_SNAP);
  assert.equal(snapped.x, 0);
  assert.ok(guides.some((g) => g.axis === 'x' && g.position === 0));
});

test('snaps to the safe-area inset', () => {
  const { rect: snapped } = snapRect(rect(45, 500), CANVAS, DEFAULT_SNAP);
  assert.equal(snapped.x, 48);
});

test('snaps the centre of the rect to the centre of the canvas', () => {
  // Centre of a 400-wide rect at x=758 is 958, two px from 960.
  const { rect: snapped } = snapRect(rect(758, 500), CANVAS, DEFAULT_SNAP);
  assert.equal(snapped.x + snapped.width / 2, 960);
});

test('snaps the trailing edge to the far canvas edge', () => {
  const { rect: snapped } = snapRect(rect(1517, 500), CANVAS, DEFAULT_SNAP);
  assert.equal(snapped.x + snapped.width, 1920);
});

test('leaves a rect alone when nothing is within the threshold', () => {
  const original = rect(700, 400);
  const { rect: snapped, guides } = snapRect(original, CANVAS, DEFAULT_SNAP);
  assert.deepEqual(snapped, original);
  assert.deepEqual(guides, []);
});

test('Alt disables snapping entirely', () => {
  const original = rect(3, 3);
  const { rect: snapped, guides } = snapRect(original, CANVAS, { ...DEFAULT_SNAP, disabled: true });
  assert.deepEqual(snapped, original);
  assert.deepEqual(guides, []);
});

test('snaps each axis independently', () => {
  const { guides } = snapRect(rect(3, 3), CANVAS, DEFAULT_SNAP);
  assert.equal(guides.filter((g) => g.axis === 'x').length, 1);
  assert.equal(guides.filter((g) => g.axis === 'y').length, 1);
});

// --- resizing --------------------------------------------------------------

test('resizing east moves only the trailing edge', () => {
  assert.deepEqual(resizeRect(rect(100, 100), 'e', 50, 0, CANVAS), rect(100, 100, 450, 200));
});

test('resizing west holds the trailing edge still', () => {
  const result = resizeRect(rect(100, 100), 'w', 50, 0, CANVAS);
  assert.equal(result.x, 150);
  assert.equal(result.width, 350);
  assert.equal(result.x + result.width, 500, 'the right edge did not move');
});

test('resizing north holds the bottom edge still', () => {
  const result = resizeRect(rect(100, 100), 'n', 0, 40, CANVAS);
  assert.equal(result.y, 140);
  assert.equal(result.y + result.height, 300);
});

test('corner handles resize on both axes', () => {
  assert.deepEqual(resizeRect(rect(100, 100), 'se', 60, 40, CANVAS), rect(100, 100, 460, 240));
});

test('dragging a handle past itself pins to the minimum instead of inverting', () => {
  const result = resizeRect(rect(100, 100), 'w', 9999, 0, CANVAS);
  assert.equal(result.width, MIN_BLOCK_SIZE.width);
  assert.ok(result.width > 0, 'width never goes negative');
  assert.equal(result.x + result.width, 500, 'the anchored edge stays put');
});

test('resizing north past itself pins to the minimum height', () => {
  const result = resizeRect(rect(100, 100), 'n', 0, 9999, CANVAS);
  assert.equal(result.height, MIN_BLOCK_SIZE.height);
  assert.equal(result.y + result.height, 300);
});

// --- coordinate conversion -------------------------------------------------

test('converts screen coordinates into canvas space at a given scale', () => {
  assert.deepEqual(screenToCanvas({ x: 200, y: 150 }, { left: 100, top: 50 }, 0.5), { x: 200, y: 200 });
});

test('a zero or negative scale falls back to 1 rather than dividing by zero', () => {
  assert.deepEqual(screenToCanvas({ x: 10, y: 10 }, { left: 0, top: 0 }, 0), { x: 10, y: 10 });
});

// --- fitting ---------------------------------------------------------------

test('fits the canvas to the smaller viewport axis and never enlarges', () => {
  assert.equal(fitScale({ width: 960, height: 1080 }, CANVAS), 0.5);
  assert.equal(fitScale({ width: 3840, height: 2160 }, CANVAS), 1, 'capped at 1:1');
  assert.equal(fitScale({ width: 0, height: 0 }, CANVAS), 1);
});

// --- anchors ---------------------------------------------------------------

test('reports the corner the block sits nearest', () => {
  assert.equal(nearestAnchor(rect(0, 0), CANVAS), 'top-left');
  assert.equal(nearestAnchor(rect(1500, 0), CANVAS), 'top-right');
  assert.equal(nearestAnchor(rect(0, 850), CANVAS), 'bottom-left');
  assert.equal(nearestAnchor(rect(1500, 850), CANVAS), 'bottom-right');
});
