import test from 'node:test';
import assert from 'node:assert/strict';
import { SUB_ACTIONS, SUB_ACTION_CATEGORIES, groupSubActions } from './subActionCatalog.ts';

const ALL_STEP_TYPES = [
  'chat', 'counter', 'command', 'wait', 'moderation', 'comment', 'sound', 'tts', 'obs_text', 'obs_image',
  'obs_clip', 'clip_create', 'duel', 'duel_streamer', 'poll', 'mic_mute', 'if', 'run_sequence',
];

test('every sub-action type can be added from the catalog, and ids are unique', () => {
  const types = new Set(SUB_ACTIONS.map((a) => a.type));
  for (const type of ALL_STEP_TYPES) assert.ok(types.has(type), `${type} is missing from the catalog`);
  assert.equal(new Set(SUB_ACTIONS.map((a) => a.id)).size, SUB_ACTIONS.length);
});

test('every entry has a known category and text in both languages', () => {
  const known = new Set(SUB_ACTION_CATEGORIES.map((c) => c.id));
  for (const a of SUB_ACTIONS) {
    assert.ok(known.has(a.category), `${a.id}: unknown category`);
    assert.ok(a.en.label && a.en.desc && a.ar.label && a.ar.desc, `${a.id}: missing text`);
  }
});

test('an empty search shows every category in order; a search keeps only matches', () => {
  const all = groupSubActions('');
  assert.deepEqual(all.map((g) => g.category.id), ['twitch', 'moderation', 'audio', 'screen', 'games', 'flow', 'counters', 'notes']);
  assert.equal(all.reduce((n, g) => n + g.items.length, 0), SUB_ACTIONS.length);

  const clips = groupSubActions('clip');
  assert.deepEqual(clips.flatMap((g) => g.items.map((i) => i.id)).sort(), ['clip_create', 'obs_clip']);
  assert.deepEqual(groupSubActions('ban').flatMap((g) => g.items.map((i) => i.id)).includes('moderation'), true);
  assert.deepEqual(groupSubActions('nothing-matches-this'), []);
  // Arabic and category names are searchable too
  assert.ok(groupSubActions('عدّاد').length > 0);
  assert.deepEqual(groupSubActions('moderation').map((g) => g.category.id), ['moderation']);
});
