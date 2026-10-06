import test from 'node:test';
import assert from 'node:assert/strict';
import { attachedGameIndex, insertIndexForIf, moveStepBlock, reorderStepBlock, stepBlock } from './stepGroups.ts';

const s = (id, type, extra = {}) => ({ id, type, ...extra });
const ids = (steps) => steps.map((x) => x.id).join(',');

// chat, duel, if1, if2, wait, tts
const base = [s('chat', 'chat'), s('duel', 'duel'), s('if1', 'if'), s('if2', 'if'), s('wait', 'wait'), s('tts', 'tts')];

test('an If directly under a game is attached to it', () => {
  assert.equal(attachedGameIndex(base, 2), 1);
  assert.equal(attachedGameIndex(base, 3), 1);
  assert.equal(attachedGameIndex(base, 1), -1);
  const detached = [s('duel', 'duel'), s('wait', 'wait'), s('if', 'if')];
  assert.equal(attachedGameIndex(detached, 2), -1);
  assert.deepEqual(stepBlock(base, 1), [1, 3]);
  assert.deepEqual(stepBlock(base, 0), [0, 0]);
});

test('poll reset is not a game', () => {
  const steps = [s('p', 'poll', { pollAction: 'reset' }), s('if', 'if')];
  assert.equal(attachedGameIndex(steps, 1), -1);
});

test('new Ifs snap under the nearest game, after its existing Ifs', () => {
  assert.equal(insertIndexForIf(base), 4);
  assert.equal(insertIndexForIf([s('chat', 'chat'), s('wait', 'wait')]), 2);
  assert.equal(insertIndexForIf([s('duel', 'duel'), s('wait', 'wait')]), 1);
});

test('moving a game carries its attached Ifs', () => {
  assert.equal(ids(moveStepBlock(base, 1, 'up')), 'duel,if1,if2,chat,wait,tts');
  assert.equal(ids(moveStepBlock(base, 1, 'down')), 'chat,wait,duel,if1,if2,tts');
});

test('other steps jump over a whole game block, and an attached If moves alone', () => {
  assert.equal(ids(moveStepBlock(base, 4, 'up')), 'chat,wait,duel,if1,if2,tts');
  assert.equal(ids(moveStepBlock(base, 0, 'down')), 'duel,if1,if2,chat,wait,tts');
  assert.equal(ids(moveStepBlock(base, 3, 'down')), 'chat,duel,if1,wait,if2,tts');
});

test('drag reorder keeps a game and its Ifs together', () => {
  assert.equal(ids(reorderStepBlock(base, 1, 5)), 'chat,wait,tts,duel,if1,if2');
  assert.equal(ids(reorderStepBlock(base, 1, 0)), 'duel,if1,if2,chat,wait,tts');
  assert.equal(ids(reorderStepBlock(base, 5, 1)), 'chat,tts,duel,if1,if2,wait');
  assert.equal(ids(reorderStepBlock(base, 1, 2)), ids(base)); // dropping onto its own Ifs does nothing
});
