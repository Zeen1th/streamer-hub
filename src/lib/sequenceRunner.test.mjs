import test from 'node:test';
import assert from 'node:assert/strict';
import {
  replaceSequenceTokens,
  calculateWaitMs,
  isSequenceOnCooldown,
  matchesSequenceTrigger,
  executeSequence,
} from './sequenceRunner.ts';

test('replaceSequenceTokens replaces username, mention, and input', () => {
  const ctx = {
    username: 'Basil',
    userInput: 'water please',
    source: 'channel_points',
  };

  const text = 'Hello {username}! {mention} said: "{input}" ({user})';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Hello Basil! @Basil said: "water please" (Basil)');
});

test('calculateWaitMs correctly computes seconds and minutes', () => {
  assert.equal(calculateWaitMs(5, 'seconds'), 5000);
  assert.equal(calculateWaitMs(2, 'minutes'), 120000);
  assert.equal(calculateWaitMs(0.5, 'minutes'), 30000);
  assert.equal(calculateWaitMs(0, 'seconds'), 0);
  assert.equal(calculateWaitMs(undefined, 'seconds'), 0);
});

test('isSequenceOnCooldown checks remaining cooldown time', () => {
  const seq = {
    id: 'seq-1',
    enabled: true,
    name: 'Hydrate',
    triggerType: 'channel_points',
    cooldownSeconds: 30,
    steps: [],
  };

  const now = 100000;
  // Last run 10s ago -> on cooldown
  assert.equal(isSequenceOnCooldown(seq, now - 10000, now), true);
  // Last run 35s ago -> not on cooldown
  assert.equal(isSequenceOnCooldown(seq, now - 35000, now), false);
  // Never run -> not on cooldown
  assert.equal(isSequenceOnCooldown(seq, undefined, now), false);
});

test('matchesSequenceTrigger checks channel points reward ID and title', () => {
  const seq = {
    id: 'seq-1',
    enabled: true,
    name: 'Hydrate Stack',
    triggerType: 'channel_points',
    rewardId: 'rew-123-abc',
    rewardTitle: 'Hydrate 🥤',
    cooldownSeconds: 0,
    steps: [],
  };

  // Match by ID
  assert.equal(matchesSequenceTrigger(seq, { customRewardId: 'rew-123-abc' }), true);
  // Match by Title (case insensitive)
  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'hydrate 🥤' }), true);
  // Mismatch ID and Title
  assert.equal(matchesSequenceTrigger(seq, { customRewardId: 'other-id' }), false);
  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'Different Reward' }), false);

  // When disabled, never matches
  assert.equal(matchesSequenceTrigger({ ...seq, enabled: false }, { customRewardId: 'rew-123-abc' }), false);
});

test('matchesSequenceTrigger checks chat command', () => {
  const seq = {
    id: 'seq-2',
    enabled: true,
    name: 'Chat Macro',
    triggerType: 'chat',
    chatTrigger: '!hydrate',
    cooldownSeconds: 0,
    steps: [],
  };

  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrate' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrate extra params' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrated' }), false);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: 'hello !hydrate' }), false);
});

test('matchesSequenceTrigger supports both channel points and chat triggers', () => {
  const seq = {
    id: 'seq-3',
    enabled: true,
    name: 'Hybrid Trigger',
    triggerType: 'both',
    rewardTitle: 'Drink Water',
    chatTrigger: '!water',
    cooldownSeconds: 0,
    steps: [],
  };

  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'Drink Water' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!water' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!other' }), false);
});

test('executeSequence runs steps in stack order and invokes sinks', async () => {
  const seq = {
    id: 'seq-hydrate',
    enabled: true,
    name: 'Water Stack',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      { id: 's1', type: 'chat', chatMessage: 'Drinking water for {username}!' },
      { id: 's2', type: 'wait', waitDuration: 2, waitUnit: 'seconds' },
      { id: 's3', type: 'counter', counterId: 'cnt-water', counterAction: 'increase' },
      { id: 's4', type: 'command', commandTrigger: '!sound water' },
    ],
  };

  const chatMessages = [];
  const counterActions = [];
  const commandsRun = [];
  const delays = [];
  const startedSteps = [];
  const completedSteps = [];

  const result = await executeSequence(
    seq,
    { username: 'StreamViewer', source: 'channel_points' },
    {
      sendChatMessage: async (msg) => { chatMessages.push(msg); return true; },
      executeCounterAction: async (id, act) => { counterActions.push({ id, act }); },
      executeCommand: async (cmd) => { commandsRun.push(cmd); },
      delay: async (ms) => { delays.push(ms); },
      onStepStart: (idx, step) => { startedSteps.push({ idx, id: step.id }); },
      onStepComplete: (idx, step) => { completedSteps.push({ idx, id: step.id }); },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 4);

  assert.deepEqual(chatMessages, ['Drinking water for StreamViewer!']);
  assert.deepEqual(delays, [2000]);
  assert.deepEqual(counterActions, [{ id: 'cnt-water', act: 'increase' }]);
  assert.deepEqual(commandsRun, ['!sound water']);

  assert.equal(startedSteps.length, 4);
  assert.equal(completedSteps.length, 4);
  assert.equal(startedSteps[0].id, 's1');
  assert.equal(startedSteps[1].id, 's2');
  assert.equal(startedSteps[2].id, 's3');
  assert.equal(startedSteps[3].id, 's4');
});
