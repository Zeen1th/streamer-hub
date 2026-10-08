import test from 'node:test';
import assert from 'node:assert/strict';
import { describeChange, serializeSnapshot } from './undoSnapshot.ts';

const seq = (id, name, extra = {}) => ({ id, enabled: true, name, cooldownSeconds: 0, steps: [], triggers: [], ...extra });
const rule = (id, trigger, extra = {}) => ({ id, triggers: [trigger], response: 'hi', enabled: true, cooldownSeconds: 0, matchMode: 'exact', ...extra });
const counter = (id, name, count = 0) => ({ id, name, count, commands: {}, obs: { enabled: false, filePath: '', template: '' } });
const snap = (parts = {}) => ({ sequences: [], rules: [], counters: [], ...parts });

test('a counter that only counted is not a change worth undoing', () => {
  const a = snap({ counters: [counter('c1', 'Deaths', 3)] });
  const b = snap({ counters: [counter('c1', 'Deaths', 4)] });
  assert.equal(serializeSnapshot(a), serializeSnapshot(b));
  const renamed = snap({ counters: [counter('c1', 'Boss deaths', 4)] });
  assert.notEqual(serializeSnapshot(a), serializeSnapshot(renamed));
});

test('describes added, removed and edited things with the item name', () => {
  const base = snap({ sequences: [seq('s1', 'Hydrate')] });
  assert.deepEqual(describeChange(base, snap({ sequences: [seq('s1', 'Hydrate'), seq('s2', 'Raid')] })).label, { kind: 'sequence', action: 'added', name: 'Raid' });
  assert.deepEqual(describeChange(base, snap()).label, { kind: 'sequence', action: 'removed', name: 'Hydrate' });
  const edited = describeChange(base, snap({ sequences: [seq('s1', 'Hydrate', { cooldownSeconds: 30 })] }));
  assert.deepEqual(edited.label, { kind: 'sequence', action: 'edited', name: 'Hydrate' });
  assert.equal(edited.scope, 'sequence:s1');
});

test('a rename is labelled with the name it had before', () => {
  const change = describeChange(snap({ sequences: [seq('s1', 'Hydrate')] }), snap({ sequences: [seq('s1', 'Hydr')] }));
  assert.equal(change.label.name, 'Hydrate');
});

test('replies and counters are described too', () => {
  assert.deepEqual(describeChange(snap(), snap({ rules: [rule('r1', '!socials')] })).label, { kind: 'reply', action: 'added', name: '!socials' });
  assert.deepEqual(describeChange(snap({ counters: [counter('c1', 'Deaths')] }), snap()).label, { kind: 'counter', action: 'removed', name: 'Deaths' });
});

test('edits to different things get different scopes so they are not merged', () => {
  const both = snap({ sequences: [seq('s1', 'A'), seq('s2', 'B')] });
  const one = describeChange(both, snap({ sequences: [seq('s1', 'A', { cooldownSeconds: 5 }), seq('s2', 'B')] }));
  const two = describeChange(both, snap({ sequences: [seq('s1', 'A'), seq('s2', 'B', { cooldownSeconds: 5 })] }));
  assert.notEqual(one.scope, two.scope);
});
