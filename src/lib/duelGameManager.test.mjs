import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnswer,
  isAnswerMatch,
  duelGameManager,
} from './duelGameManager.ts';

test('normalizeAnswer correctly normalizes Arabic and English text', () => {
  // English normalization
  assert.equal(normalizeAnswer('Kratos!'), 'kratos');
  assert.equal(normalizeAnswer('  Super   Mario  '), 'super mario');
  assert.equal(normalizeAnswer('Minecraft?'), 'minecraft');

  // Arabic normalization (alef variations, taa marbuta, punctuation)
  assert.equal(normalizeAnswer('أحمد!'), 'احمد');
  assert.equal(normalizeAnswer('إبراهيم؟'), 'ابراهيم');
  assert.equal(normalizeAnswer('آسر'), 'اسر');
  assert.equal(normalizeAnswer('لعبة'), 'لعبه');
  assert.equal(normalizeAnswer('موسيقى'), 'موسيقي');
});

test('isAnswerMatch matches answers with tolerance and aliases', () => {
  assert.equal(isAnswerMatch('kratos', 'Kratos', ['god of war protagonist']), true);
  assert.equal(isAnswerMatch('The answer is Kratos!', 'Kratos', []), true);
  assert.equal(isAnswerMatch('كريتوس', 'كرايتوس', ['كريتوس']), true);
  assert.equal(isAnswerMatch('wrong answer', 'Kratos', ['God of War']), false);
});

test('startDuel validates opponent, self-challenge, and broadcaster', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    delay: async () => {},
  };

  // 1. Empty opponent
  const resEmpty = await duelGameManager.startDuel({
    challenger: 'PlayerOne',
    opponentRaw: '',
    mode: 'random',
    sinks: mockSinks,
  });
  assert.equal(resEmpty.ok, false);
  assert.equal(resEmpty.error, 'EMPTY_OPPONENT');

  // 2. Cannot challenge self
  const resSelf = await duelGameManager.startDuel({
    challenger: 'PlayerOne',
    opponentRaw: '@PlayerOne',
    mode: 'random',
    sinks: mockSinks,
  });
  assert.equal(resSelf.ok, false);
  assert.equal(resSelf.error, 'CANNOT_CHALLENGE_SELF');

  // 3. Cannot challenge broadcaster
  const resBroadcaster = await duelGameManager.startDuel({
    challenger: 'PlayerOne',
    opponentRaw: '@StreamHost',
    mode: 'random',
    broadcasterName: 'StreamHost',
    sinks: mockSinks,
  });
  assert.equal(resBroadcaster.ok, false);
  assert.equal(resBroadcaster.error, 'CANNOT_CHALLENGE_BROADCASTER');
});

test('startDuel in random mode picks a loser and executes timeout', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    delay: async () => {},
  };

  const res = await duelGameManager.startDuel({
    challenger: 'Alice',
    opponentRaw: '@Bob',
    mode: 'random',
    timeoutDuration: 45,
    sinks: mockSinks,
  });

  assert.equal(res.ok, true);
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].duration, 45);
  assert.ok(timeouts[0].target === 'Alice' || timeouts[0].target === 'Bob');
  assert.equal(sentMessages.length, 2);
  assert.ok(sentMessages[0].includes('50/50 timeout duel'));
  assert.ok(sentMessages[1].includes('lost the duel'));
});

test('startDuel in AI trivia mode handles correct answer from challenger', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    generateTrivia: async () => ({
      ok: true,
      question: 'Who is Mario\'s brother?',
      answer: 'Luigi',
      acceptableAnswers: ['luigi', 'لويجي'],
    }),
    delay: async () => {},
  };

  const res = await duelGameManager.startDuel({
    challenger: 'Alice',
    opponentRaw: '@Bob',
    mode: 'ai_trivia',
    timeoutDuration: 60,
    timerSeconds: 30,
    sinks: mockSinks,
  });

  assert.equal(res.ok, true);
  assert.ok(duelGameManager.getActiveDuel() !== null);

  // Unrelated viewer answer -> ignored
  const bystanderAnswer = await duelGameManager.handleChatMessage({
    username: 'Charlie',
    message: 'Luigi',
  });
  assert.equal(bystanderAnswer, false);
  assert.ok(duelGameManager.getActiveDuel() !== null);

  // Opponent wrong answer -> keeps waiting
  const wrongAnswer = await duelGameManager.handleChatMessage({
    username: 'Bob',
    message: 'Wario',
  });
  assert.equal(wrongAnswer, false);

  // Challenger correct answer -> Alice wins, Bob gets timed out!
  const correctAnswer = await duelGameManager.handleChatMessage({
    username: 'Alice',
    message: 'It is Luigi!',
  });
  assert.equal(correctAnswer, true);
  assert.equal(duelGameManager.getActiveDuel(), null);

  // Bob is timed out
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].target, 'Bob');
  assert.equal(timeouts[0].duration, 60);
});

