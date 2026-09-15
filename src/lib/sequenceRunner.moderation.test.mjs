import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCommandArguments,
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

test('replaceSequenceTokens replaces {target} with empty string when userInput is empty', () => {
  const ctx = {
    username: 'Zein',
    userInput: '',
    source: 'channel_points',
  };

  const text = 'Target is {target} and also {target_user}, ordered by {username}';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Target is  and also , ordered by Zein');
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

test('executeSequence halts moderation when targetUser is explicitly empty string (except clear_chat)', async () => {
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

  assert.equal(result.ok, false);
  assert.equal(result.executedSteps, 0);
  assert.equal(actionsCalled.length, 0, 'Should not call action if target is empty');
  assert.match(result.error || '', /empty target username/i);
});

test('executeSequence halts moderation step when input is empty and targetUser is {input}', async () => {
  const actionsCalled = [];

  const sequence = {
    id: 'seq-empty-input',
    enabled: true,
    name: 'Timeout With Empty Input',
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

  assert.equal(result.ok, false);
  assert.equal(result.executedSteps, 0);
  assert.equal(actionsCalled.length, 0, 'Should not call action when target is empty');
  assert.match(result.error || '', /empty target username/i);
});

test('executeSequence times out custom provided targetUser in test context', async () => {
  const actionsCalled = [];

  const sequence = {
    id: 'seq-custom-target',
    enabled: true,
    name: 'Timeout Custom Target',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 120,
      },
    ],
  };

  const ctx = {
    username: 'Streamer',
    userInput: '@some_custom_user',
    source: 'test',
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
  assert.equal(actionsCalled[0].target, 'some_custom_user');
  assert.equal(actionsCalled[0].durationSeconds, 120);
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

test('extractCommandArguments strips trigger cleanly from chat messages', () => {
  assert.equal(extractCommandArguments('!timeout @kirin_x_', '!timeout'), '@kirin_x_');
  assert.equal(extractCommandArguments('!TIMEOUT  @kirin_x_ 60', '!timeout'), '@kirin_x_ 60');
  assert.equal(extractCommandArguments('!timeout', '!timeout'), '');
  assert.equal(extractCommandArguments('!timeout   ', '!timeout'), '');
  assert.equal(extractCommandArguments('bonk @viewer reason', 'bonk'), '@viewer reason');
  assert.equal(extractCommandArguments('unrelated message', '!timeout'), 'unrelated message');
});

test('chat command sequence with arguments correctly isolates target instead of command name', async () => {
  const actionsCalled = [];
  const chatsSent = [];

  const sequence = {
    id: 'seq-chat-timeout',
    enabled: true,
    name: 'Bonk Command',
    triggerType: 'chat',
    chatTrigger: '!bonk',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'smart_timeout',
        targetUser: '{input}',
        durationSeconds: 30,
        reason: 'Bonked by {username}',
      },
      {
        id: 'step-2',
        type: 'chat',
        chatMessage: 'Bonked @{target} for 30s!',
      },
    ],
  };

  // Simulating message: "!bonk @spammer 30s"
  const rawChat = '!bonk @spammer 30s';
  const args = extractCommandArguments(rawChat, sequence.chatTrigger);
  assert.equal(args, '@spammer 30s');

  const ctx = {
    username: 'ModUser',
    source: 'chat',
    userInput: args,
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async (action, target, durationSeconds, reason) => {
      actionsCalled.push({ action, target, durationSeconds, reason });
      return { ok: true, wasMod: false };
    },
    sendChatMessage: async (msg) => {
      chatsSent.push(msg);
      return true;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 2);
  assert.equal(actionsCalled.length, 1);
  assert.equal(actionsCalled[0].target, 'spammer', 'Target MUST be spammer, not bonk!');
  assert.equal(chatsSent.length, 1);
  assert.equal(chatsSent[0], 'Bonked @spammer for 30s!');
});

test('sequence execution halts when moderation action fails and does NOT execute subsequent chat message', async () => {
  const chatsSent = [];
  const logs = [];

  const sequence = {
    id: 'seq-fail-test',
    enabled: true,
    name: 'Self Timeout Attempt',
    triggerType: 'chat',
    chatTrigger: '!timeout',
    cooldownSeconds: 0,
    steps: [
      {
        id: 'step-1',
        type: 'moderation',
        moderationAction: 'timeout',
        targetUser: '{input}',
        durationSeconds: 60,
      },
      {
        id: 'step-2',
        type: 'chat',
        chatMessage: '✅ @{target} has been timed out!',
      },
    ],
  };

  const ctx = {
    username: 'Broadcaster',
    source: 'chat',
    userInput: '@Broadcaster',
  };

  const result = await executeSequence(sequence, ctx, {
    executeModerationAction: async () => {
      return { ok: false, error: 'CANNOT_TIMEOUT_BROADCASTER' };
    },
    sendChatMessage: async (msg) => {
      chatsSent.push(msg);
      return true;
    },
    log: (kind, msg) => logs.push({ kind, msg }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.executedSteps, 0);
  assert.equal(chatsSent.length, 0, 'Subsequent chat message MUST NOT be sent when moderation fails');
  assert.match(result.error || '', /Cannot timeout or ban the channel broadcaster/i);
});
