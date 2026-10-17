import test from 'node:test';
import assert from 'node:assert/strict';
import { chatMessageMatchesTrigger, triggerChatCommands } from './triggerCommands.ts';

test('a trigger made before multi-command support still has its one command', () => {
  assert.deepEqual(triggerChatCommands({ chatCommand: '!so' }), ['!so']);
  assert.deepEqual(triggerChatCommands({}), []);
});

test('commands are cleaned and de-duplicated, keeping order', () => {
  assert.deepEqual(
    triggerChatCommands({ chatCommand: '!so', chatCommands: ['!so', ' !shoutout ', '', '!SO'] }),
    ['!so', '!shoutout'],
  );
});

test('any of the commands starts the trigger', () => {
  const trigger = { chatCommand: '!so', chatCommands: ['!so', '!shoutout'], matchMode: 'startsWith' };
  assert.equal(chatMessageMatchesTrigger(trigger, '!so @bob'), true);
  assert.equal(chatMessageMatchesTrigger(trigger, '!ShoutOut @bob'), true);
  assert.equal(chatMessageMatchesTrigger(trigger, '!sox @bob'), false);
  assert.equal(chatMessageMatchesTrigger(trigger, 'hello'), false);
});

test('match modes apply to every command', () => {
  const exact = { chatCommands: ['!a', '!b'], matchMode: 'exact' };
  assert.equal(chatMessageMatchesTrigger(exact, '!b'), true);
  assert.equal(chatMessageMatchesTrigger(exact, '!b now'), false);
  const contains = { chatCommands: ['hello', 'hi there'], matchMode: 'contains' };
  assert.equal(chatMessageMatchesTrigger(contains, 'oh hi there friend'), true);
});
