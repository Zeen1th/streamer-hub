import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHIELD, isShielded, protectedUserMessage } from './shield.ts';

const withRoles = (roles) => ({ ...DEFAULT_SHIELD, roles: { ...DEFAULT_SHIELD.roles, ...roles } });

test('nobody is shielded by default', () => {
  assert.equal(isShielded('Alice', DEFAULT_SHIELD, { isMod: true, isVip: true, isSubscriber: true }), false);
});

test('shielded by role from the last seen chatter flags', () => {
  assert.equal(isShielded('Alice', withRoles({ moderator: true }), { isMod: true }), true);
  assert.equal(isShielded('Alice', withRoles({ vip: true }), { isVip: true }), true);
  assert.equal(isShielded('Alice', withRoles({ subscriber: true }), { isSubscriber: true }), true);
  assert.equal(isShielded('Alice', withRoles({ vip: true }), { isSubscriber: true }), false);
  assert.equal(isShielded('Alice', withRoles({ vip: true }), undefined), false);
});

test('shielded by name ignores @ and case, even for unknown chatters', () => {
  const settings = { ...DEFAULT_SHIELD, names: ['@LoyalViewer'] };
  assert.equal(isShielded('loyalviewer', settings), true);
  assert.equal(isShielded('@LOYALVIEWER', settings), true);
  assert.equal(isShielded('someone_else', settings), false);
  assert.equal(isShielded('', settings), false);
});

test('per-viewer replies are found by name ignoring @ and case, blank ones fall back', () => {
  const perUser = { loyal_viewer: 'Sorry, the boss said no duels with you', blank_one: '   ' };
  assert.equal(protectedUserMessage('@Loyal_Viewer', perUser), 'Sorry, the boss said no duels with you');
  assert.equal(protectedUserMessage('blank_one', perUser), undefined);
  assert.equal(protectedUserMessage('someone_else', perUser), undefined);
  assert.equal(protectedUserMessage('anyone', undefined), undefined);
});
