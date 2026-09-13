import assert from 'node:assert/strict';
import test from 'node:test';
import { clampInspectorWidth, clampMenuPosition, DEFAULT_INSPECTOR_WIDTH, filterCommands, MAX_INSPECTOR_WIDTH, MIN_INSPECTOR_WIDTH, projectCommands, selectionAfterClick } from './commandProjection.ts';

const counter = {
  id: 'counter-1',
  name: 'Deaths',
  count: 12,
  commands: {
    increase: { commandName: 'death', permission: 'everyone', cooldownSeconds: 5 },
    decrease: { commandName: 'deathdown', permission: 'mod', cooldownSeconds: 0 },
    reset: { commandName: 'deathreset', permission: 'broadcaster', cooldownSeconds: 0 },
  },
  obs: { enabled: true, filePath: 'C:/stream/deaths.txt', template: 'Deaths: {count}' },
  titleEnabled: true,
  titleTemplate: '{title} | [Deaths: {count}]',
};

const preparedReply = {
  id: 'reply-1',
  triggers: ['discord'],
  response: 'discord.gg/example',
  enabled: false,
  cooldownSeconds: 10,
  matchMode: 'exact',
  responseMode: 'static',
};

const aiReply = {
  ...preparedReply,
  id: 'reply-2',
  triggers: ['كيف الحال'],
  enabled: true,
  matchMode: 'contains',
  responseMode: 'ai',
  aiInstructions: 'Reply briefly',
};

test('projects each counter and each reply into command rows', () => {
  const seq = {
    id: 'seq-1',
    enabled: true,
    name: 'Hydrate Stack',
    triggerType: 'channel_points',
    rewardTitle: 'Drink Water',
    cooldownSeconds: 20,
    steps: [{ id: 's1', type: 'chat', chatMessage: 'Drink!' }],
  };

  const rows = projectCommands({
    counters: [counter],
    replies: [preparedReply, aiReply],
    sequences: [seq],
    counterLastTriggeredAt: { 'counter-1': { increase: 1_700_000_000_000 } },
    replyLastTriggeredAt: { 'reply-2': 1_700_000_010_000 },
    sequenceLastTriggeredAt: { 'seq-1': 1_700_000_020_000 },
    obsErrors: {},
  });

  assert.equal(rows.length, 4);
  assert.equal(rows[0].id, 'counter:counter-1');
  assert.equal(rows[0].command, 'death');
  assert.equal(rows[0].description, 'Deaths');
  assert.equal(rows[0].count, 12);
  assert.deepEqual(rows[0].subCommands, ['death', 'deathdown', 'deathreset']);
  assert.deepEqual(rows[0].writes, ['file', 'title']);
  assert.equal(rows[0].literalFileOutput, 'Deaths: 12');
  assert.equal(rows[1].enabled, false);
  assert.equal(rows[1].group, 'replies');
  assert.equal(rows[2].group, 'ai');
  assert.equal(rows[2].command, 'كيف الحال');
  assert.equal(rows[3].id, 'sequence:seq-1');
  assert.equal(rows[3].group, 'sequences');
  assert.equal(rows[3].command, '🪙 Drink Water');
  assert.equal(rows[3].sequenceStepCount, 1);
});

test('filters by group and by command or description or sub-command text', () => {
  const rows = projectCommands({ counters: [counter], replies: [preparedReply, aiReply], obsErrors: {} });
  assert.equal(filterCommands(rows, 'disabled', '').length, 1);
  assert.equal(filterCommands(rows, 'counters', 'deathreset').length, 1);
  assert.equal(filterCommands(rows, 'counters', 'Deaths').length, 1);
  assert.equal(filterCommands(rows, 'ai', 'كيف').length, 1);
  assert.equal(filterCommands(rows, 'all', 'missing').length, 0);
});

test('plain selection replaces while modified selection toggles', () => {
  assert.deepEqual(selectionAfterClick(['a'], 'b', false), ['b']);
  assert.deepEqual(selectionAfterClick(['a'], 'b', true), ['a', 'b']);
  assert.deepEqual(selectionAfterClick(['a', 'b'], 'a', true), ['b']);
});

test('clamps context menus inside the viewport', () => {
  assert.deepEqual(clampMenuPosition(1270, 890, 1280, 900), { x: 1090, y: 690 });
  assert.deepEqual(clampMenuPosition(24, 30, 1280, 900), { x: 24, y: 30 });
});

test('clamps inspector width within static and dynamic limits', () => {
  assert.equal(clampInspectorWidth(MIN_INSPECTOR_WIDTH - 50), MIN_INSPECTOR_WIDTH);
  assert.equal(clampInspectorWidth(MAX_INSPECTOR_WIDTH + 100), MAX_INSPECTOR_WIDTH);
  assert.equal(clampInspectorWidth(350), 350);
  assert.equal(clampInspectorWidth(Number.NaN), DEFAULT_INSPECTOR_WIDTH);

  // When container is 800px wide, reserved is 186 + 320 = 506. Max allowable is 800 - 506 = 294.
  assert.equal(clampInspectorWidth(400, 800), 294);
  // When container is very small, it never drops below MIN_INSPECTOR_WIDTH
  assert.equal(clampInspectorWidth(300, 400), MIN_INSPECTOR_WIDTH);
});

