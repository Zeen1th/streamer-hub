import { extractBaseTitle, hasCounterPattern, stripCounterFromTitle } from './counterRules.ts';
import { chatterIdentifiersMatch } from './chatterNormalization.ts';
import type { AiConditionRule, AiUserRestriction, ChatMessage } from '../rpc/contracts';

export interface AutoReplyRule {
  id: string;
  trigger: string;
  response: string;
  enabled: boolean;
  cooldownSeconds: number;
  matchMode: 'exact' | 'startsWith' | 'contains' | 'regex';
}

export type AutoReplyMatchMode = AutoReplyRule['matchMode'];

export function normalizeTrigger(value: string): string {
  return value.trim();
}

export function directionFromStart(value: string): 'ltr' | 'rtl' {
  const first = value.trimStart().charAt(0);
  return /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u.test(first) ? 'rtl' : 'ltr';
}

export function matchesAutoReply(message: string, trigger: string, mode: AutoReplyMatchMode = 'exact'): boolean {
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!normalizedTrigger) return false;
  const normalizedMessage = normalizeTrigger(message);
  if (!normalizedMessage) return false;

  if (mode === 'regex') {
    try {
      return new RegExp(normalizedTrigger, 'iu').test(message);
    } catch {
      return false;
    }
  }

  const lowerMsg = normalizedMessage.toLowerCase();
  const lowerTrig = normalizedTrigger.toLowerCase();

  const trigWithBang = lowerTrig.startsWith('!') ? lowerTrig : '!' + lowerTrig;
  const trigNoBang = lowerTrig.startsWith('!') ? lowerTrig.slice(1) : lowerTrig;

  if (mode === 'startsWith') {
    return (
      lowerMsg.startsWith(lowerTrig) ||
      lowerMsg.startsWith(trigWithBang) ||
      lowerMsg.startsWith(trigNoBang)
    );
  }

  if (mode === 'contains') {
    return (
      lowerMsg.includes(lowerTrig) ||
      lowerMsg.includes(trigWithBang) ||
      lowerMsg.includes(trigNoBang)
    );
  }

  // Exact mode
  // 1. Direct case-insensitive match
  if (lowerMsg === lowerTrig) return true;

  // 2. Tolerance for optional leading '!' prefix in command triggers
  if (lowerMsg === trigWithBang || lowerMsg === trigNoBang) return true;

  // 3. Command boundary matching: match if message starts with the command followed by arguments
  const hasCommandPrefix = lowerTrig.startsWith('!') || lowerMsg.startsWith('!');
  if (hasCommandPrefix) {
    if (lowerMsg.startsWith(trigWithBang + ' ') || lowerMsg.startsWith(trigNoBang + ' ')) {
      return true;
    }
  }

  // 4. Counter commands with trailing numeric delta (e.g. '!death+1', '!death+ 1', '!death- 2')
  if (lowerTrig.endsWith('+') || lowerTrig.endsWith('-')) {
    if (lowerMsg.startsWith(trigWithBang) || lowerMsg.startsWith(trigNoBang)) {
      const rest = lowerMsg.startsWith(trigWithBang)
        ? lowerMsg.slice(trigWithBang.length).trim()
        : lowerMsg.slice(trigNoBang.length).trim();
      if (!rest || /^\d+$/.test(rest)) {
        return true;
      }
    }
  }

  return false;
}

export function matchesAnyAutoReply(message: string, triggers: string[], mode: AutoReplyMatchMode = 'exact'): boolean {
  return triggers.some((trigger) => matchesAutoReply(message, trigger, mode));
}

export function titleActionDirection(
  message: string,
  increaseCommand: string,
  decreaseCommand: string,
  mode: AutoReplyMatchMode = 'exact',
): 'increase' | 'decrease' | null {
  const increase = increaseCommand.trim();
  const decrease = decreaseCommand.trim();
  const increaseMatches = Boolean(increase && matchesAutoReply(message, increase, mode));
  const decreaseMatches = Boolean(decrease && matchesAutoReply(message, decrease, mode));
  if (increaseMatches === decreaseMatches && increaseMatches) return null;
  if (increaseMatches) return 'increase';
  if (decreaseMatches) return 'decrease';
  return null;
}