test('startDuel in AI trivia mode handles correct answer from opponent', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    generateTrivia: async () => ({
      ok: true,
      question: 'What is the main currency in The Legend of Zelda?',
      answer: 'Rupees',
      acceptableAnswers: ['rupee', 'rupees', 'روبي'],
    }),
    delay: async () => {},
  };

  await duelGameManager.startDuel({
    challenger: 'PlayerOne',
    opponentRaw: '@PlayerTwo',
    mode: 'ai_trivia',
    timeoutDuration: 90,
    timerSeconds: 20,
    sinks: mockSinks,
  });

  // PlayerTwo (opponent) answers correctly -> PlayerTwo wins, PlayerOne (challenger) gets timed out!
  const opponentWins = await duelGameManager.handleChatMessage({
    username: 'PlayerTwo',
    message: 'rupees',
  });
  assert.equal(opponentWins, true);
  assert.equal(duelGameManager.getActiveDuel(), null);

  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].target, 'PlayerOne');
  assert.equal(timeouts[0].duration, 90);
});

test('renderDuelMessage replaces all case-insensitive tokens correctly', async () => {
  const { renderDuelMessage } = await import('./duelGameManager.ts');

  const rendered = renderDuelMessage('Fight: @{challenger} vs @{opponent}! Winner is @{winner}! Time: {duration}s Q: {question}', {
    challenger: 'Hero',
    opponent: 'Villain',
    winner: 'Hero',
    duration: 60,
    question: 'Favorite game?',
  });

  assert.equal(rendered, 'Fight: @Hero vs @Villain! Winner is @Hero! Time: 60s Q: Favorite game?');
});

test('startDuel passes language, category, and customInstructions to generateTrivia', async () => {
  duelGameManager.reset();
  let receivedPayload = null;

  const mockSinks = {
    sendChatMessage: async () => true,
    smartModTimeout: async () => ({ ok: true }),
    generateTrivia: async (payload) => {
      receivedPayload = payload;
      return {
        ok: true,
        question: 'Who created Dark Souls?',
        answer: 'Miyazaki',
        acceptableAnswers: ['miyazaki'],
      };
    },
    delay: async () => {},
  };

  const res = await duelGameManager.startDuel({
    challenger: 'Knight',
    opponentRaw: '@Dragon',
    mode: 'ai_trivia',
    language: 'ar',
    category: 'souls',
    customInstructions: 'Focus only on Elden Ring and Dark Souls bosses',
    sinks: mockSinks,
  });

  assert.equal(res.ok, true);
  assert.notEqual(receivedPayload, null);
  assert.equal(receivedPayload.language, 'ar');
  assert.equal(receivedPayload.category, 'souls');
  assert.equal(receivedPayload.customInstructions, 'Focus only on Elden Ring and Dark Souls bosses');
  duelGameManager.reset();
});

test('startDuel supports custom messages for start and winner', async () => {
  duelGameManager.reset();
  const sentMessages = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async () => ({ ok: true }),
    generateTrivia: async () => ({
      ok: true,
      question: 'What is the master sword?',
      answer: 'Blade of Evil\'s Bane',
      acceptableAnswers: ['blade', 'sword'],
    }),
    delay: async () => {},
  };

  await duelGameManager.startDuel({
    challenger: 'Link',
    opponentRaw: '@Ganon',
    mode: 'ai_trivia',
    timeoutDuration: 120,
    timerSeconds: 45,
    messageStart: '⚔️ ARENA: @{challenger} challenged @{opponent}! Q: {question} ({timer}s)!',
    messageWin: '🏆 CHAMPION: @{winner} defeated @{loser}! Timed out for {duration}s!',
    sinks: mockSinks,
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0], '⚔️ ARENA: @Link challenged @Ganon! Q: What is the master sword? (45s)!');

  await duelGameManager.handleChatMessage({
    username: 'Link',
    message: 'sword',
  });

  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[1], '🏆 CHAMPION: @Link defeated @Ganon! Timed out for 120s!');
});

