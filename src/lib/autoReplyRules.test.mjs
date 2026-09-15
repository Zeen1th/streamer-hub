import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkUserRestriction,
  cooldownRemainingSeconds,
  directionFromStart,
  evaluateAiConditions,
  evaluateRuleExecution,
  hasAutoReplyTitlePattern,
  insertReplyToken,
  insertTemplateToken,
  matchesAnyAutoReply,
  matchesAutoReply,
  nextTitleCounters,
  renderAutoReply,
  renderStreamTitle,
  selectBestMatchingAutoReply,
  stripAutoReplyFromTitle,
  titleActionDirection,
} from './autoReplyRules.ts';

test('matches trimmed Unicode text exactly', () => {
  assert.equal(matchesAutoReply('  السلام عليكم  ', 'السلام عليكم'), true);
  assert.equal(matchesAutoReply('السلام عليكم ورحمة الله', 'السلام عليكم'), false);
});

test('reports only active cooldown seconds', () => {
  assert.equal(cooldownRemainingSeconds(15_000, 10_000, 10), 5);
  assert.equal(cooldownRemainingSeconds(21_000, 10_000, 10), null);
  assert.equal(cooldownRemainingSeconds(15_000, null, 10), null);
});

test('supports starts-with and contains matching modes', () => {
  assert.equal(matchesAutoReply('السلام عليكم يا جماعة', 'السلام عليكم', 'startsWith'), true);
  assert.equal(matchesAutoReply('يا السلام عليكم يا جماعة', 'السلام عليكم', 'startsWith'), false);
  assert.equal(matchesAutoReply('رد السلام عليكم من فضلك', 'السلام عليكم', 'contains'), true);
});

test('renders viewer placeholders', () => {
  assert.equal(
    renderAutoReply('@{username} · {mention} · {message}', { username: 'viewer', message: 'hello' }),
    '@viewer · @viewer · hello',
  );
});

test('renders the stream title counter placeholder', () => {
  assert.equal(renderStreamTitle('BG3 act {count1} · part {count2}', { count1: 200, count2: 4 }), 'BG3 act 200 · part 4');
});

test('inserts a dragged placeholder at the saved cursor position', () => {
  assert.equal(insertTemplateToken('Hello world', '{mention}', 6), 'Hello {mention}world');
  assert.equal(insertTemplateToken('Hello world', '{mention}', null), 'Hello world{mention}');
});

test('inserts a prepared-response token at the text selection and places the caret after it', () => {
  assert.deepEqual(insertReplyToken('Hello viewer', '{mention}', 6, 12), {
    value: 'Hello {mention}',
    caret: 15,
  });
  assert.deepEqual(insertReplyToken('Hello', '{message}', null, null), {
    value: 'Hello{message}',
    caret: 14,
  });
});

test('sets direction from the first non-space character', () => {
  assert.equal(directionFromStart('  السلام عليكم'), 'rtl');
  assert.equal(directionFromStart('  Hello السلام'), 'ltr');
  assert.equal(directionFromStart(''), 'ltr');
});

test('matches when any configured trigger matches', () => {
  assert.equal(matchesAnyAutoReply('سلام عليكم', ['السلام عليكم', 'سلام عليكم'], 'exact'), true);
  assert.equal(matchesAnyAutoReply('مرحبا', ['السلام عليكم', 'سلام عليكم'], 'exact'), false);
});

test('advances title counters before rendering command results', () => {
  const counters = [{ id: 'count1', start: 1, count: 4 }, { id: 'count2', start: 10, count: 12 }];
  assert.deepEqual(nextTitleCounters(counters, 'increase'), [
    { id: 'count1', start: 1, count: 5 },
    { id: 'count2', start: 10, count: 13 },
  ]);
  assert.deepEqual(nextTitleCounters(counters, 'decrease'), [
    { id: 'count1', start: 1, count: 3 },
    { id: 'count2', start: 10, count: 11 },
  ]);
});

