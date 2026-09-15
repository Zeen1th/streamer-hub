import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArabicText,
  normalizeChatterIdentifier,
  chatterIdentifiersMatch,
  parseChatterList,
} from './chatterNormalization.ts';

test('normalizeArabicText normalizes alefs, tashkeel, and suffixes', () => {
  // Alef variants
  assert.equal(normalizeArabicText('أحمد'), 'احمد');
  assert.equal(normalizeArabicText('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeArabicText('آدم'), 'ادم');

  // Tashkeel removal
  assert.equal(normalizeArabicText('مُحَمَّدٌ'), 'محمد');

  // Taa marbuta and alif maqsura
  assert.equal(normalizeArabicText('فاطمة'), 'فاطمه');
  assert.equal(normalizeArabicText('منى'), 'مني');
});

test('normalizeChatterIdentifier normalizes case, @, and Arabic', () => {
  assert.equal(normalizeChatterIdentifier('@StreamerFan'), 'streamerfan');
  assert.equal(normalizeChatterIdentifier('  @أَحْمَد  '), 'احمد');
  assert.equal(normalizeChatterIdentifier('12345678'), '12345678');
});

test('chatterIdentifiersMatch matches across Arabic, English casing, and IDs', () => {
  // English case-insensitive
  assert.equal(chatterIdentifiersMatch('Streamer', 'streamer'), true);
  assert.equal(chatterIdentifiersMatch('@Streamer', 'STREAMER'), true);
  assert.equal(chatterIdentifiersMatch('Streamer1', 'Streamer2'), false);

  // Numeric ID
  assert.equal(chatterIdentifiersMatch('12345678', '12345678'), true);
  assert.equal(chatterIdentifiersMatch('@12345678', '12345678'), true);

  // Arabic spelling variations
  assert.equal(chatterIdentifiersMatch('أحمد', 'احمد'), true);
  assert.equal(chatterIdentifiersMatch('@أَحْمَد', 'أحمد'), true);
  assert.equal(chatterIdentifiersMatch('سارة', 'ساره'), true);
  assert.equal(chatterIdentifiersMatch('علي', 'علي'), true);
  assert.equal(chatterIdentifiersMatch('أحمد', 'محمد'), false);
});

test('parseChatterList parses comma, space, newline, and semicolon separated lists', () => {
  const input = '@user1, @user2; user3\n@user4\tuser5   أحمد,  @احمد';
  const parsed = parseChatterList(input);
  // 'أحمد' and '@احمد' normalize to the same Arabic name, so duplicate is deduplicated
  assert.deepEqual(parsed, ['user1', 'user2', 'user3', 'user4', 'user5', 'أحمد']);
});
