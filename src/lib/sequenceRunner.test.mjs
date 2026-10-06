import test from 'node:test';
import assert from 'node:assert/strict';
import {
  replaceSequenceTokens,
  calculateWaitMs,
  isSequenceOnCooldown,
  matchesSequenceTrigger,
  executeSequence,
} from './sequenceRunner.ts';

test('replaceSequenceTokens replaces username, mention, and input', () => {
  const ctx = {
    username: 'Basil',
    userInput: 'water please',
    source: 'channel_points',
  };

  const text = 'Hello {username}! {mention} said: "{input}" ({user})';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Hello Basil! @Basil said: "water please" (Basil)');
});

test('calculateWaitMs correctly computes seconds and minutes', () => {
  assert.equal(calculateWaitMs(5, 'seconds'), 5000);
  assert.equal(calculateWaitMs(2, 'minutes'), 120000);
  assert.equal(calculateWaitMs(0.5, 'minutes'), 30000);
  assert.equal(calculateWaitMs(0, 'seconds'), 0);
  assert.equal(calculateWaitMs(undefined, 'seconds'), 0);
});

test('isSequenceOnCooldown checks remaining cooldown time', () => {
  const seq = {
    id: 'seq-1',
    enabled: true,
    name: 'Hydrate',
    triggerType: 'channel_points',
    cooldownSeconds: 30,
    steps: [],
  };

  const now = 100000;
  // Last run 10s ago -> on cooldown
  assert.equal(isSequenceOnCooldown(seq, now - 10000, now), true);
  // Last run 35s ago -> not on cooldown
  assert.equal(isSequenceOnCooldown(seq, now - 35000, now), false);
  // Never run -> not on cooldown
  assert.equal(isSequenceOnCooldown(seq, undefined, now), false);
});

test('matchesSequenceTrigger checks channel points reward ID and title', () => {
  const seq = {
    id: 'seq-1',
    enabled: true,
    name: 'Hydrate Stack',
    triggerType: 'channel_points',
    rewardId: 'rew-123-abc',
    rewardTitle: 'Hydrate 🥤',
    cooldownSeconds: 0,
    steps: [],
  };

  // Match by ID
  assert.equal(matchesSequenceTrigger(seq, { customRewardId: 'rew-123-abc' }), true);
  // Match by Title (case insensitive)
  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'hydrate 🥤' }), true);
  // Mismatch ID and Title
  assert.equal(matchesSequenceTrigger(seq, { customRewardId: 'other-id' }), false);
  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'Different Reward' }), false);

  // When disabled, never matches
  assert.equal(matchesSequenceTrigger({ ...seq, enabled: false }, { customRewardId: 'rew-123-abc' }), false);
});

test('matchesSequenceTrigger checks chat command', () => {
  const seq = {
    id: 'seq-2',
    enabled: true,
    name: 'Chat Macro',
    triggerType: 'chat',
    chatTrigger: '!hydrate',
    cooldownSeconds: 0,
    steps: [],
  };

  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrate' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrate extra params' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hydrated' }), false);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: 'hello !hydrate' }), false);
});

