import type { ChatOverlayFilterSettings } from '../rpc/contracts';

export interface FilterableMessage {
  username: string;
  message: string;
}

export type ChatFilterReason =
  | 'blocked-username'
  | 'bot'
  | 'command'
  | 'blocked-word'
  | 'too-short';

export type ChatFilterResult =
  | { visible: false; reason: ChatFilterReason }
  | { visible: true; message: string };

/**
 * Decides whether a message is shown on the overlay, and rewrites it when a
 * blocked word is masked rather than dropped.
 *
 * Filtering affects display only. Callers keep filtered messages in the activity
 * log so a misconfigured filter is visible rather than silently eating chat.
 */
export function applyChatFilters(
  input: FilterableMessage,
  filters: ChatOverlayFilterSettings,
): ChatFilterResult {
  const username = typeof input.username === 'string' ? input.username : '';
  const original = typeof input.message === 'string' ? input.message : '';

  // A message the streamer listed is shown whoever sent it, for example one line of a hidden bot
  if (matchesAlwaysShowMessage(original, filters.alwaysShowMessages)) {
    return { visible: true, message: original };
  }

  if (matchesAnyPattern(username, filters.blockedUsernames)) {
    return { visible: false, reason: 'blocked-username' };
  }

  if (filters.hideBots && matchesAnyPattern(username, filters.botList)) {
    return { visible: false, reason: 'bot' };
  }

  const trimmed = original.trim();

  if (filters.hideCommands && trimmed.startsWith('!')) {
    return { visible: false, reason: 'command' };
  }

  if (filters.minLength > 0 && trimmed.length < filters.minLength) {
    return { visible: false, reason: 'too-short' };
  }

  if (filters.blockedWords.length > 0) {
    if (filters.blockedWordAction === 'drop') {
      if (containsBlockedWord(original, filters.blockedWords)) {
        return { visible: false, reason: 'blocked-word' };
      }
    } else {
      return { visible: true, message: maskBlockedWords(original, filters.blockedWords) };
    }
  }

  return { visible: true, message: original };
}

function normalizeMessage(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * True when the whole message equals one of the listed messages (ignoring case and extra spaces), or starts with a listed
 * message that ends in `*`.
 */
export function matchesAlwaysShowMessage(message: string, listed: readonly string[] | undefined): boolean {
  if (!message || !Array.isArray(listed) || listed.length === 0) return false;
  const candidate = normalizeMessage(message);
  if (!candidate) return false;
  for (const raw of listed) {
    if (typeof raw !== 'string') continue;
    const entry = normalizeMessage(raw);
    if (!entry) continue;
    if (entry.endsWith('*')) {
      const prefix = entry.slice(0, -1).trimEnd();
      // A bare "*" would show everything; treat it as a no-op
      if (prefix && candidate.startsWith(prefix)) return true;
    } else if (candidate === entry) {
      return true;
    }
  }
  return false;
}

/**
 * Case-insensitive exact match, with a trailing `*` meaning prefix match
 * (`spam*` blocks `spambot01`).
 */
export function matchesAnyPattern(value: string, patterns: readonly string[]): boolean {
  if (!value || !Array.isArray(patterns) || patterns.length === 0) return false;
  const candidate = value.trim().toLowerCase();
  if (!candidate) return false;

  for (const raw of patterns) {
    if (typeof raw !== 'string') continue;
    const pattern = raw.trim().toLowerCase();
    if (!pattern) continue;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      // A bare "*" would block everyone; treat it as a no-op rather than a footgun.
      if (prefix && candidate.startsWith(prefix)) return true;
    } else if (candidate === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Whole-word, case-insensitive, Unicode-aware. `\b` is ASCII-centric and would
 * not behave correctly for Arabic, so boundaries are expressed as "not a letter,
 * digit, or underscore" on either side.
 */
function wordPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu');
}

export function containsBlockedWord(text: string, words: readonly string[]): boolean {
  for (const raw of words) {
    if (typeof raw !== 'string') continue;
    const word = raw.trim();
    if (!word) continue;
    if (wordPattern(word).test(text)) return true;
  }
  return false;
}

export function maskBlockedWords(text: string, words: readonly string[]): string {
  let output = text;
  for (const raw of words) {
    if (typeof raw !== 'string') continue;
    const word = raw.trim();
    if (!word) continue;
    output = output.replace(wordPattern(word), (match) => '*'.repeat([...match].length));
  }
  return output;
}
