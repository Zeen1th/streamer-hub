// Prints the GitHub release notes for a version, taken from the in-app What's New list (src/lib/changelog.ts)
// so the release page and the app always say the same thing.
//   node scripts/release-notes.mjs v0.4.15 > release-notes.md
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** String literals ('...' with \' escapes) inside the array that follows `key: [`, within `block`. */
function listOf(block, key) {
  const start = block.indexOf(`${key}: [`);
  if (start < 0) return [];
  const end = block.indexOf('\n      ],', start);
  const body = block.slice(start, end < 0 ? undefined : end);
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
}

export function releaseNotes(source, tag) {
  const version = tag.replace(/^v/, '');
  const at = source.indexOf(`version: '${version}'`);
  if (at < 0) throw new Error(`No changelog entry for ${version} in src/lib/changelog.ts`);
  const next = source.indexOf("version: '", at + 10);
  const entry = source.slice(at, next < 0 ? undefined : next);
  const en = entry.slice(entry.indexOf('en: {'), entry.indexOf('ar: {'));

  const lines = [`## What's new in ${version}`, ''];
  const added = listOf(en, 'added');
  const fixed = listOf(en, 'fixed');
  if (added.length) lines.push('### New', '', ...added.map((x) => `- ${x}`), '');
  if (fixed.length) lines.push('### Fixed', '', ...fixed.map((x) => `- ${x}`), '');
  return lines.join('\n').trimEnd() + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!tag) throw new Error('Usage: node scripts/release-notes.mjs v0.4.15');
  process.stdout.write(releaseNotes(readFileSync(path.join(root, 'src/lib/changelog.ts'), 'utf8'), tag));
}