export function renderAutoReply(template: string, message: { username: string; message: string }): string {
  const mention = message.username ? `@${message.username}` : '';
  return template
    .replaceAll('{username}', message.username)
    .replaceAll('{mention}', mention)
    .replaceAll('{message}', message.message);
}

export function nextTitleCounters<T extends { count: number }>(counters: readonly T[], direction: 'increase' | 'decrease'): T[] {
  const delta = direction === 'increase' ? 1 : -1;
  return counters.map((counter) => ({ ...counter, count: Math.max(0, Math.trunc(counter.count) + delta) }));
}

export function normalizeAutoReplyTemplate(template: string): string {
  return template.replace(/\{count\d*\}/g, '{count}');
}

export function hasAutoReplyTitlePattern(rawTitle: string, template?: string | null): boolean {
  if (!rawTitle?.trim() || !template?.trim()) return false;
  return hasCounterPattern(rawTitle, normalizeAutoReplyTemplate(template));
}

export function stripAutoReplyFromTitle(rawTitle: string, template?: string | null): string {
  if (!rawTitle?.trim()) return '';
  if (!template?.trim()) return rawTitle.trim();
  return stripCounterFromTitle(rawTitle, normalizeAutoReplyTemplate(template));
}

export function renderStreamTitle(
  template: string,
  counts: number | Record<string, number>,
  currentTitle?: string | null,
): string {
  const normalized = normalizeAutoReplyTemplate(template);
  const base = currentTitle ? extractBaseTitle(currentTitle, normalized) : '';
  let rendered = template
    .replaceAll('{current_title}', base)
    .replaceAll('{title}', base);

  if (typeof counts === 'number') {
    return rendered.replaceAll('{count}', String(Math.max(0, Math.trunc(counts))));
  }

  rendered = rendered.replace(/\{(count\d+)\}/g, (_, token: string) => String(Math.max(0, Math.trunc(counts[token] ?? 0))));
  if (rendered.includes('{count}')) {
    const fallback = counts.count ?? counts.count1 ?? 0;
    rendered = rendered.replaceAll('{count}', String(Math.max(0, Math.trunc(fallback))));
  }
  return rendered;
}

export function insertTemplateToken(value: string, token: string, cursor: number | null): string {
  const index = cursor === null ? value.length : Math.max(0, Math.min(cursor, value.length));
  return `${value.slice(0, index)}${token}${value.slice(index)}`;
}

export function insertReplyToken(
  value: string,
  token: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; caret: number } {
  const clamp = (offset: number | null, fallback: number) => (
    offset === null ? fallback : Math.max(0, Math.min(Math.trunc(offset), value.length))
  );
  const anchor = clamp(selectionStart, value.length);
  const focus = clamp(selectionEnd, anchor);
  const start = Math.min(anchor, focus);
  const end = Math.max(anchor, focus);
  return {
    value: `${value.slice(0, start)}${token}${value.slice(end)}`,
    caret: start + token.length,
  };
}

export function cooldownRemainingSeconds(
  now: number,
  lastTriggeredAt: number | null,
  cooldownSeconds: number,
): number | null {
  if (cooldownSeconds <= 0 || lastTriggeredAt === null) return null;
  const remaining = Math.ceil((lastTriggeredAt + cooldownSeconds * 1000 - now) / 1000);
  return remaining > 0 ? remaining : null;
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '').toLowerCase();
}

export type ChatterResolver = (query: string) => { userId?: string; login?: string; displayName?: string } | undefined;

let activeChatterResolver: ChatterResolver | null = null;

export function setChatterResolver(resolver: ChatterResolver | null): void {
  activeChatterResolver = resolver;
}

