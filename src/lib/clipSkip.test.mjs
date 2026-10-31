import test from 'node:test';
import assert from 'node:assert/strict';
import { canSkipClip, matchClipSkip } from './clipSkip.ts';

const seq = (steps, enabled = true) => ({ id: 's', name: 'so', enabled, triggers: [], steps });
const viewer = { login: 'noura', isMod: false, isBroadcaster: false };
const mod = { login: 'khalid', isMod: true, isBroadcaster: false };
const streamer = { login: 'me', isMod: false, isBroadcaster: true };

test('a Show Clip step made before this option is skipped with !so skip by its requester or a mod', () => {
  const rule = matchClipSkip([seq([{ id: '1', type: 'obs_clip' }])], '  !SO   Skip ');
  assert.deepEqual(rule, { command: '!so skip', who: 'requester_mods' });
  assert.equal(canSkipClip(rule.who, viewer, 'noura'), true);
  assert.equal(canSkipClip(rule.who, viewer, 'someone_else'), false);
  assert.equal(canSkipClip(rule.who, mod, 'someone_else'), true);
});

test('the streamer decides who can skip, and can always skip', () => {
  assert.equal(canSkipClip('mods', viewer, 'noura'), false);
  assert.equal(canSkipClip('mods', mod, 'noura'), true);
  assert.equal(canSkipClip('everyone', viewer, 'x'), true);
  assert.equal(canSkipClip('off', mod, 'x'), false);
  assert.equal(canSkipClip('mods', streamer, 'x'), true);
});

test('a custom command and steps inside If branches count, off and disabled sequences do not', () => {
  const custom = { id: '1', type: 'obs_clip', clipSkipCommand: '!تخطي', clipSkipWho: 'everyone' };
  assert.deepEqual(matchClipSkip([seq([{ id: 'if', type: 'if', ifThen: [custom], ifElse: [] }])], '!تخطي'), { command: '!تخطي', who: 'everyone' });
  assert.equal(matchClipSkip([seq([{ id: '1', type: 'obs_clip', clipSkipWho: 'off' }])], '!so skip'), null);
  assert.equal(matchClipSkip([seq([{ id: '1', type: 'obs_clip' }], false)], '!so skip'), null);
  assert.equal(matchClipSkip([seq([{ id: '1', type: 'obs_clip' }])], '!so skipper'), null);
});
