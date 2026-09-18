import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiPrompt, selectFallback, truncateChatText } from './aiAutoReply.ts';

const message = { username: 'viewer', message: 'عادي العب' };

test('builds a bounded prompt from the matched message', () => {
  const prompt = buildAiPrompt('Be funny', message);
  assert.match(prompt, /Be funny/);
  assert.match(prompt, /عادي العب/);
  assert.doesNotMatch(prompt, /chat history/i);
});

test('truncates oversized input', () => assert.equal(truncateChatText('abcdef', 3), 'abc'));

test('uses a non-empty generated response before fallback', () => {
  assert.equal(selectFallback('  hello  ', 'fallback'), 'hello');
  assert.equal(selectFallback('', 'fallback'), 'fallback');
  assert.equal(selectFallback(null, '  '), null);
});

test('builds prompt with agent persona, role, channel, and stream lore', () => {
  const prompt = buildAiPrompt('Keep replies under 20 words', message, {
    agentName: 'Kiko',
    agentRole: 'Sarcastic co-host',
    streamerChannel: 'Zeen1th',
    agentContext: 'Lore: We love souls games and coffee.',
  });
  assert.match(prompt, /Agent Persona: You are Kiko, Sarcastic co-host/);
  assert.match(prompt, /Stream: Live in Zeen1th's channel/);
  assert.match(prompt, /Stream Lore & Facts:\nLore: We love souls games and coffee\./);
  assert.match(prompt, /Keep replies under 20 words/);
  assert.match(prompt, /Viewer username: viewer/);
  assert.match(prompt, /Viewer message: عادي العب/);
});