export function messageMatchesChatterTarget(
  target: string,
  messageOrUser: ChatMessage | string,
  knownAliases?: { userId?: string; login?: string; displayName?: string } | null,
): boolean {
  if (!target) return false;

  if (typeof messageOrUser === 'string') {
    if (chatterIdentifiersMatch(target, messageOrUser)) return true;
    const aliases = knownAliases ?? (activeChatterResolver ? activeChatterResolver(messageOrUser) : undefined);
    if (aliases) {
      if (aliases.userId && chatterIdentifiersMatch(target, aliases.userId)) return true;
      if (aliases.login && chatterIdentifiersMatch(target, aliases.login)) return true;
      if (aliases.displayName && chatterIdentifiersMatch(target, aliases.displayName)) return true;
    }
    return false;
  }

  const message = messageOrUser;

  // 1. Direct match against any field on the message
  if (message.username && chatterIdentifiersMatch(target, message.username)) return true;
  if (message.displayName && chatterIdentifiersMatch(target, message.displayName)) return true;
  if (message.userLogin && chatterIdentifiersMatch(target, message.userLogin)) return true;
  if (message.userId && chatterIdentifiersMatch(target, message.userId)) return true;

  // 2. Check known aliases (from parameter or active resolver)
  const aliases = knownAliases ?? (activeChatterResolver ? activeChatterResolver(message.userId || message.username) : undefined);

  if (aliases) {
    if (aliases.userId && chatterIdentifiersMatch(target, aliases.userId)) return true;
    if (aliases.login && chatterIdentifiersMatch(target, aliases.login)) return true;
    if (aliases.displayName && chatterIdentifiersMatch(target, aliases.displayName)) return true;
  }

  return false;
}

export function checkUserRestriction(
  restriction: AiUserRestriction | undefined,
  targetUsers: readonly string[] | undefined,
  usernameOrMessage: string | ChatMessage,
): boolean {
  if (!restriction || restriction === 'none') return true;
  if (!targetUsers || targetUsers.length === 0) {
    return restriction === 'blocklist';
  }

  const isMatched = targetUsers.some((target) => messageMatchesChatterTarget(target, usernameOrMessage));

  if (restriction === 'allowlist') {
    return isMatched;
  }
  if (restriction === 'blocklist') {
    return !isMatched;
  }
  return true;
}

export interface AiConditionEvaluationResult {
  action: 'proceed' | 'ignore' | 'static_reply';
  instructions: string;
  staticReply?: string;
  matchedCondition?: AiConditionRule;
}

export function evaluateAiConditions(
  conditions: readonly AiConditionRule[] | undefined,
  message: ChatMessage,
  defaultInstructions: string,
): AiConditionEvaluationResult {
  if (!conditions || conditions.length === 0) {
    return { action: 'proceed', instructions: defaultInstructions };
  }

  const text = message.message.toLowerCase();

  for (const condition of conditions) {
    let matched = false;

    if (condition.ifType === 'username') {
      const targets = condition.ifValue
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      matched = targets.some((target) => messageMatchesChatterTarget(target, message));
    } else if (condition.ifType === 'role') {
      const role = condition.ifValue.trim().toLowerCase();
      if (role === 'broadcaster') matched = message.isBroadcaster;
      else if (role === 'mod' || role === 'moderator') matched = message.isMod || message.isBroadcaster;
      else if (role === 'vip') matched = message.isVip || message.isMod || message.isBroadcaster;
      else if (role === 'subscriber' || role === 'sub') matched = message.isSubscriber || message.isMod || message.isBroadcaster;
    } else if (condition.ifType === 'message_contains') {
      const query = condition.ifValue.trim().toLowerCase();
      if (query && text.includes(query)) {
        matched = true;
      }
    }

    if (matched) {
      if (condition.thenType === 'ignore') {
        return { action: 'ignore', instructions: '', matchedCondition: condition };
      }
      if (condition.thenType === 'static_reply') {
        return { action: 'static_reply', instructions: '', staticReply: condition.thenValue, matchedCondition: condition };
      }
      if (condition.thenType === 'instructions') {
        return { action: 'proceed', instructions: condition.thenValue || defaultInstructions, matchedCondition: condition };
      }
    }
  }

  return { action: 'proceed', instructions: defaultInstructions };
}

export type RuleExecutionPlan =
  | { type: 'ignore'; reason?: string; matchedCondition?: AiConditionRule }
  | { type: 'static'; text: string; isOverride: boolean; matchedCondition?: AiConditionRule }
  | { type: 'ai'; instructions: string; isOverride: boolean; matchedCondition?: AiConditionRule };

