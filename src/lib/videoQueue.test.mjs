import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VIDEO_MESSAGES,
  EMPTY_VIDEO_QUEUE,
  VIDEO_FULL_LENGTH_SAFETY_MS,
  addVideoRequest,
  approveVideoRequest,
  clampVideoMaxSeconds,
  denyVideoRequest,
  fillVideoMessage,
  finishVideo,
  isVideoOverdue,
  matchVideoCommand,
  removeQueuedVideo,
  skipVideo,
  startNextVideo,
  videoMessageTemplate,
  videoRequestSettings,
  videoSafetyDeadline,
} from './videoQueue.ts';

let n = 0;
const req = (name, extra = {}) => ({
  id: `r${++n}`,
  videoId: 'dQw4w9WgXcQ',
  startSeconds: 0,
  title: `Video of ${name}`,
  requestedBy: name,
  requesterLogin: name.toLowerCase(),
  maxSeconds: 60,
  volume: 0.8,
  position: 'center',
  size: 50,
  requestedAt: 0,
  skipWho: 'requester_mods',
  approvedMessage: '',
  deniedMessage: '',
  ...extra,
});

test('manual approval: requests wait, approve moves the oldest into the play queue', () => {
  let s = EMPTY_VIDEO_QUEUE;
  const a = addVideoRequest(s, req('Noura'), 'manual');
  assert.equal(a.status, 'waiting');
  assert.equal(a.position, 1);
  const b = addVideoRequest(a.state, req('Khalid'), 'manual');
  assert.equal(b.position, 2);
  s = b.state;
  assert.equal(s.waiting.length, 2);
  assert.equal(s.queue.length, 0);
  // nothing approved yet: nothing to play
  assert.equal(startNextVideo(s, 1000).started, null);

  const approved = approveVideoRequest(s);
  assert.equal(approved.request.requestedBy, 'Noura');
  assert.equal(approved.position, 1);
  s = approved.state;
  assert.deepEqual(s.waiting.map((r) => r.requestedBy), ['Khalid']);
  assert.deepEqual(s.queue.map((r) => r.requestedBy), ['Noura']);
});

test('auto approval goes straight into the queue; place in line counts the video on screen', () => {
  let s = addVideoRequest(EMPTY_VIDEO_QUEUE, req('A'), 'auto');
  assert.equal(s.status, 'queued');
  assert.equal(s.position, 1);
  s = startNextVideo(s.state, 0);
  assert.equal(s.started.requestedBy, 'A');
  const next = addVideoRequest(s.state, req('B'), 'auto');
  // A is playing, so B is the 2nd in line
  assert.equal(next.position, 2);
  assert.equal(next.state.waiting.length, 0);
});

test('requests keep the order viewers asked in, even when one is added late', () => {
  let s = EMPTY_VIDEO_QUEUE;
  s = addVideoRequest(s, req('B', { requestedAt: 200 }), 'manual').state;
  const late = addVideoRequest(s, req('A', { requestedAt: 100 }), 'manual');
  assert.equal(late.position, 1);
  s = addVideoRequest(late.state, req('C', { requestedAt: 300 }), 'manual').state;
  assert.deepEqual(s.waiting.map((r) => r.requestedBy), ['A', 'B', 'C']);

  let q = addVideoRequest(EMPTY_VIDEO_QUEUE, req('Y', { requestedAt: 20 }), 'auto').state;
  const early = addVideoRequest(q, req('X', { requestedAt: 10 }), 'auto');
  assert.equal(early.position, 1);
  assert.deepEqual(early.state.queue.map((r) => r.requestedBy), ['X', 'Y']);
});

test('approve and deny by index, and by id', () => {
  let s = EMPTY_VIDEO_QUEUE;
  for (const name of ['A', 'B', 'C']) s = addVideoRequest(s, req(name), 'manual').state;
  const second = approveVideoRequest(s, { nth: 2 });
  assert.equal(second.request.requestedBy, 'B');
  s = second.state;
  assert.deepEqual(s.waiting.map((r) => r.requestedBy), ['A', 'C']);

  // out of range = nothing happens
  assert.equal(approveVideoRequest(s, { nth: 3 }).request, null);
  assert.equal(approveVideoRequest(s, { nth: 0 }).request, null);
  assert.equal(denyVideoRequest(s, { nth: 9 }).request, null);

  const denied = denyVideoRequest(s, { id: s.waiting[1].id });
  assert.equal(denied.request.requestedBy, 'C');
  s = denied.state;
  assert.deepEqual(s.waiting.map((r) => r.requestedBy), ['A']);
  assert.deepEqual(s.queue.map((r) => r.requestedBy), ['B']);

  const oldest = denyVideoRequest(s);
  assert.equal(oldest.request.requestedBy, 'A');
  assert.equal(oldest.state.waiting.length, 0);
  assert.equal(denyVideoRequest(oldest.state).request, null);
});

test('one plays at a time; ending plays the next; late or duplicate ended messages are ignored', () => {
  let s = EMPTY_VIDEO_QUEUE;
  for (const name of ['A', 'B']) s = addVideoRequest(s, req(name), 'auto').state;
  const first = startNextVideo(s, 100);
  assert.equal(first.started.requestedBy, 'A');
  assert.equal(first.started.startedAt, 100);
  s = first.state;
  // already playing: nothing else starts
  assert.equal(startNextVideo(s, 200).started, null);

  assert.equal(finishVideo(s, 'not-the-one').finished, null);
  const done = finishVideo(s, first.started.id);
  assert.equal(done.finished.requestedBy, 'A');
  s = done.state;
  assert.equal(s.playing, null);
  // the second "ended" from another browser source changes nothing
  assert.equal(finishVideo(s, first.started.id).finished, null);

  const second = startNextVideo(s, 300);
  assert.equal(second.started.requestedBy, 'B');
  assert.equal(second.state.queue.length, 0);
});

