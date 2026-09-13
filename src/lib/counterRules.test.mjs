import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCounterPattern, parseCommand, renderTemplate, stripCounterFromTitle } from './counterRules.ts';

test('parses Arabic counter commands', () => {
  assert.deepEqual(parseCommand('!زد', 'زد'), { argument: '' });
  assert.deepEqual(parseCommand('!انقص 2', 'انقص'), { argument: '2' });
  assert.equal(parseCommand('!زداد', 'زد'), null);
});

test('renders counter title templates', () => {
  assert.equal(renderTemplate('Deaths: {count}', 7, null), 'Deaths: 7');
  assert.equal(renderTemplate('{title} | [Deaths: {count}]', 1, null, 'Playing Sekiro'), 'Playing Sekiro | [Deaths: 1]');
});

test('extracts base title and avoids title compounding with OBS/Twitch updates', () => {
  const template = '{title} | [Deaths: {count}]';
  const liveTitle = 'Playing Sekiro | [Deaths: 5]';
  const rendered = renderTemplate(template, 6, null, liveTitle);
  assert.equal(rendered, 'Playing Sekiro | [Deaths: 6]');

  const obsManualTitle = '🔴 Chill Sekiro Stream | [Deaths: 5]';
  const updated = renderTemplate(template, 6, null, obsManualTitle);
  assert.equal(updated, '🔴 Chill Sekiro Stream | [Deaths: 6]');
});

test('handles middle {title} tokens without compounding', () => {
  const template = '🔴 [Live] {title} | Streak: {count} | !discord';
  const liveTitle = '🔴 [Live] Chill Elden Ring | Streak: 3 | !discord';
  const next = renderTemplate(template, 4, null, liveTitle);
  assert.equal(next, '🔴 [Live] Chill Elden Ring | Streak: 4 | !discord');
});

test('preserves reasonable manual title changes made during streak tracking', () => {
  const template = '{title} | Streak: {count}';

  // 1. Streamer updates base title while keeping streak
  const manualTitleWithStreak = 'Apex Legends (Solo Q) | Streak: 4';
  const updated1 = renderTemplate(template, 5, null, manualTitleWithStreak);
  assert.equal(updated1, 'Apex Legends (Solo Q) | Streak: 5');

  // 2. Streamer manually changes stream title to a completely different game/topic
  const manualNewGame = 'Chilling in Minecraft with viewers';
  const updated2 = renderTemplate(template, 5, null, manualNewGame);
  assert.equal(updated2, 'Chilling in Minecraft with viewers | Streak: 5');

  // 3. Middle token template preserves manual change
  const middleTemplate = '🎮 {title} · Streak: {count}';
  const manualMiddle = '🎮 Tekken 8 Ranked · Streak: 3';
  const updated3 = renderTemplate(middleTemplate, 4, null, manualMiddle);
  assert.equal(updated3, '🎮 Tekken 8 Ranked · Streak: 4');
});

test('heals previously compounded titles from bugged templates', () => {
  const template = '{title} | [Streak: {count}]';
  const corrupted = 'Playing Sekiro | [Streak: 1] | [Streak: 2] | [Streak: 3]';
  const healed = renderTemplate(template, 4, null, corrupted);
  assert.equal(healed, 'Playing Sekiro | [Streak: 4]');
});

test('survives 10 consecutive increments without any compounding', () => {
  const template = '🔴 [Live] {title} | [Wins: {count}] | !rank';
  let live = 'My Awesome Stream';
  for (let count = 1; count <= 10; count++) {
    live = renderTemplate(template, count, null, live);
  }
  assert.equal(live, '🔴 [Live] My Awesome Stream | [Wins: 10] | !rank');
});

test('detects when streamer is still using counter vs done using counter', () => {
  const template = '{title} | Streak: {count}';

  // Still using counter (contains Streak: \d+)
  assert.equal(hasCounterPattern('Playing Tekken 8 | Streak: 5', template), true);
  assert.equal(hasCounterPattern('Tekken Ranked · Streak: 0', template), true);
  assert.equal(hasCounterPattern('Apex Legends [Streak: 12]', template), true);

  // Done using counter: streamer changed title manually to something else
  assert.equal(hasCounterPattern('Just Chatting with chat', template), false);
  assert.equal(hasCounterPattern('Playing Minecraft with friends', template), false);
  assert.equal(hasCounterPattern('Playing Elden Ring | Deaths: 3', template), false);
});

test('strips counter cleanly when streamer stops using it', () => {
  const template = '{title} | [Streak: {count}]';
  const live = 'Playing Sekiro | [Streak: 5]';
  assert.equal(stripCounterFromTitle(live, template), 'Playing Sekiro');

  const template2 = '🔴 {title} - Wins: {count}';
  const live2 = '🔴 Chill Stream - Wins: 10';
  assert.equal(stripCounterFromTitle(live2, template2), 'Chill Stream');

  // When live title doesn't have counter, keeps the title clean
  assert.equal(stripCounterFromTitle('Just Chatting', template), 'Just Chatting');
});
