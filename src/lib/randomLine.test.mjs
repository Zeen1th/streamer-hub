import test from 'node:test';
import assert from 'node:assert/strict';
import { LineDeck, linesFromText } from './randomLine.ts';

test('a list or text file gives its non-empty trimmed lines', () => {
  assert.deepEqual(linesFromText('  سؤال 1 \r\n\nWhat is your main?\n   \n'), ['سؤال 1', 'What is your main?']);
  assert.deepEqual(linesFromText(''), []);
});

test('no line repeats until every line has been sent once', () => {
  const deck = new LineDeck();
  const lines = ['a', 'b', 'c', 'd'];
  const round = Array.from({ length: 4 }, () => deck.next('step', lines));
  assert.deepEqual([...round].sort(), lines);
});

test('a new round never starts with the line that ended the last one', () => {
  for (let seed = 0; seed < 20; seed++) {
    const deck = new LineDeck(() => (seed % 10) / 10);
    const lines = ['a', 'b', 'c'];
    const first = [deck.next('s', lines), deck.next('s', lines), deck.next('s', lines)];
    assert.notEqual(deck.next('s', lines), first[2]);
  }
});

test('each step has its own deck, and editing the list starts over', () => {
  const deck = new LineDeck(() => 0);
  assert.equal(deck.next('one', ['x', 'y']), 'x');
  assert.equal(deck.next('two', ['x', 'y']), 'x');
  assert.equal(deck.next('one', ['q']), 'q');
  assert.equal(deck.next('one', []), null);
});
