import type { TwitchGiftEvent } from '../rpc/contracts.ts';

/** How long a gift stays pinned to the top of the chat. */
export const GIFT_TTL_MS = 90_000;
export const MAX_GIFTS_SHOWN = 3;
const MAX_KEPT = 12;

/** Adds a gift (ignoring one already seen), newest first. */
export function mergeGift(list: readonly TwitchGiftEvent[], gift: TwitchGiftEvent): TwitchGiftEvent[] {
  if (list.some((g) => g.id === gift.id)) return [...list];
  return [gift, ...list].slice(0, MAX_KEPT);
}

/** Gifts still worth showing, newest first. */
export function activeGifts(list: readonly TwitchGiftEvent[], now: number): TwitchGiftEvent[] {
  return list
    .filter((g) => {
      const at = Date.parse(g.at);
      return Number.isFinite(at) ? now - at < GIFT_TTL_MS : true;
    })
    .slice(0, MAX_GIFTS_SHOWN);
}

export function tierLabel(tier: string, lang: 'en' | 'ar'): string {
  const n = tier === '3000' ? 3 : tier === '2000' ? 2 : 1;
  return lang === 'ar' ? `المستوى ${n}` : `Tier ${n}`;
}

/** "Alice gifted 5 subs" / "Alice gifted a Tier 2 sub to Bob". */
export function giftText(gift: TwitchGiftEvent, lang: 'en' | 'ar'): string {
  const who = gift.anonymous ? (lang === 'ar' ? 'مجهول' : 'Anonymous') : gift.gifterName;
  const tier = tierLabel(gift.tier, lang);
  if (gift.count > 1) {
    return lang === 'ar'
      ? `${who} أهدى ${gift.count} اشتراكات (${tier})`
      : `${who} gifted ${gift.count} ${tier} subs`;
  }
  if (gift.recipientName) {
    return lang === 'ar'
      ? `${who} أهدى اشتراك ${tier} إلى ${gift.recipientName}`
      : `${who} gifted a ${tier} sub to ${gift.recipientName}`;
  }
  return lang === 'ar' ? `${who} أهدى اشتراكاً (${tier})` : `${who} gifted a ${tier} sub`;
}
