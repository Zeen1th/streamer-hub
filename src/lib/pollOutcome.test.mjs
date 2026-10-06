import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePollOutcome } from './pollOutcome.ts';

test('evaluatePollOutcome picks a winner, a tie, or no votes', () => {
  assert.deepEqual(evaluatePollOutcome([{ label: 'A', votes: 3 }, { label: 'B', votes: 1 }]), { kind: 'winner', label: 'A', index: 0 });
  assert.deepEqual(evaluatePollOutcome([{ label: 'A', votes: 2 }, { label: 'B', votes: 2 }, { label: 'C', votes: 0 }]), { kind: 'tie', labels: ['A', 'B'] });
  assert.deepEqual(evaluatePollOutcome([{ label: 'A', votes: 0 }, { label: 'B', votes: 0 }]), { kind: 'none' });
});
