import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTargetUsername,
  replaceSequenceTokens,
  executeSequence,
} from './sequenceRunner.ts';

test('extractTargetUsername properly strips @, #, !, and punctuation', () => {
  assert.equal(extractTargetUsername('@basil'), 'basil');
  assert.equal(extractTargetUsername('@@basil'), 'basil');
  assert.equal(extractTargetUsername('@basil, timeout 60s'), 'basil');
  assert.equal(extractTargetUsername('basil'), 'basil');
  assert.equal(extractTargetUsername('#gamer'), 'gamer');
  assert.equal(extractTargetUsername('!moduser'), 'moduser');
  assert.equal(extractTargetUsername('@cool_user:'), 'cool_user');
  assert.equal(extractTargetUsername(''), '');
  assert.equal(extractTargetUsername(undefined), '');
});

test('replaceSequenceTokens replaces {target} and {target_user} from userInput', () => {
  const ctx = {
    username: 'Zein',
    userInput: '@badguy 30s reason',
    source: 'channel_points',
  };

  const text = 'Target is {target} and also {target_user}, ordered by {username}';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Target is badguy and also badguy, ordered by Zein');
});

test('replaceSequenceTokens defaults {target} to kirin_x_ when userInput is empty', () => {
  const ctx = {
    username: 'Zein',
    userInput: '',
    source: 'channel_points',
  };

  const text = 'Target is {target} and also {target_user}, ordered by {username}';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Target is kirin_x_ and also kirin_x_, ordered by Zein');
});

test('executeSequence runs smart_timeout moderation step and invokes sink', async () => {
  const actionsCalled = [];
  const logs = [];

  const sequence = {
    id: 'seq-smart-timeout',
    enabled: true,
    name: 'Smart Mod Timeout',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 120,
        reason: 'Redeemed by {username}',
      },
    ],
  };

  const ctx = {
    username: 'Viewer123',
    userInput: '@basil',
    source: 'channel_points',
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async (action, target, durationSeconds, reason) => {
      actionsCalled.push({ action, target, durationSeconds, reason });
      return { ok: true, wasMod: true };
    },
    log: (kind, msg) => logs.push({ kind, msg }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 1);
  assert.equal(actionsCalled.length, 1);
  assert.equal(actionsCalled[0].action, 'smart_timeout');
  assert.equal(actionsCalled[0].target, 'basil');
  assert.equal(actionsCalled[0].durationSeconds, 120);
  assert.equal(actionsCalled[0].reason, 'Redeemed by Viewer123');

  // Verify mod notice logged
  const modNotice = logs.find((l) => l.msg.includes('Note: basil is a mod'));
  assert.ok(modNotice, 'Expected note that user was a mod and will be re-modded');
});

test('executeSequence skips moderation when targetUser is explicitly empty string (except clear_chat)', async () => {
  const actionsCalled = [];

  const sequence = {
    id: 'seq-empty-target',
    enabled: true,
    name: 'Timeout No Target',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'timeout',
        targetUser: '',
        durationSeconds: 60,
      },
    ],
  };

  const ctx = {
    username: 'Viewer123',
    userInput: '',
    source: 'channel_points',
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async (action, target, durationSeconds, reason) => {
      actionsCalled.push({ action, target, durationSeconds, reason });
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 1);
  assert.equal(actionsCalled.length, 0, 'Should not call action if target is empty');
});

test('executeSequence defaults timeout target to kirin_x_ when input is empty', async () => {
  const actionsCalled = [];

  const sequence = {
    id: 'seq-default-target',
    enabled: true,
    name: 'Timeout Default Kirin',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 60,
      },
    ],
  };

  const ctx = {
    username: 'Viewer123',
    userInput: '',
    source: 'channel_points',
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async (action, target, durationSeconds, reason) => {
      actionsCalled.push({ action, target, durationSeconds, reason });
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 1);
  assert.equal(actionsCalled.length, 1);
  assert.equal(actionsCalled[0].target, 'kirin_x_');
});

test('executeSequence executes clear_chat without target user', async () => {
  const actionsCalled = [];

  const sequence = {
    id: 'seq-clear',
    enabled: true,
    name: 'Nuke Chat',
    triggerType: 'chat',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'clear_chat',
      },
    ],
  };

  const ctx = {
    username: 'Streamer',
    source: 'chat',
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async (action, target, durationSeconds, reason) => {
      actionsCalled.push({ action, target, durationSeconds, reason });
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 1);
  assert.equal(actionsCalled.length, 1);
  assert.equal(actionsCalled[0].action, 'clear_chat');
});