export function evaluateRuleExecution(
  rule: {
    responseMode?: 'static' | 'ai';
    response?: string;
    aiInstructions?: string;
    aiConditions?: readonly AiConditionRule[];
  },
  message: ChatMessage,
): RuleExecutionPlan {
  const isAi = rule.responseMode === 'ai';

  // 1. Evaluate any chatter condition overrides first (Priority 1)
  if (rule.aiConditions && rule.aiConditions.length > 0) {
    const condResult = evaluateAiConditions(rule.aiConditions, message, rule.aiInstructions ?? '');
    if (condResult.action === 'ignore') {
      return { type: 'ignore', reason: 'Ignored by chatter condition', matchedCondition: condResult.matchedCondition };
    }
    // Prepared commands cannot have an AI reply; only static (normal text) overrides are executed
    if (!isAi && condResult.action === 'static_reply' && condResult.staticReply !== undefined) {
      return { type: 'static', text: condResult.staticReply, isOverride: true, matchedCondition: condResult.matchedCondition };
    }
    // AI commands cannot have a normal text response; only AI instructions overrides are executed
    if (isAi && condResult.matchedCondition && condResult.matchedCondition.thenType === 'instructions') {
      return { type: 'ai', instructions: condResult.instructions, isOverride: true, matchedCondition: condResult.matchedCondition };
    }
  }

  // 2. Default route (Priority 2: for standard chatters)
  if (isAi) {
    return { type: 'ai', instructions: rule.aiInstructions ?? '', isOverride: false };
  }
  return { type: 'static', text: rule.response ?? '', isOverride: false };
}

export function selectBestMatchingAutoReply<T extends {
  id?: string;
  enabled: boolean;
  responseMode?: 'static' | 'ai';
  aiUserRestriction?: AiUserRestriction;
  aiTargetUsers?: readonly string[];
  aiConditions?: readonly AiConditionRule[];
}>(candidates: readonly T[], username?: string, message?: ChatMessage): T | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const targetIdentifier = message ?? username ?? '';

  // Priority 1: Check for candidate that has an explicit match for THIS specific user
  if (targetIdentifier) {
    // 1a. Rule with allowlist containing this user
    const allowlistMatch = candidates.find(
      (r) => r.aiUserRestriction === 'allowlist' &&
             (r.aiTargetUsers ?? []).some((t) => messageMatchesChatterTarget(t, targetIdentifier)),
    );
    if (allowlistMatch) return allowlistMatch;

    // 1b. Rule with aiConditions matching this user (or role if message is provided)
    if (message) {
      const conditionMatch = candidates.find((r) => {
        if (!r.aiConditions || r.aiConditions.length === 0) return false;
        const res = evaluateAiConditions(r.aiConditions, message, '');
        return res.matchedCondition !== undefined;
      });
      if (conditionMatch) return conditionMatch;
    }
  }

  // Priority 2: Candidates that are not restricted to someone else
  const nonRestricted = candidates.filter((r) => {
    if (r.aiUserRestriction === 'allowlist') {
      return targetIdentifier && (r.aiTargetUsers ?? []).some((t) => messageMatchesChatterTarget(t, targetIdentifier));
    }
    return true;
  });

  const pool = nonRestricted.length > 0 ? nonRestricted : candidates;

  // Prefer static replies as fast default fallback over generic AI
  const staticRule = pool.find((r) => r.responseMode !== 'ai');
  return staticRule ?? pool[0];
}

export function isSenderIgnoredForAutoReply(
  message: { username?: string; userLogin?: string; isSelf?: boolean; isBroadcaster?: boolean; id?: string },
  broadcasterChannel?: string | null,
  botLogin?: string | null,
): boolean {
  if (message.isSelf || message.id?.startsWith('self-')) return true;
  const senderLogin = (message.userLogin || message.username || '').trim().toLowerCase();
  const cleanBroadcaster = (broadcasterChannel || '').trim().toLowerCase();
  const cleanBot = (botLogin || '').trim().toLowerCase();
  if (cleanBot && senderLogin === cleanBot && (!cleanBroadcaster || cleanBot !== cleanBroadcaster)) return true;
  return false;
}

export class MessageDeduplicator {
  private readonly recentIds = new Set<string>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  public isDuplicate(id: string | undefined): boolean {
    if (!id) return false;
    if (this.recentIds.has(id)) return true;
    if (this.recentIds.size >= this.maxEntries) {
      const first = this.recentIds.values().next().value;
      if (first) this.recentIds.delete(first);
    }
    this.recentIds.add(id);
    return false;
  }

  public clear(): void {
    this.recentIds.clear();
  }
}
