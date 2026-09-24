import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReleaseNotes } from './releaseNotes.ts';

const SAMPLE_BILINGUAL_RELEASE = `
# [ar]
### ✨ الجديد
- البحث المباشر في الإنترنت للذكاء الاصطناعي (الطقس، العملات، الأخبار)
- دعم كامل لتفعيل ردود الذكاء الاصطناعي بواسطة نقاط القناة
- استعادة نموذج Groq 8B

### 🛠️ الإصلاحات
- إصلاح مشكلة انقطاع البحث والمهلة الزمنية ("operation was canceled")
- إصلاح عدم استجابة البوت عند استخدام نقاط القناة

---

# [en]
### ✨ What's New
- Real-time internet search for AI auto-replies (weather, crypto, news)
- Full Twitch Channel Points trigger support for AI replies
- Restored Groq 8B preset

### 🛠️ What's Fixed
- Fixed AI request timeout ("operation was canceled")
- Fixed Channel Points redemptions not triggering AI replies

**Full Changelog**: https://github.com/Zeen1th/streamer-hub/compare/v0.3.8...v0.3.9
`;

test('parseReleaseNotes parses Arabic section correctly', () => {
  const parsed = parseReleaseNotes(SAMPLE_BILINGUAL_RELEASE, 'ar');
  assert.equal(parsed.whatsNew.length, 3);
  assert.match(parsed.whatsNew[0], /البحث المباشر/);
  assert.match(parsed.whatsNew[1], /نقاط القناة/);
  assert.match(parsed.whatsNew[2], /Groq 8B/);

  assert.equal(parsed.whatsFixed.length, 2);
  assert.match(parsed.whatsFixed[0], /إصلاح مشكلة انقطاع البحث/);
  assert.match(parsed.whatsFixed[1], /إصلاح عدم استجابة البوت/);
  assert.equal(parsed.rawSummary, undefined);
});

test('parseReleaseNotes parses English section correctly', () => {
  const parsed = parseReleaseNotes(SAMPLE_BILINGUAL_RELEASE, 'en');
  assert.equal(parsed.whatsNew.length, 3);
  assert.match(parsed.whatsNew[0], /Real-time internet search/);
  assert.match(parsed.whatsNew[1], /Twitch Channel Points/);
  assert.match(parsed.whatsNew[2], /Groq 8B/);

  assert.equal(parsed.whatsFixed.length, 2);
  assert.match(parsed.whatsFixed[0], /Fixed AI request timeout/);
  assert.match(parsed.whatsFixed[1], /Fixed Channel Points redemptions/);
  assert.equal(parsed.rawSummary, undefined);
});

test('parseReleaseNotes strips GitHub Full Changelog compare link', () => {
  const parsed = parseReleaseNotes(SAMPLE_BILINGUAL_RELEASE, 'en');
  const allText = [...parsed.whatsNew, ...parsed.whatsFixed].join(' ');
  assert.equal(allText.includes('Full Changelog'), false);
  assert.equal(allText.includes('compare/v0.3.8'), false);
});

test('parseReleaseNotes handles [Updater test] debug prefix', () => {
  const debugNotes = `[Updater test]\n\n${SAMPLE_BILINGUAL_RELEASE}`;
  const parsedAr = parseReleaseNotes(debugNotes, 'ar');
  assert.equal(parsedAr.whatsNew.length, 3);
  assert.equal(parsedAr.whatsFixed.length, 2);

  const parsedEn = parseReleaseNotes(debugNotes, 'en');
  assert.equal(parsedEn.whatsNew.length, 3);
  assert.equal(parsedEn.whatsFixed.length, 2);
});

test('parseReleaseNotes categorizes uncategorized bullets heuristically', () => {
  const mixedNotes = `
- Added new dark mode theme
- Fixed bug in twitch connection
- Improved audio meter responsiveness
- Fix crash on startup
`;
  const parsed = parseReleaseNotes(mixedNotes, 'en');
  assert.equal(parsed.whatsNew.length, 2);
  assert.equal(parsed.whatsFixed.length, 2);
  assert.equal(parsed.whatsNew[0], 'Added new dark mode theme');
  assert.equal(parsed.whatsFixed[0], 'Fixed bug in twitch connection');
  assert.equal(parsed.whatsFixed[1], 'Fix crash on startup');
});

test('parseReleaseNotes handles empty or null notes gracefully', () => {
  assert.deepEqual(parseReleaseNotes(null, 'ar'), { whatsNew: [], whatsFixed: [] });
  assert.deepEqual(parseReleaseNotes(undefined, 'en'), { whatsNew: [], whatsFixed: [] });
  assert.deepEqual(parseReleaseNotes('   ', 'ar'), { whatsNew: [], whatsFixed: [] });
});

test('parseReleaseNotes returns rawSummary if no bullets exist', () => {
  const unstructured = `Critical security and performance update. Please update your client.`;
  const parsed = parseReleaseNotes(unstructured, 'en');
  assert.equal(parsed.whatsNew.length, 0);
  assert.equal(parsed.whatsFixed.length, 0);
  assert.equal(parsed.rawSummary, 'Critical security and performance update. Please update your client.');
});
