import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, computeAssist, recentChatters } from './chatInputAssist.ts';

const ctx = {
  users: ['Alice', 'bob_the_builder', 'Bobby', 'carol'],
  emotes: { KEKW: 'k.webp', Kappa: 'kappa.webp', Clap: 'clap.webp', peepoHappy: 'p.webp' },
  lang: 'en',
};

test('typing a slash lists matching commands, aliases included', () => {
  const r = computeAssist('/t', ctx);
  assert.deepEqual(r.suggestions.map((s) => s.insert), ['/timeout ']);
  assert.deepEqual(computeAssist('/so', ctx).suggestions.map((s) => s.insert), ['/shoutout ']);
  assert.ok(computeAssist('/', ctx).suggestions.length >= 8);
  assert.equal(computeAssist('/zzz', ctx), null);
  assert.equal(computeAssist('//wave', ctx), null);
});

test('commands that need no user are inserted without a trailing space', () => {
  assert.deepEqual(computeAssist('/cl', ctx).suggestions.map((s) => s.insert), ['/clear']);
});

test('after a user-taking command, viewer names are suggested (prefix first)', () => {
  const r = computeAssist('/timeout bo', ctx);
  assert.deepEqual(r.suggestions.map((s) => s.insert), ['bob_the_builder ', 'Bobby ']);
  assert.equal(computeAssist('/clear bo', ctx), null);
  assert.equal(computeAssist('/timeout bob 10m', ctx), null);
  assert.deepEqual(computeAssist('/ban @ali', ctx).suggestions.map((s) => s.insert), ['Alice ']);
});

test('@ in normal text suggests viewers and keeps the @', () => {
  const r = computeAssist('hey @ca', ctx);
  assert.deepEqual(r.suggestions.map((s) => s.insert), ['@carol ']);
  assert.equal(r.replaceStart, 4);
});

test('a colon suggests emotes once three characters are typed', () => {
  assert.equal(computeAssist('hello :k', ctx), null);
  const r = computeAssist('hello :kek', ctx);
  assert.deepEqual(r.suggestions.map((s) => s.label), ['KEKW']);
  assert.equal(r.suggestions[0].imageUrl, 'k.webp');
  assert.deepEqual(computeAssist(':hap', ctx).suggestions.map((s) => s.label), ['peepoHappy']); // matches inside the name
});

test('applying a suggestion replaces only the typed part and moves the caret', () => {
  const value = 'hello :kek';
  const result = computeAssist(value, ctx);
  const applied = applySuggestion(value, result, result.suggestions[0]);
  assert.equal(applied.value, 'hello KEKW ');
  assert.equal(applied.caret, applied.value.length);

  const cmd = '/timeout bo';
  const r2 = computeAssist(cmd, ctx);
  assert.equal(applySuggestion(cmd, r2, r2.suggestions[0]).value, '/timeout bob_the_builder ');
});

test('recent chatters are distinct and newest first', () => {
  const messages = [{ username: 'a' }, { username: 'B' }, { username: 'a' }, { username: 'c' }];
  assert.deepEqual(recentChatters(messages), ['c', 'a', 'B']);
});
