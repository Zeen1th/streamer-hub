import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialPoll,
  parseVoteInput,
  calculatePercentages,
  recordVote,
  incrementManualVote,
  decrementManualVote,
} from './voteRules.ts';

test('createInitialPoll produces valid default poll state', () => {
  const poll = createInitialPoll();
  assert.ok(poll.id);
  assert.equal(poll.isActive, false);
  assert.equal(poll.isEnded, false);
  assert.equal(poll.totalVotes, 0);
  assert.equal(poll.options.length, 3);
  assert.equal(poll.allowChatVotes, true);
  assert.equal(poll.allowChangeVote, true);
});

test('parseVoteInput parses direct numbers, keys, commands and labels', () => {
  const options = [
    { id: 'opt-1', key: '1', label: 'Elden Ring', votes: 0 },
    { id: 'opt-2', key: '2', label: 'Hollow Knight', votes: 0 },
    { id: 'opt-3', key: 'A', label: 'Cyberpunk', votes: 0 },
  ];

  // Number / key matches
  assert.equal(parseVoteInput('1', options), 'opt-1');
  assert.equal(parseVoteInput('2', options), 'opt-2');
  assert.equal(parseVoteInput('a', options), 'opt-3');
  assert.equal(parseVoteInput('A', options), 'opt-3');

  // Command matches
  assert.equal(parseVoteInput('!vote 1', options), 'opt-1');
  assert.equal(parseVoteInput('!v 2', options), 'opt-2');
  assert.equal(parseVoteInput('!poll A', options), 'opt-3');
  assert.equal(parseVoteInput('!vote elden ring', options), 'opt-1');

  // Label matches
  assert.equal(parseVoteInput('elden ring', options), 'opt-1');
  assert.equal(parseVoteInput('Hollow Knight', options), 'opt-2');

  // Invalid / non-vote inputs
  assert.equal(parseVoteInput('4', options), null);
  assert.equal(parseVoteInput('!deaths', options), null);
  assert.equal(parseVoteInput('hello everyone', options), null);
  assert.equal(parseVoteInput('', options), null);
});

test('calculatePercentages calculates correct percentage breakdown', () => {
  const options = [
    { id: 'opt-1', key: '1', label: 'A', votes: 15 },
    { id: 'opt-2', key: '2', label: 'B', votes: 5 },
  ];

  const p = calculatePercentages(options, 20);
  assert.equal(p['opt-1'], 75);
  assert.equal(p['opt-2'], 25);

  const emptyPercentages = calculatePercentages([
    { id: 'opt-1', key: '1', label: 'A', votes: 0 },
    { id: 'opt-2', key: '2', label: 'B', votes: 0 },
  ]);
  assert.equal(emptyPercentages['opt-1'], 0);
  assert.equal(emptyPercentages['opt-2'], 0);
});

test('recordVote records votes, prevents duplicate double voting, and allows switching votes', () => {
  let poll = {
    ...createInitialPoll(),
    isActive: true,
  };

  // Voter 1 votes for option 1
  const afterVote1 = recordVote(poll, 'userA', 'opt-1');
  assert.ok(afterVote1);
  assert.equal(afterVote1.totalVotes, 1);
  assert.equal(afterVote1.options[0].votes, 1);
  assert.equal(afterVote1.voters['usera'], 'opt-1');

  // Same user votes for option 1 again (no double vote)
  const afterSameVote = recordVote(afterVote1, 'userA', 'opt-1');
  assert.equal(afterSameVote?.totalVotes, 1);
  assert.equal(afterSameVote?.options[0].votes, 1);

  // Same user switches vote to option 2
  const afterSwitch = recordVote(afterVote1, 'userA', 'opt-2');
  assert.ok(afterSwitch);
  assert.equal(afterSwitch.totalVotes, 1);
  assert.equal(afterSwitch.options[0].votes, 0);
  assert.equal(afterSwitch.options[1].votes, 1);
  assert.equal(afterSwitch.voters['usera'], 'opt-2');

  // Second user votes for option 2
  const afterUser2 = recordVote(afterSwitch, 'userB', 'opt-2');
  assert.ok(afterUser2);
  assert.equal(afterUser2.totalVotes, 2);
  assert.equal(afterUser2.options[1].votes, 2);
});

test('recordVote rejects vote if poll is not active or when change vote is disallowed', () => {
  const inactivePoll = {
    ...createInitialPoll(),
    isActive: false,
  };
  assert.equal(recordVote(inactivePoll, 'userA', 'opt-1'), null);

  const noChangePoll = {
    ...createInitialPoll(),
    isActive: true,
    allowChangeVote: false,
    voters: { usera: 'opt-1' },
    totalVotes: 1,
    options: [
      { id: 'opt-1', key: '1', label: '1', votes: 1 },
      { id: 'opt-2', key: '2', label: '2', votes: 0 },
    ],
  };

  // Attempting to change vote is rejected
  assert.equal(recordVote(noChangePoll, 'userA', 'opt-2'), null);
});

test('manual vote increment and decrement functions update counts properly', () => {
  let poll = createInitialPoll();
  poll = incrementManualVote(poll, 'opt-1');
  assert.equal(poll.options[0].votes, 1);
  assert.equal(poll.totalVotes, 1);

  poll = incrementManualVote(poll, 'opt-1');
  assert.equal(poll.options[0].votes, 2);
  assert.equal(poll.totalVotes, 2);

  poll = decrementManualVote(poll, 'opt-1');
  assert.equal(poll.options[0].votes, 1);
  assert.equal(poll.totalVotes, 1);

  poll = decrementManualVote(poll, 'opt-1');
  assert.equal(poll.options[0].votes, 0);
  assert.equal(poll.totalVotes, 0);

  // Decrementing at 0 doesn't go negative
  poll = decrementManualVote(poll, 'opt-1');
  assert.equal(poll.options[0].votes, 0);
  assert.equal(poll.totalVotes, 0);
});

test('VoteOption maintains imageUrl through voting and state updates', () => {
  let poll = {
    ...createInitialPoll(),
    isActive: true,
    options: [
      { id: 'opt-1', key: '1', label: 'Elden Ring', votes: 0, imageUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg' },
      { id: 'opt-2', key: '2', label: 'Cyberpunk 2077', votes: 0, imageUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg' },
    ],
  };

  const updated = recordVote(poll, 'gamer123', 'opt-1');
  assert.ok(updated);
  assert.equal(updated.options[0].imageUrl, 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg');
  assert.equal(updated.options[1].imageUrl, 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg');

  const manualIncr = incrementManualVote(updated, 'opt-2');
  assert.equal(manualIncr.options[1].imageUrl, 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg');
});

