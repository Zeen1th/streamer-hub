import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarterProfile } from './starterProfile.ts';

const TRIGGER_TYPES = ['twitch_raid', 'twitch_chat', 'twitch_channel_points', 'twitch_follow', 'twitch_watch_streak', 'timer'];

for (const language of ['en', 'ar']) {
  test(`Starter (${language}) holds the seven items, each ready to fire`, () => {
    const p = buildStarterProfile(language);
    assert.equal(p.name, language === 'ar' ? 'البداية' : 'Starter');
    assert.equal(p.counters.length, 1);
    assert.equal(p.autoReplies.length, 3);
    assert.equal(p.sequences.length, 5);
    assert.equal(p.keybinds.length, 0);

    // every sequence has a valid trigger and at least one step
    for (const seq of p.sequences) {
      assert.ok(seq.name.length > 0);
      assert.ok(seq.steps.length > 0, seq.name);
      assert.ok(seq.triggers.length > 0, seq.name);
      for (const t of seq.triggers) {
        assert.ok(TRIGGER_TYPES.includes(t.type));
        assert.equal(t.enabled, true);
        if (t.type === 'twitch_chat') assert.match(t.chatCommand, /^![a-z]+$/);
        if (t.type === 'timer') assert.equal(t.intervalMinutes, 30);
      }
    }

    const byCommand = (c) => p.sequences.find((s) => s.triggers.some((t) => t.chatCommand === c));
    const clip = byCommand('!clip');
    assert.deepEqual(clip.steps.map((s) => s.type), ['clip_create']);
    assert.ok(clip.steps[0].clipAnnounceMessage.includes('{clip_url}'));

    const so = byCommand('!so');
    assert.deepEqual(so.steps.map((s) => s.type), ['chat', 'obs_clip']);
    assert.ok(so.steps[0].chatMessage.includes('{target}'));
    assert.equal(so.steps[1].clipChannel, '{target}');
    assert.equal(so.steps[1].clipSkipWho, undefined, 'default skip settings');

    const raid = p.sequences.find((s) => s.triggers.some((t) => t.type === 'twitch_raid'));
    assert.deepEqual(raid.steps.map((s) => s.type), ['chat', 'obs_clip']);
    assert.ok(raid.steps[0].chatMessage.includes('{raider}'));
    assert.equal(raid.steps[1].clipChannel, '{raider}');

    assert.deepEqual(byCommand('!duel').steps.map((s) => s.type), ['duel']);

    const hydrate = p.sequences.find((s) => s.triggers.some((t) => t.type === 'timer'));
    assert.deepEqual(hydrate.steps.map((s) => s.type), ['chat']);

    const death = p.counters[0];
    assert.equal(death.commands.increase.commandName, 'death');
    assert.equal(death.commands.set.enabled, true);
    assert.equal(death.commands.set.permission, 'mod');
    assert.notEqual(death.commands.set.commandName, death.commands.increase.commandName);

    assert.deepEqual(p.autoReplies.map((r) => r.triggers[0]), ['!discord', '!socials', '!schedule']);
    for (const r of p.autoReplies) {
      assert.equal(r.responseMode, 'static');
      assert.equal(r.responseEnabled, true);
      assert.ok(r.response.length > 0);
    }
  });
}

test('Starter text follows the language and ids are fresh on every build', () => {
  const en = buildStarterProfile('en');
  const ar = buildStarterProfile('ar');
  assert.notEqual(en.autoReplies[0].response, ar.autoReplies[0].response);
  assert.match(ar.autoReplies[0].response, /[؀-ۿ]/);
  assert.notEqual(en.counters[0].id, buildStarterProfile('en').counters[0].id);
  const ids = [...en.sequences.map((s) => s.id), ...en.sequences.flatMap((s) => s.steps.map((x) => x.id)), ...en.autoReplies.map((r) => r.id)];
  assert.equal(new Set(ids).size, ids.length);
});
