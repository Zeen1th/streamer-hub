import assert from 'node:assert/strict';
import test from 'node:test';
import { SerialCounterSyncQueue } from './counterSyncQueue.ts';

test('keeps persistence and title synchronization in counter-change order', async () => {
  const queue = new SerialCounterSyncQueue();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  queue.enqueue(async () => {
    events.push('persist:1:start');
    await firstGate;
    events.push('persist:1:finish');
    events.push('title:1');
  });
  queue.enqueue(async () => {
    events.push('persist:2:start');
    events.push('persist:2:finish');
    events.push('title:2');
  });

  await Promise.resolve();
  assert.deepEqual(events, ['persist:1:start']);

  releaseFirst();
  await queue.drain();
  assert.deepEqual(events, [
    'persist:1:start',
    'persist:1:finish',
    'title:1',
    'persist:2:start',
    'persist:2:finish',
    'title:2',
  ]);
});

test('drain waits for the last pending counter synchronization', async () => {
  const queue = new SerialCounterSyncQueue();
  let release;
  let completed = false;
  const gate = new Promise((resolve) => { release = resolve; });

  queue.enqueue(async () => {
    await gate;
    completed = true;
  });

  const drained = queue.drain();
  await Promise.resolve();
  assert.equal(completed, false);

  release();
  await drained;
  assert.equal(completed, true);
});

test('a failed synchronization does not block the next counter update', async () => {
  const queue = new SerialCounterSyncQueue();
  const events = [];

  await assert.rejects(queue.enqueue(async () => {
    throw new Error('storage unavailable');
  }));
  queue.enqueue(async () => {
    events.push('recovered');
  });

  await queue.drain();
  assert.deepEqual(events, ['recovered']);
});