test('matchesSequenceTrigger supports both channel points and chat triggers', () => {
  const seq = {
    id: 'seq-3',
    enabled: true,
    name: 'Hybrid Trigger',
    triggerType: 'both',
    rewardTitle: 'Drink Water',
    chatTrigger: '!water',
    cooldownSeconds: 0,
    steps: [],
  };

  assert.equal(matchesSequenceTrigger(seq, { rewardTitle: 'Drink Water' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!water' }), true);
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!other' }), false);
});

test('executeSequence runs steps in stack order and invokes sinks', async () => {
  const seq = {
    id: 'seq-hydrate',
    enabled: true,
    name: 'Water Stack',
    triggerType: 'channel_points',
    cooldownSeconds: 0,
    steps: [
      { id: 's1', type: 'chat', chatMessage: 'Drinking water for {username}!' },
      { id: 's2', type: 'wait', waitDuration: 2, waitUnit: 'seconds' },
      { id: 's3', type: 'counter', counterId: 'cnt-water', counterAction: 'increase' },
      { id: 's4', type: 'command', commandTrigger: '!sound water' },
    ],
  };

  const chatMessages = [];
  const counterActions = [];
  const commandsRun = [];
  const delays = [];
  const startedSteps = [];
  const completedSteps = [];

  const result = await executeSequence(
    seq,
    { username: 'StreamViewer', source: 'channel_points' },
    {
      sendChatMessage: async (msg) => { chatMessages.push(msg); return true; },
      executeCounterAction: async (id, act) => { counterActions.push({ id, act }); },
      executeCommand: async (cmd) => { commandsRun.push(cmd); },
      delay: async (ms) => { delays.push(ms); },
      onStepStart: (idx, step) => { startedSteps.push({ idx, id: step.id }); },
      onStepComplete: (idx, step) => { completedSteps.push({ idx, id: step.id }); },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 4);

  assert.deepEqual(chatMessages, ['Drinking water for StreamViewer!']);
  assert.deepEqual(delays, [2000]);
  assert.deepEqual(counterActions, [{ id: 'cnt-water', act: 'increase' }]);
  assert.deepEqual(commandsRun, ['!sound water']);

  assert.equal(startedSteps.length, 4);
  assert.equal(completedSteps.length, 4);
  assert.equal(startedSteps[0].id, 's1');
  assert.equal(startedSteps[1].id, 's2');
  assert.equal(startedSteps[2].id, 's3');
  assert.equal(startedSteps[3].id, 's4');
});

test('replaceSequenceTokens replaces {raider} and {viewers} and falls back target to raider on raid', () => {
  const ctx = {
    username: 'BigStreamer',
    source: 'raid',
    raider: 'BigStreamer',
    viewers: 55,
  };

  const text = 'Thanks @{raider} for raiding with {viewers} viewers! Shoutout {target}!';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Thanks @BigStreamer for raiding with 55 viewers! Shoutout BigStreamer!');
});

test('matchesSequenceTrigger evaluates ActionTrigger array including raids', () => {
  const seq = {
    id: 'seq-raid',
    enabled: true,
    name: 'Raid Welcome',
    cooldownSeconds: 0,
    triggers: [
      {
        id: 't-raid',
        type: 'twitch_raid',
        enabled: true,
        minViewers: 10,
      },
      {
        id: 't-chat',
        type: 'twitch_chat',
        enabled: true,
        chatCommand: '!shoutout',
        matchMode: 'startsWith',
      },
    ],
    steps: [],
  };

  // Raid with 15 viewers matches
  assert.equal(matchesSequenceTrigger(seq, { raid: { fromUserName: 'Friend', fromUserLogin: 'friend', viewers: 15 } }), true);
  // Raid with 5 viewers does not match (min is 10)
  assert.equal(matchesSequenceTrigger(seq, { raid: { fromUserName: 'Friend', fromUserLogin: 'friend', viewers: 5 } }), false);
  // Chat command !shoutout matches
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!shoutout @raider' }), true);
  // Unrelated chat command does not match
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!hello' }), false);
});

test('executeSequence seamlessly executes comment steps as non-failing annotations', async () => {
  const sequence = {
    id: 'seq-comment',
    name: 'With Comment',
    enabled: true,
    steps: [
      { id: 's1', type: 'comment', commentText: '** Setup Welcome **' },
      { id: 's2', type: 'chat', chatMessage: 'Hello World!' },
    ],
  };

  const sentMessages = [];
  const res = await executeSequence(
    sequence,
    { username: 'Streamer' },
    {
      sendChatMessage: async (msg) => {
        sentMessages.push(msg);
      },
    }
  );

  assert.equal(res.ok, true);
  assert.equal(res.executedSteps, 2);
  assert.deepEqual(sentMessages, ['Hello World!']);
});

test('matchesSequenceTrigger returns false when triggers array is empty', () => {
  const seqWithEmptyTriggers = {
    id: 'seq-manual',
    name: 'Manual Action Only',
    enabled: true,
    triggers: [],
    // Legacy fields should NOT accidentally match when triggers is explicitly empty array
    triggerType: 'chat',
    chatTrigger: '!run',
    steps: [],
  };

  assert.equal(matchesSequenceTrigger(seqWithEmptyTriggers, { chatMessage: '!run' }), false);
  assert.equal(matchesSequenceTrigger(seqWithEmptyTriggers, { customRewardId: 'r1', rewardTitle: 'Reward' }), false);
  assert.equal(matchesSequenceTrigger(seqWithEmptyTriggers, { raid: { fromUserName: 'R', fromUserLogin: 'r', viewers: 10 } }), false);
});

test('matchesSequenceTrigger evaluates twitch_follow triggers', () => {
  const seq = {
    id: 'seq-follow',
    enabled: true,
    name: 'Follow Alert',
    triggers: [
      {
        id: 't-follow',
        type: 'twitch_follow',
        enabled: true,
      },
    ],
    steps: [],
  };

  // Follow event matches
  assert.equal(
    matchesSequenceTrigger(seq, {
      follow: { userId: '123', userName: 'CoolFollower', userLogin: 'coolfollower' },
    }),
    true
  );

  // When trigger is disabled, does not match
  const seqDisabled = {
    ...seq,
    triggers: [{ id: 't-follow', type: 'twitch_follow', enabled: false }],
  };
  assert.equal(
    matchesSequenceTrigger(seqDisabled, {
      follow: { userId: '123', userName: 'CoolFollower', userLogin: 'coolfollower' },
    }),
    false
  );

  // Other events do not match follow trigger
  assert.equal(matchesSequenceTrigger(seq, { chatMessage: '!follow' }), false);
  assert.equal(matchesSequenceTrigger(seq, { raid: { fromUserName: 'R', fromUserLogin: 'r', viewers: 10 } }), false);
});

test('replaceSequenceTokens replaces tokens for follow events', () => {
  const ctx = {
    username: 'AwesomeFollower',
    source: 'follow',
  };

  const text = 'Welcome to the channel {mention}! Thanks {username} for following!';
  const result = replaceSequenceTokens(text, ctx);

  assert.equal(result, 'Welcome to the channel @AwesomeFollower! Thanks AwesomeFollower for following!');
});

test('executeSequence executes all 5 new sub-actions (sound, tts, obs_text, poll, mic_mute)', async () => {
  const seq = {
    id: 'seq-new-actions',
    enabled: true,
    name: 'New Actions Test',
    steps: [
      {
        id: 's-sound',
        type: 'sound',
        soundPath: 'C:\\sounds\\cheer.mp3',
        soundVolume: 0.8,
      },
      {
        id: 's-tts',
        type: 'tts',
        ttsText: 'Welcome {username} to the stream!',
        ttsVoice: 'Microsoft David',
        ttsRate: 1.1,
        ttsPitch: 1.0,
        ttsVolume: 0.9,
      },
      {
        id: 's-obs',
        type: 'obs_text',
        filePath: 'C:\\stream\\latest_follower.txt',
        fileContent: 'Latest Follower: {username}',
      },
      {
        id: 's-poll',
        type: 'poll',
        pollAction: 'start',
        pollQuestion: 'Which game next?',
        pollOptions: ['Valorant', 'Minecraft'],
        pollDurationSeconds: 120,
      },
      {
        id: 's-mic',
        type: 'mic_mute',
        micMuteDurationSeconds: 10,
      },
    ],
  };

  const soundsPlayed = [];
  const ttsSpoken = [];
  const obsTextsWritten = [];
  const pollActions = [];
  const micMutes = [];

  const result = await executeSequence(
    seq,
    { username: 'Gamer123', source: 'follow' },
    {
      playSound: async (soundPath, volume) => {
        soundsPlayed.push({ soundPath, volume });
      },
      speakTts: async (text, voice, rate, pitch, volume) => {
        ttsSpoken.push({ text, voice, rate, pitch, volume });
      },
      writeObsText: async (filePath, content) => {
        obsTextsWritten.push({ filePath, content });
      },
      executePollAction: async (action, question, options, durationSeconds) => {
        pollActions.push({ action, question, options, durationSeconds });
      },
      muteMic: async (durationSeconds) => {
        micMutes.push({ durationSeconds });
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 5);

  assert.deepEqual(soundsPlayed, [
    { soundPath: 'C:\\sounds\\cheer.mp3', volume: 0.8 },
  ]);

  assert.deepEqual(ttsSpoken, [
    {
      text: 'Welcome Gamer123 to the stream!',
      voice: 'Microsoft David',
      rate: 1.1,
      pitch: 1.0,
      volume: 0.9,
    },
  ]);

  assert.deepEqual(obsTextsWritten, [
    {
      filePath: 'C:\\stream\\latest_follower.txt',
      content: 'Latest Follower: Gamer123',
    },
  ]);

  assert.deepEqual(pollActions, [
    {
      action: 'start',
      question: 'Which game next?',
      options: ['Valorant', 'Minecraft'],
      durationSeconds: 120,
    },
  ]);

  assert.deepEqual(micMutes, [
    { durationSeconds: 10 },
  ]);
});

test('executeSequence executes obs_image and duel steps and replaces tokens', async () => {
  const seq = {
    id: 'seq-img-duel',
    enabled: true,
    name: 'Image and Duel',
    triggerType: 'chat',
    cooldownSeconds: 0,
    steps: [
      {
        id: 's-img',
        type: 'obs_image',
        imagePath: 'C:\\memes\\{username}.gif',
        imageDurationSeconds: 8,
        imagePosition: 'center',
        imageAnimation: 'bounce',
        imageScale: 1.5,
        obsImageDestinationPath: 'C:\\obs\\current.gif',
      },
      {
        id: 's-duel',
        type: 'duel',
        duelMode: 'ai_trivia',
        duelOpponent: '{input}',
        duelTimeoutDuration: 60,
        duelTimerSeconds: 30,
      },
    ],
  };

  const imagesShown = [];
  const duelsExecuted = [];

  const result = await executeSequence(
    seq,
    { username: 'ChallengerX', userInput: '@OpponentY', source: 'chat' },
    {
      showObsImage: async (payload) => {
        imagesShown.push(payload);
        return true;
      },
      executeDuel: async (step, ctx) => {
        duelsExecuted.push({ step, ctx });
        return true;
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.executedSteps, 2);

  assert.equal(imagesShown.length, 1);
  assert.equal(imagesShown[0].imageUrl, 'C:\\memes\\ChallengerX.gif');
  assert.equal(imagesShown[0].durationSeconds, 8);
  assert.equal(imagesShown[0].position, 'center');
  assert.equal(imagesShown[0].animation, 'bounce');
  assert.equal(imagesShown[0].scale, 1.5);
  assert.equal(imagesShown[0].destinationPath, 'C:\\obs\\current.gif');

  assert.equal(duelsExecuted.length, 1);
  assert.equal(duelsExecuted[0].step.duelMode, 'ai_trivia');
  assert.equal(duelsExecuted[0].step.duelOpponent, 'OpponentY');
  assert.equal(duelsExecuted[0].step.duelTimeoutDuration, 60);
  assert.equal(duelsExecuted[0].step.duelTimerSeconds, 30);
});

test('reordering steps accurately repositions sequence actions', () => {
  const steps = [
    { id: '1', type: 'chat', chatMessage: 'step 1' },
    { id: '2', type: 'wait', waitDuration: 2 },
    { id: '3', type: 'sound', soundPath: 'alert.mp3' },
    { id: '4', type: 'counter', counterAction: 'increase' },
  ];

  const reorder = (items, fromIndex, toIndex) => {
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  // Move step 1 (index 0) to index 2
  const reordered1 = reorder(steps, 0, 2);
  assert.deepEqual(reordered1.map(s => s.id), ['2', '3', '1', '4']);

  // Move step 4 (index 3) to index 0
  const reordered2 = reorder(steps, 3, 0);
  assert.deepEqual(reordered2.map(s => s.id), ['4', '1', '2', '3']);
});

test('matchesSequenceTrigger evaluates twitch_watch_streak triggers', () => {
  const seq = {
    id: 'seq-streak',
    name: 'Streak Celebration',
    enabled: true,
    triggers: [
      { id: 't1', type: 'twitch_watch_streak', enabled: true, minStreak: 3 },
    ],
    steps: [],
  };

  // Streak under minimum (2 < 3)
  assert.equal(
    matchesSequenceTrigger(seq, {
      watchStreak: {
        userId: '123',
        userName: 'LoyalViewer',
        userLogin: 'loyalviewer',
        streak: 2,
      },
    }),
    false
  );

  // Streak meeting minimum (3 >= 3)
  assert.equal(
    matchesSequenceTrigger(seq, {
      watchStreak: {
        userId: '123',
        userName: 'LoyalViewer',
        userLogin: 'loyalviewer',
        streak: 3,
      },
    }),
    true
  );

  // Streak exceeding minimum (10 >= 3)
  assert.equal(
    matchesSequenceTrigger(seq, {
      watchStreak: {
        userId: '123',
        userName: 'SuperFan',
        userLogin: 'superfan',
        streak: 10,
      },
    }),
    true
  );
});

test('replaceSequenceTokens replaces {streak} and watch streak tokens', () => {
  const ctx = {
    username: 'StreakMaster',
    source: 'watch_streak',
    streak: 7,
    userInput: 'Keep up the great streams!',
  };

  const text = replaceSequenceTokens(
    'GG {mention}! That is a {streak} stream watch streak! Message: {input}',
    ctx
  );

  assert.equal(text, 'GG @StreakMaster! That is a 7 stream watch streak! Message: Keep up the great streams!');
});

test('executeSequence passes micMuteSourceName to muteMic sink', async () => {
  const seq = {
    id: 'seq-mute',
    name: 'OBS Source Mute Sequence',
    enabled: true,
    triggers: [],
    steps: [
      {
        id: 's1',
        type: 'mic_mute',
        micMuteDurationSeconds: 12,
        micMuteSourceName: 'Elgato Wave 3',
      },
    ],
  };

  const mutedSources = [];
  const result = await executeSequence(
    seq,
    { username: 'Streamer' },
    {
      muteMic: async (duration, sourceName) => {
        mutedSources.push({ duration, sourceName });
        return true;
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(mutedSources.length, 1);
  assert.equal(mutedSources[0].duration, 12);
  assert.equal(mutedSources[0].sourceName, 'Elgato Wave 3');
});

test('executeSequence executes duel_streamer and replaces broadcaster and streamer tokens', async () => {
  const seq = {
    id: 'seq-streamer-duel',
    name: 'Streamer 1v1 Sequence',
    enabled: true,
    triggers: [],
    steps: [
      {
        id: 's-duel',
        type: 'duel_streamer',
        duelMode: 'ai_trivia',
        duelOpponent: '{broadcaster}',
        duelTimeoutDuration: 45,
        duelTimerSeconds: 25,
        duelBroadcasterMuteSource: 'Mic Aux 1',
        duelStreamerWinMessage: 'Streamer {streamer} won against {challenger}!',
        duelStreamerLoseMessage: 'Streamer {streamer} lost against {challenger}! Muted {source} for {duration}s!',
      },
    ],
  };

  const executedDuels = [];
  const result = await executeSequence(
    seq,
    {
      username: 'BoldChallenger',
      broadcasterName: 'Zeen1th',
    },
    {
      executeDuel: async (step, ctx) => {
        executedDuels.push({ step, ctx });
        return true;
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(executedDuels.length, 1);
  assert.equal(executedDuels[0].step.type, 'duel_streamer');
  assert.equal(executedDuels[0].step.duelOpponent, 'Zeen1th');
  assert.equal(executedDuels[0].step.duelTimeoutDuration, 45);
  assert.equal(executedDuels[0].step.duelBroadcasterMuteSource, 'Mic Aux 1');
});


