import test from 'node:test';
import assert from 'node:assert/strict';
import { UndoHistory } from './undoHistory.ts';

const make = () => {
  const h = new UndoHistory({ equals: (a, b) => a === b, mergeWindowMs: 1000 });
  h.reset('A');
  return h;
};

test('undo and redo walk back and forward through recorded states', () => {
  const h = make();
  h.record('B', 'x', 'to B', 0);
  h.record('C', 'y', 'to C', 5_000);
  assert.equal(h.current, 'C');
  assert.equal(h.undo().snapshot, 'B');
  assert.equal(h.current, 'B');
  assert.equal(h.undo().snapshot, 'A');
  assert.equal(h.undo(), null);
  assert.equal(h.redo().snapshot, 'B');
  assert.equal(h.redo().snapshot, 'C');
  assert.equal(h.redo(), null);
});

test('a new change after undoing clears the redo stack', () => {
  const h = make();
  h.record('B', 'x', 'B', 0);
  h.undo();
  assert.equal(h.canRedo, true);
  h.record('Z', 'x', 'Z', 10_000);
  assert.equal(h.canRedo, false);
  assert.equal(h.undo().snapshot, 'A');
});

test('identical states are not recorded', () => {
  const h = make();
  assert.equal(h.record('A', 'x', 'noop', 0), false);
  assert.equal(h.canUndo, false);
});

test('quick edits to the same thing merge into one undo step; other things do not', () => {
  const h = make();
  h.record('B', 'seq:1', 'typing', 0);
  h.record('C', 'seq:1', 'typing', 300);
  h.record('D', 'seq:1', 'typing', 600);
  h.record('E', 'seq:2', 'other', 700);
  assert.equal(h.undo().snapshot, 'D'); // seq:2 change undone alone
  assert.equal(h.undo().snapshot, 'A'); // the whole seq:1 burst at once
  assert.equal(h.canUndo, false);
});

test('edits to the same thing after the merge window are separate steps', () => {
  const h = make();
  h.record('B', 'seq:1', 'a', 0);
  h.record('C', 'seq:1', 'b', 2_000);
  assert.equal(h.undo().snapshot, 'B');
  assert.equal(h.undo().snapshot, 'A');
});

test('history is capped', () => {
  const h = new UndoHistory({ equals: (a, b) => a === b, limit: 3, mergeWindowMs: 0 });
  h.reset(0);
  for (let i = 1; i <= 10; i++) h.record(i, `s${i}`, i, i * 10_000);
  let steps = 0;
  while (h.undo()) steps++;
  assert.equal(steps, 3);
});
