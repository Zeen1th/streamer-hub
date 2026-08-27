import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEmoteProviders, tokenizeMessage } from './chatEmotes.ts';

const text = (tokens) => tokens.filter((t) => t.type === 'text').map((t) => t.value).join('');
const emotes = (tokens) => tokens.filter((t) => t.type === 'emote').map((t) => t.name);

test('returns nothing for empty input', () => {
  assert.deepEqual(tokenizeMessage('', [], {}), { tokens: [], emoteOnly: false });
  assert.deepEqual(tokenizeMessage(null, [], {}), { tokens: [], emoteOnly: false });
});

test('leaves a plain message as a single text run', () => {
  const { tokens, emoteOnly } = tokenizeMessage('hello there', [], {});
  assert.deepEqual(tokens, [{ type: 'text', value: 'hello there' }]);
  assert.equal(emoteOnly, false);
});

test('slices a Twitch emote out by its range', () => {
  const { tokens } = tokenizeMessage('hey Kappa there', [{ id: '25', start: 4, end: 8 }], {});
  assert.deepEqual(emotes(tokens), ['Kappa']);
  assert.equal(text(tokens), 'hey  there');
  assert.match(tokens.find((t) => t.type === 'emote').url, /emoticons\/v2\/25\/default\/dark\/3\.0$/);
});

/**
 * The regression this whole module is most likely to hit. Twitch counts emote
 * positions in CODE POINTS; an astral-plane emoji occupies two UTF-16 code
 * units, so naive string indexing shifts every following range by one and the
 * emote comes out sliced through the middle.
 */
test('honours code-point offsets when an astral emoji precedes the emote', () => {
  const message = '\u{1F600} Kappa';
  // [...message] => ['\u{1F600}', ' ', 'K','a','p','p','a'] so Kappa is 2..6.
  assert.equal([...message].length, 7);
  assert.equal(message.length, 8, 'the emoji is two UTF-16 code units');

  const { tokens, emoteOnly } = tokenizeMessage(message, [{ id: '25', start: 2, end: 6 }], {});

  assert.deepEqual(emotes(tokens), ['Kappa'], 'the emote name is sliced intact');
  assert.equal(text(tokens), '\u{1F600} ');
  assert.equal(emoteOnly, false, 'the emoji is still visible text');
});

test('handles several emotes and preserves surrounding text', () => {
  const { tokens } = tokenizeMessage(
    'Kappa mid Kappa',
    [
      { id: '25', start: 0, end: 4 },
      { id: '25', start: 10, end: 14 },
    ],
    {},
  );
  assert.deepEqual(emotes(tokens), ['Kappa', 'Kappa']);
  assert.equal(text(tokens), ' mid ');
});

test('detects an emote-only message', () => {
  const { emoteOnly } = tokenizeMessage(
    'Kappa Kappa',
    [
      { id: '25', start: 0, end: 4 },
      { id: '25', start: 6, end: 10 },
    ],
    {},
  );
  assert.equal(emoteOnly, true);
});

test('drops overlapping and out-of-bounds ranges rather than scrambling output', () => {
  const { tokens } = tokenizeMessage(
    'Kappa',
    [
      { id: '25', start: 0, end: 4 },
      { id: '99', start: 2, end: 4 },
      { id: '98', start: 40, end: 44 },
    ],
    {},
  );
  assert.deepEqual(emotes(tokens), ['Kappa']);
});

test('ignores Twitch ranges when Twitch emotes are disabled', () => {
  const { tokens } = tokenizeMessage('Kappa', [{ id: '25', start: 0, end: 4 }], {}, { twitch: false });
  assert.deepEqual(tokens, [{ type: 'text', value: 'Kappa' }]);
});

test('matches third-party emotes on whole words only', () => {
  const map = { catJAM: 'https://cdn.test/catjam.webp' };
  const matched = tokenizeMessage('vibing catJAM now', [], map);
  assert.deepEqual(emotes(matched.tokens), ['catJAM']);

  const notMatched = tokenizeMessage('catJAMMER', [], map);
  assert.deepEqual(emotes(notMatched.tokens), []);
});

test('preserves original spacing around third-party emotes', () => {
  const { tokens } = tokenizeMessage('a  catJAM  b', [], { catJAM: 'u' });
  assert.equal(tokens.map((t) => (t.type === 'emote' ? t.name : t.value)).join(''), 'a  catJAM  b');
});

test('third-party matching does not run inside a Twitch emote name', () => {
  const { tokens } = tokenizeMessage('Kappa', [{ id: '25', start: 0, end: 4 }], { Kappa: 'https://evil.test/x' });
  const emote = tokens.find((t) => t.type === 'emote');
  assert.match(emote.url, /jtvnw\.net/, 'the Twitch range wins for text it already claimed');
});

test('is not confused by inherited Object properties', () => {
  const { tokens } = tokenizeMessage('constructor toString', [], {});
  assert.deepEqual(emotes(tokens), [], 'prototype keys are not treated as emotes');
});

test('merges only the enabled providers, later ones winning ties', () => {
  const providers = {
    bttv: { a: 'bttv-a', shared: 'bttv-shared' },
    ffz: { b: 'ffz-b' },
    sevenTv: { shared: 'seventv-shared' },
  };

  const all = mergeEmoteProviders(providers, { bttv: true, ffz: true, sevenTv: true });
  assert.equal(all.a, 'bttv-a');
  assert.equal(all.b, 'ffz-b');
  assert.equal(all.shared, 'seventv-shared');

  const only = mergeEmoteProviders(providers, { bttv: true, ffz: false, sevenTv: false });
  assert.deepEqual(Object.keys(only).sort(), ['a', 'shared']);

  assert.deepEqual(mergeEmoteProviders(undefined, { bttv: true, ffz: true, sevenTv: true }), {});
});
