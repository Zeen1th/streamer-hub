import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommand, renderTemplate } from './counterRules.ts';

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
