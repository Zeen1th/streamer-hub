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
});
