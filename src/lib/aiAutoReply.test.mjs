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
