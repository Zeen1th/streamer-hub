import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChatFilters,
  containsBlockedWord,
  maskBlockedWords,
  matchesAnyPattern,
} from './chatOverlayFilters.ts';
import { createDefaultChatOverlaySettings } from './chatOverlay.ts';

function filters(overrides = {}) {
  return { ...createDefaultChatOverlaySettings().filters, hideBots: false, ...overrides };
}

const msg = (username, message) => ({ username, message });

test('passes an ordinary message through unchanged', () => {
  const result = applyChatFilters(msg('viewer', 'hello there'), filters());
  assert.deepEqual(result, { visible: true, message: 'hello there' });
});

// --- username patterns -----------------------------------------------------

test('matches usernames case-insensitively and exactly', () => {
  assert.equal(matchesAnyPattern('SpamBot', ['spambot']), true);
  assert.equal(matchesAnyPattern('spambot', ['SPAMBOT']), true);
  assert.equal(matchesAnyPattern('spambot01', ['spambot']), false);
});

test('supports a trailing wildcard for prefix matching', () => {
  assert.equal(matchesAnyPattern('spambot01', ['spam*']), true);
  assert.equal(matchesAnyPattern('spam', ['spam*']), true);
  assert.equal(matchesAnyPattern('notspam', ['spam*']), false);
});

test('a bare asterisk is a no-op rather than blocking everyone', () => {
  assert.equal(matchesAnyPattern('anybody', ['*']), false);
});

test('ignores empty patterns and empty usernames', () => {
  assert.equal(matchesAnyPattern('viewer', ['', '   ']), false);
  assert.equal(matchesAnyPattern('', ['viewer']), false);
  assert.equal(matchesAnyPattern('viewer', []), false);
});

test('blocks a listed username', () => {
  const result = applyChatFilters(msg('SpamBot', 'buy followers'), filters({ blockedUsernames: ['spambot'] }));
  assert.deepEqual(result, { visible: false, reason: 'blocked-username' });
});

// --- bots ------------------------------------------------------------------

test('hides known bots only when the toggle is on', () => {
  const list = { botList: ['nightbot'] };
  assert.equal(applyChatFilters(msg('Nightbot', 'hi'), filters({ ...list, hideBots: false })).visible, true);
  assert.deepEqual(
    applyChatFilters(msg('Nightbot', 'hi'), filters({ ...list, hideBots: true })),
    { visible: false, reason: 'bot' },
  );
});

// --- commands --------------------------------------------------------------

test('hides commands including ones with leading whitespace', () => {
  const f = filters({ hideCommands: true });
  assert.equal(applyChatFilters(msg('v', '!deaths'), f).visible, false);
  assert.equal(applyChatFilters(msg('v', '   !deaths'), f).visible, false);
  assert.equal(applyChatFilters(msg('v', 'not !a command'), f).visible, true);
});

// --- length ----------------------------------------------------------------

test('drops messages below the minimum length, ignoring surrounding whitespace', () => {
  const f = filters({ minLength: 3 });
  assert.deepEqual(applyChatFilters(msg('v', 'ok'), f), { visible: false, reason: 'too-short' });
  assert.equal(applyChatFilters(msg('v', '  yes  '), f).visible, true);
});

test('a minimum length of zero disables the check', () => {
  assert.equal(applyChatFilters(msg('v', ''), filters({ minLength: 0 })).visible, true);
});

// --- blocked words ---------------------------------------------------------

test('matches blocked words on whole words only', () => {
  assert.equal(containsBlockedWord('what a scam', ['scam']), true);
  assert.equal(containsBlockedWord('SCAM in caps', ['scam']), true);
  assert.equal(containsBlockedWord('scamper along', ['scam']), false);
  assert.equal(containsBlockedWord('a scam.', ['scam']), true, 'punctuation is a word boundary');
});

test('word boundaries work for Arabic, where \\b would not', () => {
  assert.equal(containsBlockedWord('هذا سيء جدا', ['سيء']), true);
  assert.equal(containsBlockedWord('كلمة أخرى', ['سيء']), false);
});

test('treats regex metacharacters in a blocked word literally', () => {
  assert.equal(containsBlockedWord('anything at all', ['.*']), false);
  assert.equal(containsBlockedWord('cost is c++ here', ['c++']), true);
});

test('drops the message when the action is drop', () => {
  const result = applyChatFilters(msg('v', 'what a scam'), filters({ blockedWords: ['scam'] }));
  assert.deepEqual(result, { visible: false, reason: 'blocked-word' });
});

test('masks the word and preserves its length when the action is mask', () => {
  const f = filters({ blockedWords: ['scam'], blockedWordAction: 'mask' });
  const result = applyChatFilters(msg('v', 'what a scam here'), f);
  assert.deepEqual(result, { visible: true, message: 'what a **** here' });
});

test('masking counts code points, not UTF-16 units', () => {
  // A four-code-unit, two-code-point word must mask to two asterisks.
  const word = '\u{1F600}\u{1F600}';
  assert.equal(word.length, 4);
  assert.equal(maskBlockedWords(word, [word]), '**');
});

test('masking leaves everything else untouched', () => {
  assert.equal(maskBlockedWords('clean sentence', ['scam']), 'clean sentence');
  assert.equal(maskBlockedWords('a scam and a scam', ['scam']), 'a **** and a ****');
});

// --- ordering --------------------------------------------------------------

test('a blocked username wins over every other rule', () => {
  const result = applyChatFilters(
    msg('spambot', '!command'),
    filters({ blockedUsernames: ['spambot'], hideCommands: true }),
  );
  assert.equal(result.reason, 'blocked-username');
});

test('handles missing fields without throwing', () => {
  assert.equal(applyChatFilters({}, filters()).visible, true);
  assert.equal(applyChatFilters({ username: null, message: undefined }, filters()).visible, true);
});
