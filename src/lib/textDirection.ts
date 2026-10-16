const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/u;
const TOKEN = /\{[^}]*\}/gu;

/**
 * Direction for a text field from what the user has typed.
 *
 * Follows the first real letter, skipping `{tokens}`, digits, punctuation and emoji, so
 * "{mention} شكراً" is right-to-left and "Thanks {mention} شكراً" stays left-to-right.
 * A field with no letters yet uses `fallback` (the app language), or the page default.
 */
export function fieldDir(value: string | undefined | null, fallback?: 'ltr' | 'rtl'): 'ltr' | 'rtl' | undefined {
  const firstLetter = (value ?? '').replace(TOKEN, '').match(/\p{L}/u)?.[0];
  if (!firstLetter) return fallback;
  return RTL_LETTER.test(firstLetter) ? 'rtl' : 'ltr';
}
