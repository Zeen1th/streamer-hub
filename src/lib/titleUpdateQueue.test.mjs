import assert from 'node:assert/strict';
import test from 'node:test';
import { SerialTitleUpdateQueue } from './titleUpdateQueue.ts';

test('runs title updates in request order even when the first request is slow', async () => {
  const queue = new SerialTitleUpdateQueue();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  const first = queue.enqueue(async () => {
    events.push('counter:start');
    await firstGate;
    events.push('counter:finish');
  });
  const second = queue.enqueue(async () => {
    events.push('trigger:start');
    events.push('trigger:finish');
  });

  await Promise.resolve();
  assert.deepEqual(events, ['counter:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['counter:start', 'counter:finish', 'trigger:start', 'trigger:finish']);
});

test('continues processing after a failed title update', async () => {
  const queue = new SerialTitleUpdateQueue();
  const events = [];
  await assert.rejects(queue.enqueue(async () => { throw new Error('network'); }));
  await queue.enqueue(async () => { events.push('recovered'); });
  assert.deepEqual(events, ['recovered']);
});
