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

function toTokenPattern(str: string): string {
  return str
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{count\\\}/g, '\\d+')
    .replace(/\\\{username\\\}/g, '\\S+')
    .replace(/\s+/g, '\\s*');
}

function cleanCompoundedTitle(base: string, prefixRegex?: RegExp, suffixRegex?: RegExp): string {
  let cleaned = base.trim();
  for (let i = 0; i < 5; i++) {
    let next = cleaned;
    if (suffixRegex && suffixRegex.test(next)) {
      next = next.replace(suffixRegex, '$1').trim();
    }
    if (prefixRegex && prefixRegex.test(next)) {
      next = next.replace(prefixRegex, '$1').trim();
    }
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

/**
 * Strips any prior counter suffix/prefix formatted from the given template out of the live stream title,
 * ensuring that the streamer's base title is preserved cleanly across counter increments without compounding,
 * even when {title} is located in the middle, or when the streamer manually edited the live title.
 */
export function extractBaseTitle(rawTitle: string, template?: string | null): string {
  if (!rawTitle) return '';
  const trimmedRaw = rawTitle.trim();
  if (!template) return trimmedRaw;

  const normalized = template.replaceAll('{current_title}', '{title}');
  const titleIdx = normalized.indexOf('{title}');
  if (titleIdx === -1) {
    return trimmedRaw;
  }

  try {
    const rawPrefix = normalized.slice(0, titleIdx);
    const rawSuffix = normalized.slice(titleIdx + '{title}'.length);

    const prefixPattern = rawPrefix ? toTokenPattern(rawPrefix) : '';
    const suffixPattern = rawSuffix ? toTokenPattern(rawSuffix) : '';

    const prefixRegex = prefixPattern ? new RegExp(`^${prefixPattern}(.*)$`, 'i') : undefined;
    const suffixRegex = suffixPattern ? new RegExp(`^(.*?)${suffixPattern}$`, 'i') : undefined;

    if (prefixPattern && suffixPattern) {
      // 1. Both prefix and suffix present (e.g. "🔴 [Live] {title} | Streak: {count}")
      const fullRegex = new RegExp(`^${prefixPattern}(.*?)${suffixPattern}$`, 'i');
      const match = trimmedRaw.match(fullRegex);
      if (match && match[1] !== undefined) {
        return cleanCompoundedTitle(match[1], prefixRegex, suffixRegex);
      }

      // 2. Streamer kept prefix, but manually edited or removed suffix
      if (prefixRegex) {
        const prefixMatch = trimmedRaw.match(prefixRegex);
        if (prefixMatch && prefixMatch[1] !== undefined) {
          return cleanCompoundedTitle(prefixMatch[1], prefixRegex, suffixRegex);
        }
      }

      // 3. Streamer kept suffix, but manually edited or removed prefix
      if (suffixRegex) {
        const suffixMatch = trimmedRaw.match(suffixRegex);
        if (suffixMatch && suffixMatch[1] !== undefined) {
          return cleanCompoundedTitle(suffixMatch[1], prefixRegex, suffixRegex);
        }
      }
    } else if (suffixPattern && suffixRegex) {
      // Suffix only (e.g. "{title} | Streak: {count}")
      const match = trimmedRaw.match(suffixRegex);
      if (match && match[1] !== undefined) {
        return cleanCompoundedTitle(match[1], undefined, suffixRegex);
      }
    } else if (prefixPattern && prefixRegex) {
      // Prefix only (e.g. "[Streak: {count}] {title}")
      const match = trimmedRaw.match(prefixRegex);
      if (match && match[1] !== undefined) {
        return cleanCompoundedTitle(match[1], prefixRegex, undefined);
      }
    }
  } catch {
    // fallback on regex error
  }

  return trimmedRaw;
}

/**
 * Checks whether the raw title contains the counter's distinct pattern (the portion formatted with {count}).
 * If a streamer manually changes their stream title to something without this pattern,
 * it indicates that the streamer is done using the counter and title syncing should not overwrite it.
 */
export function hasCounterPattern(rawTitle: string, template?: string | null): boolean {
  if (!rawTitle?.trim() || !template?.trim()) return false;
  const normalized = template.replaceAll('{current_title}', '{title}');
  const titleIdx = normalized.indexOf('{title}');

  let counterPart = '';
  if (titleIdx !== -1) {
    const rawPrefix = normalized.slice(0, titleIdx);
    const rawSuffix = normalized.slice(titleIdx + '{title}'.length);
    if (rawSuffix.includes('{count}')) {
      counterPart = rawSuffix;
    } else if (rawPrefix.includes('{count}')) {
      counterPart = rawPrefix;
    }
  } else if (normalized.includes('{count}')) {
    counterPart = normalized;
  }

  if (!counterPart) return false;

  // Extract core token without leading/trailing decorative delimiters
  const corePart = counterPart.replace(/^[\s|\-·—–:]+|[\s|\-·—–:]+$/g, '').trim();
  if (!corePart) return false;

  try {
    const pattern = toTokenPattern(corePart);
    return new RegExp(pattern, 'i').test(rawTitle);
  } catch {
    return false;
  }
}

/**
 * Strips any counter suffix/prefix from the title and trims any dangling delimiters,
 * leaving a clean stream title ready for Twitch when a streamer stops using a counter.
 */
export function stripCounterFromTitle(rawTitle: string, template?: string | null): string {
  if (!rawTitle?.trim()) return '';
  const base = extractBaseTitle(rawTitle, template);
  return base.replace(/^[\s|\-·—–:]+|[\s|\-·—–:]+$/g, '').trim();
}