test('selects increase and decrease title commands independently', () => {
  assert.equal(titleActionDirection('next', 'next', 'previous', 'exact'), 'increase');
  assert.equal(titleActionDirection('previous', 'next', 'previous', 'exact'), 'decrease');
  assert.equal(titleActionDirection('next', '', '', 'exact'), null);
  assert.equal(titleActionDirection('other', 'next', 'previous', 'exact'), null);
  assert.equal(titleActionDirection('count down', 'count', 'count down', 'contains'), null);
});

test('renders stream title with base title extraction and prevents compounding', () => {
  const template = '{title} | Act {count1} · Part {count2}';
  const initial = renderStreamTitle(template, { count1: 1, count2: 1 }, 'Elden Ring Run');
  assert.equal(initial, 'Elden Ring Run | Act 1 · Part 1');

  // Next increment using the live title as input
  const next = renderStreamTitle(template, { count1: 1, count2: 2 }, initial);
  assert.equal(next, 'Elden Ring Run | Act 1 · Part 2');

  // Third increment: no compounding
  const third = renderStreamTitle(template, { count1: 2, count2: 1 }, next);
  assert.equal(third, 'Elden Ring Run | Act 2 · Part 1');
});

test('detects auto-reply title pattern in live stream titles', () => {
  const template = '{title} | Act {count1} · Part {count2}';
  assert.equal(hasAutoReplyTitlePattern('Elden Ring | Act 1 · Part 1', template), true);
  assert.equal(hasAutoReplyTitlePattern('Playing Elden Ring | Act 3 · Part 9', template), true);
  // When streamer manually changed title away from the counter format
  assert.equal(hasAutoReplyTitlePattern('Just Chatting with chat tonight', template), false);
  assert.equal(hasAutoReplyTitlePattern('Valorant Competitive Ranked', template), false);
});

test('detects template pattern without {title} token', () => {
  const template = 'BG3 Act {count1} · Part {count2}';
  assert.equal(hasAutoReplyTitlePattern('BG3 Act 2 · Part 4', template), true);
  assert.equal(hasAutoReplyTitlePattern('Apex Legends with viewers', template), false);
});

test('strips auto-reply counter suffix cleanly when stopping counter', () => {
  const template = '{title} | Act {count1} · Part {count2}';
  const liveTitle = 'Chilling and Gaming | Act 2 · Part 5';
  assert.equal(stripAutoReplyFromTitle(liveTitle, template), 'Chilling and Gaming');

  // If template has no {title} token, returns original title rather than blanking out
  const noTitleTemplate = 'Act {count1} · Part {count2}';
  assert.equal(stripAutoReplyFromTitle('Act 2 · Part 5', noTitleTemplate), 'Act 2 · Part 5');
});

test('checkUserRestriction enforces allowlist, blocklist, and none', () => {
  // 'none' allows anyone
  assert.equal(checkUserRestriction('none', ['basil'], 'anyone'), true);
  assert.equal(checkUserRestriction(undefined, [], 'anyone'), true);

  // 'allowlist' allows only specified users, case-insensitive, with/without @
  assert.equal(checkUserRestriction('allowlist', ['@basil', 'streamer'], 'basil'), true);
  assert.equal(checkUserRestriction('allowlist', ['@basil', 'streamer'], 'STREAMER'), true);
  assert.equal(checkUserRestriction('allowlist', ['@basil', 'streamer'], 'random_viewer'), false);

  // 'blocklist' blocks specified users
  assert.equal(checkUserRestriction('blocklist', ['@spammer', 'bot1'], 'spammer'), false);
  assert.equal(checkUserRestriction('blocklist', ['@spammer', 'bot1'], 'BOT1'), false);
  assert.equal(checkUserRestriction('blocklist', ['@spammer', 'bot1'], 'basil'), true);
});

