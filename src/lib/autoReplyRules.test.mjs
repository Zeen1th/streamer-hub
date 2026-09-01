import assert from 'node:assert/strict';
import test from 'node:test';
import { cooldownRemainingSeconds, directionFromStart, insertReplyToken, insertTemplateToken, matchesAnyAutoReply, matchesAutoReply, renderAutoReply, renderStreamTitle, nextTitleCounters, titleActionDirection } from './autoReplyRules.ts';

test('matches trimmed Unicode text exactly', () => {
  assert.equal(matchesAutoReply('  السلام عليكم  ', 'السلام عليكم'), true);
  assert.equal(matchesAutoReply('السلام عليكم ورحمة الله', 'السلام عليكم'), false);
});

test('reports only active cooldown seconds', () => {
  assert.equal(cooldownRemainingSeconds(15_000, 10_000, 10), 5);
  assert.equal(cooldownRemainingSeconds(21_000, 10_000, 10), null);
  assert.equal(cooldownRemainingSeconds(15_000, null, 10), null);
});

test('supports starts-with and contains matching modes', () => {
  assert.equal(matchesAutoReply('السلام عليكم يا جماعة', 'السلام عليكم', 'startsWith'), true);
  assert.equal(matchesAutoReply('يا السلام عليكم يا جماعة', 'السلام عليكم', 'startsWith'), false);
  assert.equal(matchesAutoReply('رد السلام عليكم من فضلك', 'السلام عليكم', 'contains'), true);
});

test('renders viewer placeholders', () => {
  assert.equal(
    renderAutoReply('@{username} · {mention} · {message}', { username: 'viewer', message: 'hello' }),
    '@viewer · @viewer · hello',
  );
});

test('renders the stream title counter placeholder', () => {
  assert.equal(renderStreamTitle('BG3 act {count1} · part {count2}', { count1: 200, count2: 4 }), 'BG3 act 200 · part 4');
});

test('inserts a dragged placeholder at the saved cursor position', () => {
  assert.equal(insertTemplateToken('Hello world', '{mention}', 6), 'Hello {mention}world');
  assert.equal(insertTemplateToken('Hello world', '{mention}', null), 'Hello world{mention}');
});

test('inserts a prepared-response token at the text selection and places the caret after it', () => {
  assert.deepEqual(insertReplyToken('Hello viewer', '{mention}', 6, 12), {
    value: 'Hello {mention}',
    caret: 15,
  });
  assert.deepEqual(insertReplyToken('Hello', '{message}', null, null), {
    value: 'Hello{message}',
    caret: 14,
  });
});

test('sets direction from the first non-space character', () => {
  assert.equal(directionFromStart('  السلام عليكم'), 'rtl');
  assert.equal(directionFromStart('  Hello السلام'), 'ltr');
  assert.equal(directionFromStart(''), 'ltr');
});

test('matches when any configured trigger matches', () => {
  assert.equal(matchesAnyAutoReply('سلام عليكم', ['السلام عليكم', 'سلام عليكم'], 'exact'), true);
  assert.equal(matchesAnyAutoReply('مرحبا', ['السلام عليكم', 'سلام عليكم'], 'exact'), false);
});

test('advances title counters before rendering command results', () => {
  const counters = [{ id: 'count1', start: 1, count: 4 }, { id: 'count2', start: 10, count: 12 }];
  assert.deepEqual(nextTitleCounters(counters, 'increase'), [
    { id: 'count1', start: 1, count: 5 },
    { id: 'count2', start: 10, count: 13 },
  ]);
  assert.deepEqual(nextTitleCounters(counters, 'decrease'), [
    { id: 'count1', start: 1, count: 3 },
    { id: 'count2', start: 10, count: 11 },
  ]);
});

test('selects increase and decrease title commands independently', () => {
  assert.equal(titleActionDirection('next', 'next', 'previous', 'exact'), 'increase');
  assert.equal(titleActionDirection('previous', 'next', 'previous', 'exact'), 'decrease');
  assert.equal(titleActionDirection('next', '', '', 'exact'), null);
  assert.equal(titleActionDirection('other', 'next', 'previous', 'exact'), null);
  assert.equal(titleActionDirection('count down', 'count', 'count down', 'contains'), null);
});
