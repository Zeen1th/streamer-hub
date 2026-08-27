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

export function renderTemplate(template: string, count: number, username: string | null, currentTitle?: string | null): string {
  const base = currentTitle ? extractBaseTitle(currentTitle, template) : '';
  return template
    .replaceAll('{count}', String(count))
    .replaceAll('{username}', username ?? '')
    .replaceAll('{current_title}', base)
    .replaceAll('{title}', base);
}

/**
 * Strips any prior counter suffix/prefix formatted from the given template out of the live stream title,
 * ensuring that the streamer's base title is preserved cleanly across counter increments without compounding.
 */
export function extractBaseTitle(rawTitle: string, template: string): string {
  if (!rawTitle) return '';
  if (!template || (!template.includes('{title}') && !template.includes('{current_title}'))) {
    return rawTitle;
  }

  try {
    const placeholder = '___BASE_TITLE___';
    const escaped = template
      .replaceAll('{title}', placeholder)
      .replaceAll('{current_title}', placeholder)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{count\\\}/g, '\\d+')
      .replace(/\\\{username\\\}/g, '[^\\s]+');

    if (escaped.startsWith(placeholder)) {
      const suffixPattern = escaped.slice(placeholder.length);
      const regex = new RegExp(`${suffixPattern}$`, 'i');
      return rawTitle.replace(regex, '').trim();
    } else if (escaped.endsWith(placeholder)) {
      const prefixPattern = escaped.slice(0, -placeholder.length);
      const regex = new RegExp(`^${prefixPattern}`, 'i');
      return rawTitle.replace(regex, '').trim();
    }
  } catch {
    // fallback to original string on regex error
  }
  return rawTitle;
}
