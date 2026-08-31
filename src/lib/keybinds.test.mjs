import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalChord,
  chordConflict,
  chordFromKeyboardEvent,
  bindingAvailability,
} from './keybinds.ts';

test('captures a standalone primary key', () => {
  assert.deepEqual(chordFromKeyboardEvent({ code: 'F8', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false }), { key: 'F8' });
});

test('captures one modifier with one primary key', () => {
  assert.deepEqual(chordFromKeyboardEvent({ code: 'KeyK', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, repeat: false }), { modifier: 'ctrl', key: 'KeyK' });
});

test('rejects modifier-only and three-key chords', () => {
  assert.equal(chordFromKeyboardEvent({ code: 'ControlLeft', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, repeat: false }), null);
  assert.equal(chordFromKeyboardEvent({ code: 'KeyK', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false, repeat: false }), null);
});

test('normalizes equivalent chords for conflict detection', () => {
  assert.equal(canonicalChord({ key: 'KeyK', modifier: 'CTRL' }), 'ctrl+KeyK');
  assert.equal(chordConflict({ key: 'KeyK', modifier: 'ctrl' }, [{ id: 'one', chord: { modifier: 'ctrl', key: 'KeyK' } }]), 'one');
});

test('marks bindings with deleted targets as orphaned', () => {
  const binding = { id: 'b1', targetType: 'counter', targetId: 'missing', action: 'increase', chord: { key: 'F8' }, enabled: true };
  assert.equal(bindingAvailability(binding, [], []), 'orphaned');
});