test('duelGameManager resolves Arabic display names, ASCII logins, and bilingual Zelda trivia answers', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    generateTrivia: async () => ({
      ok: true,
      question: 'ما هو اسم اللاعب الرئيسي في سلسلة ألعاب Zelda؟',
      answer: 'Link',
      acceptableAnswers: ['Link', 'لينك'],
    }),
    delay: async () => {},
  };

  // Start duel between Arabic display names / logins: @زينث vs @_الموقر
  const startRes = await duelGameManager.startDuel({
    challenger: 'زينث',
    opponentRaw: '@_الموقر',
    mode: 'ai_trivia',
    timeoutDuration: 60,
    timerSeconds: 30,
    sinks: mockSinks,
  });

  assert.equal(startRes.ok, true);
  assert.ok(duelGameManager.getActiveDuel() !== null);

  // 1. Unrelated user typing "Link" -> ignored
  const unrelatedRes = await duelGameManager.handleChatMessage({
    username: 'random_viewer',
    displayName: 'Random Viewer',
    userLogin: 'random_viewer',
    message: 'Link',
  });
  assert.equal(unrelatedRes, false);
  assert.ok(duelGameManager.getActiveDuel() !== null);

  // 2. Challenger typing incorrect answer "سيرفر" (server) -> false, keeps listening
  const wrongRes = await duelGameManager.handleChatMessage({
    username: 'zeen1th',
    displayName: 'زينث',
    userLogin: 'zeen1th',
    message: 'سيرفر',
  });
  assert.equal(wrongRes, false);
  assert.ok(duelGameManager.getActiveDuel() !== null);

  // 3. Challenger answering in English "Link" (identifying by displayName 'زينث' and login 'zeen1th')
  const correctEnglishRes = await duelGameManager.handleChatMessage({
    username: 'zeen1th',
    displayName: 'زينث',
    userLogin: 'zeen1th',
    message: 'Link',
  });
  assert.equal(correctEnglishRes, true);
  assert.equal(duelGameManager.getActiveDuel(), null);

  // Verify winner is زينث and loser timed out is _الموقر
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].target, '_الموقر');
  assert.equal(timeouts[0].duration, 60);

  // Verify win message was sent
  const lastMsg = sentMessages[sentMessages.length - 1];
  assert.ok(lastMsg.includes('زينث'));
  assert.ok(lastMsg.includes('_الموقر'));
  assert.ok(lastMsg.includes('Link'));
});

test('isAnswerMatch supports bidirectional Arabic/English synonym expansion and tashkeel', () => {
  // Tashkeel / harakat and tatweel normalization
  assert.equal(isAnswerMatch('لِينك', 'Link', ['Link', 'لينك']), true);
  assert.equal(isAnswerMatch('ليـنك', 'Link', ['Link', 'لينك']), true);

  // Auto bilingual synonym expansion even when AI omitted the opposite language in acceptableAnswers
  assert.equal(isAnswerMatch('Link', 'لينك', []), true);
  assert.equal(isAnswerMatch('لينك', 'Link', []), true);
  assert.equal(isAnswerMatch('Kratos', 'كريتوس', []), true);
  assert.equal(isAnswerMatch('كريتوس', 'Kratos', []), true);

  // Definite article "ال" stripping
  assert.equal(isAnswerMatch('السبايك', 'سبايك', []), true);
  assert.equal(isAnswerMatch('سبايك', 'السبايك', []), true);

  // Space-insensitive matching
  assert.equal(isAnswerMatch('ماسترسورد', 'ماستر سورد', []), true);
  assert.equal(isAnswerMatch('سيف الماستر', 'ماستر سورد', []), true);

  // Incorrect answers fail
  assert.equal(isAnswerMatch('سيرفر', 'Link', ['Link', 'لينك']), false);
  assert.equal(isAnswerMatch('server', 'Link', ['Link', 'لينك']), false);
});

