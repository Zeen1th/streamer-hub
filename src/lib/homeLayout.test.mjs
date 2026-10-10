import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LAYOUT,
  LAYOUT_PRESETS,
  WIDGETS,
  normalizeLayout,
  addWidget,
  removeWidget,
  resizeWidget,
  moveWidget,
  nudgeWidget,
  setWidgetConfig,
  availableWidgets,
} from './homeLayout.ts';

const ids = (items) => items.map((i) => i.id);

test('default layout and presets only use known widgets once each, at sizes the widget supports', () => {
  const known = new Set(WIDGETS.map((w) => w.id));
  for (const layout of [DEFAULT_LAYOUT, ...LAYOUT_PRESETS.map((p) => p.items)]) {
    assert.equal(new Set(ids(layout)).size, layout.length);
    for (const i of layout) {
      assert.ok(known.has(i.id), i.id);
      assert.ok(WIDGETS.find((w) => w.id === i.id).sizes.includes(i.size), `${i.id} @ ${i.size}`);
    }
  }
});

test('normalizeLayout drops unknown and duplicate widgets and repairs bad sizes', () => {
  const out = normalizeLayout([
    { id: 'counter', size: 8 },
    { id: 'counter', size: 4 },
    { id: 'nope', size: 4 },
    { id: 'title', size: 5 },
    null,
    { id: 'feed', size: 4, config: { tab: 'x', bad: 3 } },
  ]);
  assert.deepEqual(ids(out), ['counter', 'title', 'feed']);
  assert.equal(out[0].size, 8);
  assert.equal(out[1].size, 4);
  assert.deepEqual(out[2].config, { tab: 'x' });
});

test('normalizeLayout falls back to the default for non-arrays but keeps an empty layout empty', () => {
  assert.deepEqual(ids(normalizeLayout(undefined)), ids(DEFAULT_LAYOUT));
  assert.deepEqual(ids(normalizeLayout('x')), ids(DEFAULT_LAYOUT));
  assert.deepEqual(normalizeLayout([]), []);
});

test('add, remove, resize and configure widgets', () => {
  let items = [{ id: 'counter', size: 6 }];
  items = addWidget(items, 'feed');
  items = addWidget(items, 'feed');
  assert.deepEqual(ids(items), ['counter', 'feed']);
  assert.equal(items[1].size, 4);
  items = resizeWidget(items, 'feed', 8);
  assert.equal(items[1].size, 8);
  items = setWidgetConfig(items, 'feed', { a: '1' });
  items = setWidgetConfig(items, 'feed', { b: '2' });
  assert.deepEqual(items[1].config, { a: '1', b: '2' });
  items = removeWidget(items, 'counter');
  assert.deepEqual(ids(items), ['feed']);
  assert.ok(availableWidgets(items).every((w) => w.id !== 'feed'));
  assert.equal(availableWidgets(items).length, WIDGETS.length - 1);
});

test('move and nudge reorder without losing widgets', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, size: 4 }));
  assert.deepEqual(ids(moveWidget(items, 'd', 'b')), ['a', 'd', 'b', 'c']);
  assert.deepEqual(ids(moveWidget(items, 'a', 'c')), ['b', 'c', 'a', 'd']);
  assert.deepEqual(ids(moveWidget(items, 'a', 'a')), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(nudgeWidget(items, 'b', -1)), ['b', 'a', 'c', 'd']);
  assert.deepEqual(ids(nudgeWidget(items, 'a', -1)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(nudgeWidget(items, 'd', 1)), ['a', 'b', 'c', 'd']);
});
