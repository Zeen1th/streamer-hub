import type { EmoteRange } from '../rpc/contracts';
import { twitchEmoteUrl } from './imageVariants.ts';

export type ChatToken =
  | { type: 'text'; value: string }
  | { type: 'emote'; name: string; url: string };

export interface TokenizedMessage {
  tokens: ChatToken[];
  /** True when the message contains at least one emote and no other visible text. */
  emoteOnly: boolean;
}

/** name -> image URL, merged across whichever third-party providers are enabled. */
export type ThirdPartyEmoteMap = Record<string, string>;

export interface TokenizeOptions {
  /** When false, Twitch emote ranges are ignored and left as text. */
  twitch?: boolean;
}

/**
 * Splits a chat message into text runs and emote images.
 *
 * IMPORTANT: Twitch's `emotes` tag indices are CODE POINT offsets, not UTF-16
 * code unit offsets. A message containing an astral-plane character (most emoji)
 * before an emote will slice incorrectly if indexed with `text[i]`, because such
 * characters occupy two code units. Everything here works on `[...text]`.
 */
export function tokenizeMessage(
  text: string,
  twitchEmotes: readonly EmoteRange[] | undefined,
  thirdParty: ThirdPartyEmoteMap | undefined,
  options: TokenizeOptions = {},
): TokenizedMessage {
  if (typeof text !== 'string' || text.length === 0) {
    return { tokens: [], emoteOnly: false };
  }

  const codePoints = [...text];
  const useTwitch = options.twitch !== false;
  const ranges = useTwitch ? sanitizeRanges(twitchEmotes, codePoints.length) : [];

  // Pass 1: carve out the Twitch emotes by code-point index.
  const coarse: ChatToken[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      coarse.push({ type: 'text', value: codePoints.slice(cursor, range.start).join('') });
    }
    coarse.push({
      type: 'emote',
      name: codePoints.slice(range.start, range.end + 1).join(''),
      url: twitchEmoteUrl(range.id),
    });
    cursor = range.end + 1;
  }
  if (cursor < codePoints.length) {
    coarse.push({ type: 'text', value: codePoints.slice(cursor).join('') });
  }

  // Pass 2: match third-party emotes inside the remaining text runs.
  const tokens: ChatToken[] = [];
  for (const token of coarse) {
    if (token.type === 'emote' || !thirdParty) {
      tokens.push(token);
      continue;
    }
    for (const part of splitThirdParty(token.value, thirdParty)) {
      tokens.push(part);
    }
  }

  return { tokens: mergeAdjacentText(tokens), emoteOnly: isEmoteOnly(tokens) };
}

/**
 * Drops ranges that are malformed, out of bounds, or overlap an earlier range.
 * Twitch should never send overlapping ranges, but a malformed tag must not be
 * able to produce scrambled output.
 */
function sanitizeRanges(value: readonly EmoteRange[] | undefined, length: number): EmoteRange[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const sorted = [...value]
    .filter((r) => r && typeof r.id === 'string' && r.id.length > 0)
    .filter((r) => Number.isInteger(r.start) && Number.isInteger(r.end))
    .filter((r) => r.start >= 0 && r.end >= r.start && r.end < length)
    .sort((a, b) => a.start - b.start);

  const out: EmoteRange[] = [];
  let lastEnd = -1;
  for (const range of sorted) {
    if (range.start <= lastEnd) continue;
    out.push(range);
    lastEnd = range.end;
  }
  return out;
}

/** Splits a text run on whitespace and swaps whole words that are known emotes. */
function splitThirdParty(value: string, map: ThirdPartyEmoteMap): ChatToken[] {
  if (!value) return [];
  const out: ChatToken[] = [];
  // Keeping the separators preserves the original spacing exactly.
  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    const url = Object.prototype.hasOwnProperty.call(map, part) ? map[part] : undefined;
    if (url) {
      out.push({ type: 'emote', name: part, url });
    } else {
      out.push({ type: 'text', value: part });
    }
  }
  return out;
}

function mergeAdjacentText(tokens: ChatToken[]): ChatToken[] {
  const out: ChatToken[] = [];
  for (const token of tokens) {
    const previous = out[out.length - 1];
    if (token.type === 'text' && previous && previous.type === 'text') {
      previous.value += token.value;
      continue;
    }
    out.push(token.type === 'text' ? { type: 'text', value: token.value } : token);
  }
  return out.filter((token) => token.type !== 'text' || token.value.length > 0);
}

function isEmoteOnly(tokens: ChatToken[]): boolean {
  let sawEmote = false;
  for (const token of tokens) {
    if (token.type === 'emote') {
      sawEmote = true;
    } else if (token.value.trim().length > 0) {
      return false;
    }
  }
  return sawEmote;
}

/** Merges the enabled providers into one lookup, later providers winning ties. */
export function mergeEmoteProviders(
  providers: Record<string, ThirdPartyEmoteMap> | undefined,
  enabled: { bttv: boolean; ffz: boolean; sevenTv: boolean },
): ThirdPartyEmoteMap {
  const merged: ThirdPartyEmoteMap = {};
  if (!providers) return merged;
  const order: Array<[string, boolean]> = [
    ['bttv', enabled.bttv],
    ['ffz', enabled.ffz],
    ['sevenTv', enabled.sevenTv],
  ];
  for (const [key, isEnabled] of order) {
    if (!isEnabled) continue;
    const map = providers[key];
    if (!map) continue;
    for (const [name, url] of Object.entries(map)) {
      if (typeof name === 'string' && typeof url === 'string' && name && url) {
        merged[name] = url;
      }
    }
  }
  return merged;
}
