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

export function renderAutoReply(template: string, message: { username: string; message: string }): string {
  const mention = message.username ? `@${message.username}` : '';
  return template
    .replaceAll('{username}', message.username)
    .replaceAll('{mention}', mention)
    .replaceAll('{message}', message.message);
}

export function renderStreamTitle(template: string, counts: number | Record<string, number>): string {
  if (typeof counts === 'number') return template.replaceAll('{count}', String(Math.max(0, Math.trunc(counts))));
  return template.replace(/\{(count\d+)\}/g, (_, token: string) => String(Math.max(0, Math.trunc(counts[token] ?? 0))));
}

export function insertTemplateToken(value: string, token: string, cursor: number | null): string {
  const index = cursor === null ? value.length : Math.max(0, Math.min(cursor, value.length));
  return `${value.slice(0, index)}${token}${value.slice(index)}`;
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
