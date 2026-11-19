import test from 'node:test';
import assert from 'node:assert/strict';
import { imageOverlayUrl, imageSlotOf, nextImageSlot, pageShowsImage, usedImageSlots } from './imageSlots.ts';

const seq = (steps) => ({ id: crypto.randomUUID(), name: 's', enabled: true, triggers: [], steps });
const img = (slot) => ({ id: crypto.randomUUID(), type: 'obs_image', imageSlot: slot });

test('a step made before numbered sources shows on the main source', () => {
  assert.equal(imageSlotOf({}), 'main');
  assert.equal(imageSlotOf({ imageSlot: '  ' }), 'main');
  assert.equal(imageSlotOf({ imageSlot: '3' }), '3');
});

test('a new step gets the lowest free number, counting If branches and other sequences', () => {
  assert.equal(nextImageSlot([]), '1');
  const all = [
    seq([img('1'), img(undefined)]),
    seq([{ id: 'if', type: 'if', ifThen: [img('2')], ifElse: [img('4')] }]),
  ];
  assert.deepEqual([...usedImageSlots(all)].sort(), ['1', '2', '4']);
  assert.equal(nextImageSlot(all), '3');
  assert.equal(nextImageSlot(all, ['3']), '5');
});

test('each slot has its own URL; main keeps the old URL', () => {
  assert.equal(imageOverlayUrl(undefined), 'http://127.0.0.1:49178/image-overlay.html');
  assert.equal(imageOverlayUrl('main'), 'http://127.0.0.1:49178/image-overlay.html');
  assert.equal(imageOverlayUrl('2'), 'http://127.0.0.1:49178/image-overlay.html?slot=2');
});

test('a page shows only pictures sent for its own slot', () => {
  assert.equal(pageShowsImage(null, undefined), true);
  assert.equal(pageShowsImage(null, '2'), false);
  assert.equal(pageShowsImage('2', '2'), true);
  assert.equal(pageShowsImage('2', undefined), false);
  assert.equal(pageShowsImage('main', 'main'), true);
});
