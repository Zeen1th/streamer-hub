import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommand } from './counterRules.ts';

test('parses Arabic counter commands', () => {
  assert.deepEqual(parseCommand('!زد', 'زد'), { argument: '' });
  assert.deepEqual(parseCommand('!انقص 2', 'انقص'), { argument: '2' });
  assert.equal(parseCommand('!زداد', 'زد'), null);
});
