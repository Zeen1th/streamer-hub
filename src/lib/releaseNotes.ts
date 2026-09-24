export interface ParsedReleaseNotes {
  whatsNew: string[];
  whatsFixed: string[];
  rawSummary?: string;
}

/**
 * Parses release notes markdown into clean, localized "What's New" and "What's Fixed" lists.
 * Supports structured bilingual format ([ar] / [en]) as well as standard/legacy markdown.
 */
export function parseReleaseNotes(
  notes: string | null | undefined,
  lang: 'ar' | 'en' = 'en'
): ParsedReleaseNotes {
  if (!notes || !notes.trim()) {
    return { whatsNew: [], whatsFixed: [] };
  }

  let text = notes.trim();

  // 1. Remove GitHub compare links and noisy metadata
  text = text.replace(/\*\*Full Changelog\*\*:[^\n]+/gi, '').trim();

  // 2. Separate debug prefix if present
  if (text.startsWith('[Updater test]')) {
    text = text.replace(/^\[Updater test\]\s*/i, '').trim();
  }

  // 3. Extract localized language block if multi-language sections exist
  // Matches headers like: # [ar], ## [ar], [ar], # العربية, ## العربية
  const arRegex = /(?:^|\n)(?:#+\s*\[ar\]|#+\s*العربية|\[ar\])([\s\S]*?)(?=(?:\n#+\s*\[en\]|\n#+\s*English|\n\[en\])|$)/i;
  const enRegex = /(?:^|\n)(?:#+\s*\[en\]|#+\s*English|\[en\])([\s\S]*?)(?=(?:\n#+\s*\[ar\]|\n#+\s*العربية|\n\[ar\])|$)/i;

  const arMatch = text.match(arRegex);
  const enMatch = text.match(enRegex);

  let targetText = text;
  if (lang === 'ar') {
    if (arMatch && arMatch[1].trim()) {
      targetText = arMatch[1].trim();
    } else if (!arMatch && enMatch) {
      // Fallback: If only English section exists, use English or whatever is outside
      const beforeEn = text.split(/(?:^|\n)(?:#+\s*\[en\]|#+\s*English|\[en\])/i)[0].trim();
      targetText = beforeEn || enMatch[1].trim();
    }
  } else {
    // English
    if (enMatch && enMatch[1].trim()) {
      targetText = enMatch[1].trim();
    } else if (!enMatch && arMatch) {
      // Fallback: If only Arabic exists
      const beforeAr = text.split(/(?:^|\n)(?:#+\s*\[ar\]|#+\s*العربية|\[ar\])/i)[0].trim();
      targetText = beforeAr || arMatch[1].trim();
    }
  }

  // Clean target text of horizontal separator lines
  targetText = targetText.replace(/^(?:---|___|\*\*\*)\s*$/gm, '').trim();

  // 4. Parse sections and bullet points
  const whatsNew: string[] = [];
  const whatsFixed: string[] = [];

  const lines = targetText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let currentSection: 'new' | 'fixed' | null = null;

  for (const line of lines) {
    // Ignore horizontal rule lines
    if (/^[-*_]{3,}$/.test(line)) {
      continue;
    }

    const isBullet = line.startsWith('-') || line.startsWith('*') || line.startsWith('•');

    // Detect Section Header (only if not a bullet)
    if (!isBullet) {
      if (/(?:الجديد|المميزات|what's\s*new|new\s*features|\bfeatures\b|\badded\b)/i.test(line)) {
        currentSection = 'new';
        continue;
      }
      if (/(?:الإصلاحات|التحسينات|تم\s*إصلاح|what's\s*fixed|\bfixes\b|bug\s*fixes|\bfixed\b|\bimprovements\b)/i.test(line)) {
        currentSection = 'fixed';
        continue;
      }
    }

    // Process bullet points
    if (isBullet) {
      const cleanBullet = line.replace(/^[-*•]\s*/, '').trim();
      if (!cleanBullet || /^[-*_]{2,}$/.test(cleanBullet)) continue;

      if (currentSection === 'fixed') {
        whatsFixed.push(cleanBullet);
      } else if (currentSection === 'new') {
        whatsNew.push(cleanBullet);
      } else {
        // Uncategorized bullet: classify heuristically
        if (/(?:fix|fixed|bug|resolve|إصلاح|حل|عطل)/i.test(cleanBullet)) {
          whatsFixed.push(cleanBullet);
        } else {
          whatsNew.push(cleanBullet);
        }
      }
    }
  }

  // 5. Fallback if no bullet points could be extracted
  let rawSummary: string | undefined;
  if (whatsNew.length === 0 && whatsFixed.length === 0 && targetText) {
    // Clean headers and formatting for rawSummary
    rawSummary = targetText
      .replace(/^#+\s*/gm, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
  }

  return {
    whatsNew,
    whatsFixed,
    ...(rawSummary ? { rawSummary } : {}),
  };
}