test('evaluateAiConditions evaluates username, role, and keyword IF statements', () => {
  const defaultInstructions = 'Reply with a friendly welcome message.';
  const conditions = [
    {
      id: '1',
      ifType: 'username',
      ifValue: '@basil',
      thenType: 'instructions',
      thenValue: 'Give Basil a VIP royal greeting and say he is a legend!',
    },
    {
      id: '2',
      ifType: 'role',
      ifValue: 'mod',
      thenType: 'static_reply',
      thenValue: 'Welcome back moderator {mention}!',
    },
    {
      id: '3',
      ifType: 'message_contains',
      ifValue: 'mute me',
      thenType: 'ignore',
      thenValue: '',
    },
  ];

  // Basil triggers rule 1: custom instructions
  const basilMsg = { id: 'm1', username: 'basil', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const basilResult = evaluateAiConditions(conditions, basilMsg, defaultInstructions);
  assert.equal(basilResult.action, 'proceed');
  assert.equal(basilResult.instructions, 'Give Basil a VIP royal greeting and say he is a legend!');
  assert.equal(basilResult.matchedCondition?.id, '1');

  // Mod triggers rule 2: static reply
  const modMsg = { id: 'm2', username: 'alex', message: 'hey everyone', isBroadcaster: false, isMod: true, isVip: false, isSubscriber: false };
  const modResult = evaluateAiConditions(conditions, modMsg, defaultInstructions);
  assert.equal(modResult.action, 'static_reply');
  assert.equal(modResult.staticReply, 'Welcome back moderator {mention}!');
  assert.equal(modResult.matchedCondition?.id, '2');

  // "mute me" triggers rule 3: ignore
  const spamMsg = { id: 'm3', username: 'troll', message: 'please mute me now', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const spamResult = evaluateAiConditions(conditions, spamMsg, defaultInstructions);
  assert.equal(spamResult.action, 'ignore');
  assert.equal(spamResult.matchedCondition?.id, '3');

  // Ordinary viewer falls back to default instructions
  const viewerMsg = { id: 'm4', username: 'ordinary_guy', message: 'hello world', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const viewerResult = evaluateAiConditions(conditions, viewerMsg, defaultInstructions);
  assert.equal(viewerResult.action, 'proceed');
  assert.equal(viewerResult.instructions, defaultInstructions);
  assert.equal(viewerResult.matchedCondition, undefined);
});

test('selectBestMatchingAutoReply prioritizes specific user-targeted rules over general broadcast rules', () => {
  const generalRule = {
    id: 'rule-general',
    enabled: true,
    responseMode: 'ai',
    aiUserRestriction: 'none',
    aiTargetUsers: [],
    aiInstructions: 'Welcome generally',
  };

  const basilRule = {
    id: 'rule-basil',
    enabled: true,
    responseMode: 'ai',
    aiUserRestriction: 'allowlist',
    aiTargetUsers: ['basil'],
    aiInstructions: 'Welcome Basil VIP',
  };

  // Both match triggers, but basil is in candidate list:
  const candidatesForBasil = [generalRule, basilRule];
  const matched = selectBestMatchingAutoReply(candidatesForBasil, 'basil');
  assert.equal(matched?.id, 'rule-basil');

  // If basilRule is not a candidate (e.g. for viewer alice):
  const candidatesForAlice = [generalRule];
  const matchedAlice = selectBestMatchingAutoReply(candidatesForAlice, 'alice');
  assert.equal(matchedAlice?.id, 'rule-general');
});

test('selectBestMatchingAutoReply resolves duplicate trigger candidates by chatter specificity', () => {
  const staticRule = {
    id: 'static-hello',
    enabled: true,
    responseMode: 'static',
    response: 'Welcome {username}!',
  };
  const aiVipRule = {
    id: 'ai-vip-hello',
    enabled: true,
    responseMode: 'ai',
    aiUserRestriction: 'allowlist',
    aiTargetUsers: ['vip_streamer'],
    aiInstructions: 'Greet the VIP streamer warmly',
  };

  const allCandidates = [staticRule, aiVipRule];

  // VIP user gets the AI VIP rule
  const vipResult = selectBestMatchingAutoReply(allCandidates, 'vip_streamer');
  assert.equal(vipResult?.id, 'ai-vip-hello');

  // Standard user falls back to the fast static rule
  const normalResult = selectBestMatchingAutoReply(allCandidates, 'random_viewer');
  assert.equal(normalResult?.id, 'static-hello');
});

test('evaluateRuleExecution enforces mode isolation: Prepared commands reject AI replies, AI commands reject static replies', () => {
  // Prepared command: only static text and ignore allowed
  const preparedRule = {
    id: 'prep-1',
    responseMode: 'static',
    response: 'Welcome to the channel, {username}!',
    aiConditions: [
      {
        id: 'c1',
        ifType: 'username',
        ifValue: 'special_friend',
        thenType: 'static_reply',
        thenValue: 'Welcome my best friend {mention}!',
      },
      {
        id: 'c2',
        ifType: 'username',
        ifValue: 'banned_spammer',
        thenType: 'ignore',
        thenValue: '',
      },
      {
        id: 'c3_invalid_ai',
        ifType: 'username',
        ifValue: 'ai_fan',
        thenType: 'instructions',
        thenValue: 'This AI instruction should NOT execute because rule is Prepared',
      },
    ],
  };

  // 1. Friend matches static override -> static custom reply
  const friendMsg = { id: '1', username: 'special_friend', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const friendPlan = evaluateRuleExecution(preparedRule, friendMsg);
  assert.equal(friendPlan.type, 'static');
  assert.equal(friendPlan.isOverride, true);
  assert.equal(friendPlan.text, 'Welcome my best friend {mention}!');

  // 2. Spammer matches ignore override -> ignore/silent
  const spamMsg = { id: '2', username: 'banned_spammer', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const spamPlan = evaluateRuleExecution(preparedRule, spamMsg);
  assert.equal(spamPlan.type, 'ignore');

  // 3. User matching AI instruction condition does NOT get AI reply because rule is Prepared (falls back to default static)
  const aiFanMsg = { id: '3', username: 'ai_fan', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const aiFanPlan = evaluateRuleExecution(preparedRule, aiFanMsg);
  assert.equal(aiFanPlan.type, 'static');
  assert.equal(aiFanPlan.isOverride, false);
  assert.equal(aiFanPlan.text, 'Welcome to the channel, {username}!');

  // 4. Standard viewer falls back to default static response
  const viewerMsg = { id: '4', username: 'normal_viewer', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const viewerPlan = evaluateRuleExecution(preparedRule, viewerMsg);
  assert.equal(viewerPlan.type, 'static');
  assert.equal(viewerPlan.isOverride, false);

  // AI command: only AI instructions and ignore allowed
  const aiRule = {
    id: 'ai-1',
    responseMode: 'ai',
    aiInstructions: 'Default AI persona banter',
    aiConditions: [
      {
        id: 'a1',
        ifType: 'username',
        ifValue: 'special_friend',
        thenType: 'instructions',
        thenValue: 'Roast my friend playfully',
      },
      {
        id: 'a2',
        ifType: 'username',
        ifValue: 'banned_spammer',
        thenType: 'ignore',
        thenValue: '',
      },
      {
        id: 'a3_invalid_static',
        ifType: 'username',
        ifValue: 'static_fan',
        thenType: 'static_reply',
        thenValue: 'This normal text should NOT execute because rule is AI',
      },
    ],
  };

  // 5. Friend matches AI override -> AI instructions
  const aiFriendPlan = evaluateRuleExecution(aiRule, friendMsg);
  assert.equal(aiFriendPlan.type, 'ai');
  assert.equal(aiFriendPlan.isOverride, true);
  assert.equal(aiFriendPlan.instructions, 'Roast my friend playfully');

  // 6. Spammer matches ignore override on AI rule -> ignore/silent
  const aiSpamPlan = evaluateRuleExecution(aiRule, spamMsg);
  assert.equal(aiSpamPlan.type, 'ignore');

  // 7. User matching static reply condition on AI rule does NOT get static response (falls back to default AI instructions)
  const staticFanMsg = { id: '5', username: 'static_fan', message: 'hello', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false };
  const staticFanPlan = evaluateRuleExecution(aiRule, staticFanMsg);
  assert.equal(staticFanPlan.type, 'ai');
  assert.equal(staticFanPlan.isOverride, false);
  assert.equal(staticFanPlan.instructions, 'Default AI persona banter');
});