test('duelGameManager tracks recent questions and passes them to generateTrivia to avoid repetition', async () => {
  duelGameManager.reset();
  duelGameManager.clearRecentQuestions();
  const receivedPayloads = [];

  const mockSinks = {
    sendChatMessage: async () => true,
    smartModTimeout: async () => ({ ok: true }),
    generateTrivia: async (payload) => {
      receivedPayloads.push(payload);
      const index = receivedPayloads.length;
      return {
        ok: true,
        question: `Question #${index}`,
        answer: `Answer #${index}`,
        acceptableAnswers: [`Answer #${index}`],
      };
    },
    delay: async () => {},
  };

  // Round 1
  await duelGameManager.startDuel({
    challenger: 'Alice',
    opponentRaw: '@Bob',
    mode: 'ai_trivia',
    sinks: mockSinks,
  });

  assert.equal(receivedPayloads[0].recentQuestions.length, 0);
  assert.deepEqual(duelGameManager.getRecentQuestions(), ['Question #1']);

  // Complete Round 1
  await duelGameManager.handleChatMessage({ username: 'Alice', message: 'Answer #1' });

  // Round 2
  await duelGameManager.startDuel({
    challenger: 'Alice',
    opponentRaw: '@Bob',
    mode: 'ai_trivia',
    sinks: mockSinks,
  });

  assert.equal(receivedPayloads[1].recentQuestions.length, 1);
  assert.equal(receivedPayloads[1].recentQuestions[0], 'Question #1');
  assert.deepEqual(duelGameManager.getRecentQuestions(), ['Question #1', 'Question #2']);

  duelGameManager.reset();
  duelGameManager.clearRecentQuestions();
});

test('duelGameManager blocks concurrent 1v1 duel start calls (no 3x repeat)', async () => {
  duelGameManager.reset();
  duelGameManager.clearRecentQuestions();

  let generateCallCount = 0;
  const mockSinks = {
    sendChatMessage: async () => true,
    smartModTimeout: async () => ({ ok: true }),
    generateTrivia: async () => {
      generateCallCount++;
      // Simulate network latency of 30ms
      await new Promise((r) => setTimeout(r, 30));
      return {
        ok: true,
        question: 'Who is Link?',
        answer: 'Hero of Time',
        acceptableAnswers: ['Hero of Time'],
      };
    },
    delay: async () => {},
  };

  // Trigger 3 concurrent duel starts simultaneously (e.g. rapid triple command or redemption duplicate)
  const results = await Promise.all([
    duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', mode: 'ai_trivia', sinks: mockSinks }),
    duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', mode: 'ai_trivia', sinks: mockSinks }),
    duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', mode: 'ai_trivia', sinks: mockSinks }),
  ]);

  const successfulStarts = results.filter((r) => r.ok);
  const duplicateRejections = results.filter((r) => !r.ok && r.error === 'DUEL_ALREADY_IN_PROGRESS');

  assert.equal(successfulStarts.length, 1, 'Only exactly 1 duel start should succeed');
  assert.equal(duplicateRejections.length, 2, 'The other 2 duplicate duel attempts must be blocked');
  assert.equal(generateCallCount, 1, 'generateTrivia should only be called once');

  duelGameManager.reset();
});

test('startDuel allows challenging broadcaster when allowBroadcaster is true and mutes OBS source on loss', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];
  const mutedSources = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    muteStreamerSource: async (sourceName, duration) => { mutedSources.push({ sourceName, duration }); return true; },
    delay: async () => {},
  };

  // Challenger win chance 100% (challengerWinChance: 99), so broadcaster loses
  const res = await duelGameManager.startDuel({
    challenger: 'ViewerChad',
    opponentRaw: '@StreamerBoss',
    broadcasterName: 'StreamerBoss',
    allowBroadcaster: true,
    challengerWinChance: 99,
    timeoutDuration: 60,
    muteStreamerSource: 'Mic/Aux',
    mode: 'random',
    sinks: mockSinks,
  });

  assert.equal(res.ok, true);
  // Broadcaster cannot be timed out on Twitch, so timeouts array should NOT have streamer
  assert.equal(timeouts.length, 0, 'Broadcaster must not be timed out on Twitch IRC');
  // Instead, streamer's OBS source must be muted
  assert.equal(mutedSources.length, 1, 'Broadcaster OBS source should be muted');
  assert.equal(mutedSources[0].sourceName, 'Mic/Aux');
  assert.equal(mutedSources[0].duration, 60);

  duelGameManager.reset();
});