test('skip stops the playing video; remove takes one out of the queue', () => {
  let s = EMPTY_VIDEO_QUEUE;
  for (const name of ['A', 'B', 'C']) s = addVideoRequest(s, req(name), 'auto').state;
  s = startNextVideo(s, 0).state;
  const skipped = skipVideo(s);
  assert.equal(skipped.skipped.requestedBy, 'A');
  s = skipped.state;
  assert.equal(skipVideo(s).skipped, null);

  const removed = removeQueuedVideo(s, s.queue[1].id);
  assert.equal(removed.request.requestedBy, 'C');
  assert.deepEqual(removed.state.queue.map((r) => r.requestedBy), ['B']);
  assert.equal(removeQueuedVideo(removed.state, 'nope').request, null);
  assert.equal(startNextVideo(removed.state, 0).started.requestedBy, 'B');
});

test('safety timeout: max seconds + 15 s, or 2 hours for a whole video', () => {
  const limited = startNextVideo(addVideoRequest(EMPTY_VIDEO_QUEUE, req('A', { maxSeconds: 60 }), 'auto').state, 1_000).state;
  assert.equal(videoSafetyDeadline(limited.playing), 1_000 + 75_000);
  assert.equal(isVideoOverdue(limited, 75_999), false);
  assert.equal(isVideoOverdue(limited, 76_000), true);

  const full = startNextVideo(addVideoRequest(EMPTY_VIDEO_QUEUE, req('B', { maxSeconds: 0 }), 'auto').state, 0).state;
  assert.equal(videoSafetyDeadline(full.playing), VIDEO_FULL_LENGTH_SAFETY_MS);
  assert.equal(isVideoOverdue(full, 60 * 60 * 1000), false);
  assert.equal(isVideoOverdue(full, VIDEO_FULL_LENGTH_SAFETY_MS), true);
  assert.equal(isVideoOverdue(EMPTY_VIDEO_QUEUE, 1e12), false);
});

test('settings defaults and limits', () => {
  const s = videoRequestSettings({ id: 's', type: 'video_request' });
  assert.equal(s.input, '{input}');
  assert.equal(s.approval, 'manual');
  assert.equal(s.lengthMode, 'limit');
  assert.equal(s.maxSeconds, 60);
  assert.equal(s.volume, 0.8);
  assert.equal(s.skipCommand, '!skip');
  assert.equal(s.skipWho, 'requester_mods');
  assert.equal(s.approveCommand, '!approve');
  assert.equal(s.denyCommand, '!deny');
  assert.equal(clampVideoMaxSeconds(5), 10);
  assert.equal(clampVideoMaxSeconds(9999), 600);
  assert.equal(clampVideoMaxSeconds(undefined), 60);
});

test('messages: the step text, the default in the app language, or nothing', () => {
  const step = { id: 's', type: 'video_request', videoQueuedMessage: 'Got {title}', videoDeniedMessage: '' };
  assert.equal(videoMessageTemplate(step, 'queued', 'ar'), 'Got {title}');
  assert.equal(videoMessageTemplate(step, 'denied', 'en'), '');
  assert.equal(videoMessageTemplate(step, 'waiting', 'en'), DEFAULT_VIDEO_MESSAGES.en.waiting);
  assert.equal(videoMessageTemplate(step, 'waiting', 'ar'), DEFAULT_VIDEO_MESSAGES.ar.waiting);
  assert.equal(fillVideoMessage('@{username} "{title}" #{position}', { username: 'Noura', title: 'Cats', position: 3 }), '@Noura "Cats" #3');
});

test('chat commands: skip, approve, deny (with an index), only from an enabled sequence with the step', () => {
  const seq = (steps, enabled = true) => ({ id: 'q', name: 'requests', enabled, cooldownSeconds: 0, steps });
  const step = { id: '1', type: 'video_request' };
  const list = [seq([step])];
  assert.equal(matchVideoCommand(list, '!skip').action, 'skip');
  assert.equal(matchVideoCommand(list, '  !SKIP ').action, 'skip');
  assert.deepEqual(
    { a: matchVideoCommand(list, '!approve').action, n: matchVideoCommand(list, '!approve').nth },
    { a: 'approve', n: 1 },
  );
  assert.equal(matchVideoCommand(list, '!approve 2').nth, 2);
  assert.equal(matchVideoCommand(list, '!deny #3').nth, 3);
  assert.equal(matchVideoCommand(list, '!deny 3').action, 'deny');
  // not commands
  assert.equal(matchVideoCommand(list, '!approve everyone'), null);
  assert.equal(matchVideoCommand(list, '!skipping'), null);
  assert.equal(matchVideoCommand(list, 'hello'), null);
  // switched off sequence, or no video step, or skip turned off
  assert.equal(matchVideoCommand([seq([step], false)], '!skip'), null);
  assert.equal(matchVideoCommand([seq([{ id: '2', type: 'chat' }])], '!skip'), null);
  assert.equal(matchVideoCommand([seq([{ ...step, videoSkipWho: 'off' }])], '!skip'), null);
  // custom commands, also inside an If branch
  const custom = [seq([{ id: 'if', type: 'if', ifThen: [{ ...step, videoSkipCommand: '!next', videoApproveCommand: '!ok' }] }])];
  assert.equal(matchVideoCommand(custom, '!next').action, 'skip');
  assert.equal(matchVideoCommand(custom, '!ok 2').nth, 2);
  assert.equal(matchVideoCommand(custom, '!skip'), null);
});
