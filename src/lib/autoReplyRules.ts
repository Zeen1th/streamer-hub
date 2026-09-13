import { extractBaseTitle, hasCounterPattern, stripCounterFromTitle } from './counterRules.ts';
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
  if (mode === 'startsWith') return normalizedMessage.startsWith(normalizedTrigger);
  if (mode === 'contains') return normalizedMessage.includes(normalizedTrigger);
  if (mode === 'regex') {
    try {
      return new RegExp(normalizedTrigger, 'u').test(message);
    } catch {
      return false;
    }
  }
  return normalizedMessage === normalizedTrigger;
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

export function checkUserRestriction(
  restriction: AiUserRestriction | undefined,
  targetUsers: readonly string[] | undefined,
  username: string,
): boolean {
  if (!restriction || restriction === 'none') return true;
  const cleanUser = normalizeUsername(username);
  if (!cleanUser) return false;
  const set = new Set((targetUsers ?? []).map(normalizeUsername).filter(Boolean));
  if (restriction === 'allowlist') {
    return set.has(cleanUser);
  }
  if (restriction === 'blocklist') {
    return !set.has(cleanUser);
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

  const cleanUser = normalizeUsername(message.username);
  const text = message.message.toLowerCase();

  for (const condition of conditions) {
    let matched = false;

    if (condition.ifType === 'username') {
      const targets = condition.ifValue
        .split(/[,;\s]+/)
        .map(normalizeUsername)
        .filter(Boolean);
      matched = targets.includes(cleanUser);
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

export function selectBestMatchingAutoReply<T extends {
  enabled: boolean;
  responseMode?: 'static' | 'ai';
  aiUserRestriction?: AiUserRestriction;
  aiTargetUsers?: string[];
}>(candidates: readonly T[]): T | null {
  if (!candidates.length) return null;
  // Specific user targeted AI rules (allowlist) take precedence over general broadcast rules
  const specificRule = candidates.find(
    (r) => r.responseMode === 'ai' && r.aiUserRestriction === 'allowlist',
  );
  return specificRule ?? candidates[0];
}