test('startDuel obeys challengerWinChance probabilities', async () => {
  duelGameManager.reset();
  const timeouts = [];
  const mockSinks = {
    sendChatMessage: async () => true,
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    delay: async () => {},
  };

  // When challengerWinChance is 1% (challenger almost always loses, so challenger gets timed out)
  const resLose = await duelGameManager.startDuel({
    challenger: 'UnluckyPlayer',
    opponentRaw: '@Opponent',
    mode: 'random',
    challengerWinChance: 1,
    timeoutDuration: 30,
    sinks: mockSinks,
  });

  assert.equal(resLose.ok, true);
  // Loser is challenger 99% of time
  assert.equal(timeouts[0].target.toLowerCase(), 'unluckyplayer');

  // When challengerWinChance is 99% (challenger almost always wins, so opponent gets timed out)
  const resWin = await duelGameManager.startDuel({
    challenger: 'LuckyPlayer',
    opponentRaw: '@TargetPlayer',
    mode: 'random',
    challengerWinChance: 99,
    timeoutDuration: 30,
    sinks: mockSinks,
  });

  assert.equal(resWin.ok, true);
  assert.equal(timeouts[1].target.toLowerCase(), 'targetplayer');

  duelGameManager.reset();
});

test('streamer 1v1 duel triggers dedicated streamer win/lose outcomes and custom messages', async () => {
  duelGameManager.reset();
  const sentMessages = [];
  const timeouts = [];
  const mutedSources = [];

  const mockSinks = {
    sendChatMessage: async (msg) => { sentMessages.push(msg); return true; },
    smartModTimeout: async (target, duration, reason) => { timeouts.push({ target, duration, reason }); return { ok: true }; },
    muteStreamerSource: async (source, duration) => { mutedSources.push({ source, duration }); return true; },
    delay: async () => {},
  };

  // Case 1: Streamer Loses (challengerWinChance = 100%)
  const resLose = await duelGameManager.startDuel({
    challenger: 'HeroChallenger',
    opponentRaw: '@BigStreamer',
    mode: 'random',
    isStreamerDuel: true,
    broadcasterName: 'BigStreamer',
    broadcasterMuteSource: 'Mic 1',
    challengerWinChance: 100,
    timeoutDuration: 45,
    streamerLoseMessage: 'Streamer {streamer} lost to {challenger}! Source {source} is muted for {duration}s!',
    streamerWinMessage: 'Streamer {streamer} defeated {challenger}!',
    sinks: mockSinks,
  });

  assert.equal(resLose.ok, true);
  // OBS audio source must be muted for 45s
  assert.equal(mutedSources.length, 1);
  assert.equal(mutedSources[0].source, 'Mic 1');
  assert.equal(mutedSources[0].duration, 45);
  // Message must format correctly
  const loseMsg = sentMessages.find((m) => m.includes('lost to HeroChallenger'));
  assert.ok(loseMsg, 'Should send custom streamerLoseMessage');
  assert.ok(loseMsg.includes('Source Mic 1 is muted for 45s'));

  // Case 2: Streamer Wins (challengerWinChance = 0%)
  const resWin = await duelGameManager.startDuel({
    challenger: 'BraveChallenger',
    opponentRaw: '@BigStreamer',
    mode: 'random',
    isStreamerDuel: true,
    broadcasterName: 'BigStreamer',
    challengerWinChance: 0,
    timeoutDuration: 60,
    streamerWinMessage: 'Streamer {streamer} defeated {challenger} who is timed out for {duration}s!',
    sinks: mockSinks,
  });

  assert.equal(resWin.ok, true);
  // Challenger must be timed out
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].target, 'BraveChallenger');
  assert.equal(timeouts[0].duration, 60);
  // Win message formatted
  const winMsg = sentMessages.find((m) => m.includes('defeated BraveChallenger'));
  assert.ok(winMsg, 'Should send custom streamerWinMessage');
  assert.ok(winMsg.includes('timed out for 60s'));

  duelGameManager.reset();
});


test('random duel reports its outcome for If steps', async () => {
  duelGameManager.reset();
  const res = await duelGameManager.startDuel({
    challenger: 'Alice',
    opponentRaw: '@Bob',
    mode: 'random',
    challengerWinChance: 99,
    sinks: {
      sendChatMessage: async () => true,
      smartModTimeout: async () => ({ ok: true }),
      delay: async () => {},
    },
  });
  const outcome = await res.outcome;
  assert.equal(outcome.kind, 'win');
  assert.equal(outcome.winner === 'Alice', outcome.challengerWon);
  assert.equal(outcome.loser === 'Bob', outcome.challengerWon);
});

