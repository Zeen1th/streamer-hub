import type { ChatMessage, PermissionLevel } from '../rpc/contracts';

export const PERMISSION_RANK: Record<PermissionLevel, number> = {
  everyone: 0,
  subscriber: 1,
  vip: 2,
  mod: 3,
  broadcaster: 4,
};

export function parseCommand(message: string, commandName: string): { argument: string } | null {
  const trimmed = message.trim();
  if (!commandName) return null;
  const prefix = `!${commandName.toLowerCase()}`;
  if (!trimmed.toLowerCase().startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length);
  if (rest.length === 0) return { argument: '' };
  if (/\s/.test(rest.charAt(0))) return { argument: rest.trim() };
  return null;
}

export function userRank(message: ChatMessage): number {
  if (message.isBroadcaster) return PERMISSION_RANK.broadcaster;
  if (message.isMod) return PERMISSION_RANK.mod;
  if (message.isVip) return PERMISSION_RANK.vip;
  if (message.isSubscriber) return PERMISSION_RANK.subscriber;
  return PERMISSION_RANK.everyone;
}

export function hasPermission(message: ChatMessage, minimum: PermissionLevel): boolean {
  return userRank(message) >= PERMISSION_RANK[minimum];
}

export function cooldownRemainingSeconds(
  now: number,
  lastTriggerAt: number | null,
  cooldownSeconds: number,
): number | null {
  if (cooldownSeconds <= 0 || lastTriggerAt === null) return null;
  const remaining = Math.ceil((lastTriggerAt + cooldownSeconds * 1000 - now) / 1000);
  return remaining > 0 ? remaining : null;
}

export function renderTemplate(template: string, count: number, username: string | null): string {
  return template.replaceAll('{count}', String(count)).replaceAll('{username}', username ?? '');
}
