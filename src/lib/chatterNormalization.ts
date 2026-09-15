/**
 * Normalization utilities for Twitch chatter identities across Arabic, English, and numeric IDs.
 */

/**
 * Normalizes Arabic text:
 * - Strips tashkeel / harakat (diacritics: fatha, damma, kasra, sukun, shadda, tanween)
 * - Strips tatweel / kashida (ـ)
 * - Normalizes alef variations (أ, إ, آ, ٱ -> ا)
 * - Normalizes taa marbuta (ة -> ه)
 * - Normalizes alif maqsura (ى -> ي)
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // Strip Arabic diacritics / harakat and tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Normalize alef forms to bare alef
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize taa marbuta to haa
    .replace(/ة/g, 'ه')
    // Normalize alif maqsura to yaa
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu kaf & yeh
    .replace(/ك/g, 'ك')
    .replace(/ی/g, 'ي');
}

/**
 * Normalizes a chatter identifier (username, display name, or numeric ID) for resilient comparison:
 * - Strips leading '@'
 * - Trims whitespace
 * - Converts English ASCII letters to lowercase
 * - Applies Arabic normalization
 */
export function normalizeChatterIdentifier(identifier: string): string {
  if (!identifier) return '';
  const cleaned = identifier.trim().replace(/^@+/, '');
  const lowered = cleaned.toLowerCase();
  return normalizeArabicText(lowered);
}

/**
 * Checks if two chatter identifiers match, accommodating:
 * - Numeric Twitch user IDs
 * - English usernames with any case variations
 * - Arabic display names with any alef/tashkeel/spelling variations
 */
export function chatterIdentifiersMatch(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (!a || !b) return false;
  const trimA = a.trim().replace(/^@+/, '');
  const trimB = b.trim().replace(/^@+/, '');
  if (!trimA || !trimB) return false;

  // Exact match
  if (trimA === trimB) return true;

  // Case-insensitive match (covers English usernames & IDs)
  if (trimA.toLowerCase() === trimB.toLowerCase()) return true;

  // Normalized match (covers Arabic display names & mixed inputs)
  return normalizeChatterIdentifier(trimA) === normalizeChatterIdentifier(trimB);
}

/**
 * Parses a bulk-entered or pasted list of chatter identifiers:
 * Splits by commas, semicolons, newlines, tabs, or spaces.
 * Strips leading '@', trims, filters blanks, and deduplicates while preserving order.
 */
export function parseChatterList(input: string): string[] {
  if (!input || !input.trim()) return [];

  // Split by common separators: comma, semicolon, newline, carriage return, tab, multiple spaces
  const rawTokens = input.split(/[,;\r\n\t\s]+/);
  const seenNormalized = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTokens) {
    const clean = raw.trim().replace(/^@+/, '');
    if (!clean) continue;
    const norm = normalizeChatterIdentifier(clean);
    if (!seenNormalized.has(norm)) {
      seenNormalized.add(norm);
      result.push(clean);
    }
  }

  return result;
}