test('trivia duel outcome resolves on a correct answer and on time-out', async () => {
  duelGameManager.reset();
  const sinks = {
    sendChatMessage: async () => true,
    smartModTimeout: async () => ({ ok: true }),
    generateTrivia: async () => ({ ok: true, question: 'q?', answer: 'Luigi', acceptableAnswers: ['luigi'] }),
    delay: async () => {},
  };

  const started = await duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', mode: 'ai_trivia', sinks });
  await duelGameManager.handleChatMessage({ username: 'Bob', message: 'Luigi' });
  assert.deepEqual(await started.outcome, { kind: 'win', winner: 'Bob', loser: 'Alice', challengerWon: false });

  duelGameManager.reset();
  const second = await duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', mode: 'ai_trivia', sinks });
  duelGameManager.reset(); // cancelled before anyone answered
  assert.equal(await second.outcome, null);
});

test('a shielded viewer still plays; losing sends the shield message instead of a timeout', async () => {
  const sent = [];
  const timeouts = [];
  const sinks = {
    sendChatMessage: async (msg) => { sent.push(msg); return true; },
    smartModTimeout: async (target) => { timeouts.push(target); return { ok: true }; },
    delay: async () => {},
  };
  const run = async (chance) => {
    duelGameManager.reset();
    sent.length = 0;
    timeouts.length = 0;
    return duelGameManager.startDuel({
      challenger: 'Alice',
      opponentRaw: '@Bob',
      mode: 'random',
      challengerWinChance: chance,
      isProtected: (user) => user.toLowerCase() === 'bob',
      protectedMessage: '@{protected} has a shield!',
      sinks,
    });
  };

  // Alice always wins: Bob loses but is shielded, so no timeout and the shield message is sent
  const bobLoses = await run(99);
  assert.equal(bobLoses.ok, true);
  assert.deepEqual(timeouts, []);
  assert.ok(sent.includes('@Bob has a shield!'));

  // Alice always loses: she is not shielded, so she is timed out normally
  const aliceLoses = await run(1);
  assert.equal(aliceLoses.ok, true);
  assert.deepEqual(timeouts, ['Alice']);
  assert.ok(!sent.includes('@Bob has a shield!'));
});

test('a shielded streamer-duel challenger who loses is not timed out; one who wins mutes the streamer', async () => {
  const sent = [];
  const timeouts = [];
  const muted = [];
  const run = async (chance) => {
    duelGameManager.reset();
    sent.length = 0;
    timeouts.length = 0;
    muted.length = 0;
    return duelGameManager.startDuel({
      challenger: 'Mallory',
      opponentRaw: '',
      mode: 'random',
      challengerWinChance: chance,
      isStreamerDuel: true,
      broadcasterName: 'Streamer',
      isProtected: (user) => user === 'Mallory',
      sinks: {
        sendChatMessage: async (msg) => { sent.push(msg); return true; },
        smartModTimeout: async (target) => { timeouts.push(target); return { ok: true }; },
        muteStreamerSource: async (src) => { muted.push(src); return true; },
        delay: async () => {},
      },
    });
  };

  await run(1); // streamer wins
  assert.deepEqual(timeouts, []);
  assert.ok(sent.some((m) => m.includes('@Mallory') && m.includes('has a shield')));

  await run(99); // shielded challenger wins: normal behaviour
  assert.equal(muted.length, 1);
  assert.deepEqual(timeouts, []);
  assert.ok(!sent.some((m) => m.includes('has a shield')));
});

test('a shielded viewer can have their own reply; others use the shared reply', async () => {
  duelGameManager.reset();
  const sent = [];
  const sinks = {
    sendChatMessage: async (msg) => { sent.push(msg); return true; },
    smartModTimeout: async () => ({ ok: true }),
    delay: async () => {},
  };
  const shared = {
    mode: 'random',
    challengerWinChance: 99,
    isProtected: (user) => ['bob', 'carol'].includes(user.toLowerCase()),
    protectedMessage: 'shared: {protected} is shielded',
    protectedMessageFor: (user) => (user.toLowerCase() === 'bob' ? "bob's own: {protected} is busy" : undefined),
    sinks,
  };
  await duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Bob', ...shared });
  await duelGameManager.startDuel({ challenger: 'Alice', opponentRaw: '@Carol', ...shared });
  assert.ok(sent.includes("bob's own: Bob is busy"));
  assert.ok(sent.includes('shared: Carol is shielded'));
});
