import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_OVERLAY_AVATAR_FALLBACK,
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  createDefaultChatOverlaySettings,
  defaultBlockForAnchor,
  formatBidiText,
  isRtlText,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
} from './chatOverlay.ts';

test('defaults are version 2 and internally consistent', () => {
  const d = DEFAULT_CHAT_OVERLAY_SETTINGS;
  assert.equal(d.version, 2);
  assert.equal(d.enabled, false);
  assert.equal(d.flow.maxMessages, 8);
  assert.equal(d.flow.sizeScale, 100);
  assert.equal(d.block.anchor, 'bottom-left');
  assert.equal(d.text.size, 24);
  assert.equal(d.username.size, 17);
  assert.equal(d.identity.direction, 'ltr');
  assert.equal(d.filters.hideBots, true);
});

test('normalizes identity direction independently from message text direction', () => {
  const rtl = normalizeChatOverlaySettings({ version: 2, identity: { direction: 'rtl' } });
  const invalid = normalizeChatOverlaySettings({ version: 2, identity: { direction: 'sideways' } });

  assert.equal(rtl.identity.direction, 'rtl');
  assert.equal(invalid.identity.direction, 'ltr');
});

test('defaults are not shared mutable state between callers', () => {
  const a = createDefaultChatOverlaySettings();
  const b = createDefaultChatOverlaySettings();
  a.bubble.background.color = '#ff0000';
  a.filters.botList.push('someone');
  assert.equal(b.bubble.background.color, '#101218');
  assert.equal(b.filters.botList.includes('someone'), false);
});

test('block anchors inset from the correct corner of the canvas', () => {
  assert.deepEqual(defaultBlockForAnchor('bottom-left'), {
    x: 48, y: 492, width: 760, height: 540, anchor: 'bottom-left',
  });
  assert.deepEqual(defaultBlockForAnchor('top-right'), {
    x: 1112, y: 48, width: 760, height: 540, anchor: 'top-right',
  });
});

test('normalization is total: any garbage yields valid settings', () => {
  for (const input of [null, undefined, 42, 'nope', [], { version: 99 }, { version: 2 }]) {
    const result = normalizeChatOverlaySettings(input);
    assert.equal(result.version, 2);
    assert.equal(typeof result.flow.maxMessages, 'number');
    assert.ok(Array.isArray(result.filters.blockedUsernames));
  }
});

test('clamps out-of-range numbers rather than rejecting them', () => {
  const result = normalizeChatOverlaySettings({
    version: 2,
    flow: { maxMessages: 9999, gap: -50, sizeScale: 10000 },
    text: { size: 0, lineHeight: 99 },
  });
  assert.equal(result.flow.maxMessages, 40);
  assert.equal(result.flow.gap, 0);
  assert.equal(result.flow.sizeScale, 300);
  assert.equal(result.text.size, 8);
  assert.equal(result.text.lineHeight, 3);
});

test('duration accepts 0 as never-expire but clamps other values', () => {
  assert.equal(normalizeChatOverlaySettings({ version: 2, flow: { durationSeconds: 0 } }).flow.durationSeconds, 0);
  assert.equal(normalizeChatOverlaySettings({ version: 2, flow: { durationSeconds: 1 } }).flow.durationSeconds, 3);
  assert.equal(normalizeChatOverlaySettings({ version: 2, flow: { durationSeconds: 9999 } }).flow.durationSeconds, 600);
});

test('rejects colours that are not hex, falling back to the default', () => {
  const result = normalizeChatOverlaySettings({
    version: 2,
    text: { color: 'red; background: url(evil)' },
    bubble: { border: { color: '#abc' } },
  });
  assert.equal(result.text.color, '#f7f4ee');
  assert.equal(result.bubble.border.color, '#abc');
});

test('strips characters that could break out of a CSS font declaration', () => {
  const result = normalizeChatOverlaySettings({
    version: 2,
    text: { font: { family: 'custom', customName: 'Evil"; content: "x' } },
  });
  assert.equal(result.text.font.family, 'custom');
  assert.equal(result.text.font.customName.includes('"'), false);
  assert.equal(result.text.font.customName.includes(';'), false);
});

test('de-duplicates and trims filter lists case-insensitively', () => {
  const result = normalizeChatOverlaySettings({
    version: 2,
    filters: { blockedUsernames: ['  Spam ', 'spam', 'SPAM', '', 'other'] },
  });
  assert.deepEqual(result.filters.blockedUsernames, ['Spam', 'other']);
});

test('keeps the block inside the canvas', () => {
  const result = normalizeChatOverlaySettings({
    version: 2,
    block: { x: 5000, y: -200, width: 800, height: 400, anchor: 'top-left' },
  });
  assert.equal(result.block.x, 1920 - 800);
  assert.equal(result.block.y, 0);
});

// --- v1 -> v2 migration ----------------------------------------------------

const LEGACY_V1 = {
  enabled: true,
  maxMessages: 12,
  durationSeconds: 30,
  displayMode: 'latest',
  fontSize: 30,
  avatarSize: 40,
  spacing: 20,
  showUsernames: false,
  showAvatars: true,
  theme: 'neon',
  messageStyle: 'square',
  animation: 'pop',
  backgroundOpacity: 60,
  textShadow: false,
  fontFamily: 'cairo',
  avatarShape: 'squircle',
  showBadges: false,
  compactMode: false,
  alignment: 'top-right',
  avatarPosition: 'right',
  scale: 150,
};

test('migrates a v1 payload without losing explicit user choices', () => {
  const result = normalizeChatOverlaySettings(LEGACY_V1);

  assert.equal(result.version, 2);
  assert.equal(result.enabled, true);

  // alignment + scale become a rect plus a multiplier
  assert.equal(result.block.anchor, 'top-right');
  assert.deepEqual(defaultBlockForAnchor('top-right'), result.block);
  assert.equal(result.flow.sizeScale, 150);

  assert.equal(result.flow.maxMessages, 12);
  assert.equal(result.flow.durationSeconds, 30);
  assert.equal(result.flow.displayMode, 'latest');
  assert.equal(result.flow.gap, 20);

  // theme selected the neon preset...
  assert.equal(result.bubble.accent.color, '#06b6d4');
  // ...but explicit v1 overrides still win on top of it
  assert.equal(result.text.font.family, 'cairo');
  assert.equal(result.text.size, 30);
  assert.equal(result.text.shadow, false);
  assert.equal(result.username.show, false);
  assert.equal(result.avatar.size, 40);
  assert.equal(result.avatar.shape, 'squircle');
  assert.equal(result.identity.direction, 'rtl');
  assert.equal(result.badges.show, false);
  assert.equal(result.bubble.background.alpha, 60);
  assert.equal(result.bubble.border.radius, 3, 'square message style maps to a small radius');
  assert.equal(result.animation.kind, 'pop');
});

test('migration preserves the v1 username-to-text size ratio', () => {
  const result = normalizeChatOverlaySettings({ ...LEGACY_V1, fontSize: 20 });
  assert.equal(result.text.size, 20);
  assert.equal(result.username.size, 14); // 20 * 0.7
});

test('v1 compactMode becomes reduced padding and gap', () => {
  const loose = normalizeChatOverlaySettings({ ...LEGACY_V1, compactMode: false });
  const compact = normalizeChatOverlaySettings({ ...LEGACY_V1, compactMode: true });
  assert.ok(compact.bubble.padding.y < loose.bubble.padding.y);
  assert.ok(compact.flow.gap < loose.flow.gap);
});

test('an unrecognised version resets instead of throwing', () => {
  const result = normalizeChatOverlaySettings({ version: 7, wat: true });
  assert.deepEqual(result, createDefaultChatOverlaySettings());
});

// --- messages --------------------------------------------------------------

test('normalizes chat messages and falls back for a missing avatar', () => {
  const result = normalizeChatOverlayMessage({
    id: 'm1',
    username: '  Viewer  ',
    userId: '123',
    message: '  hello  ',
    isMod: true,
  });
  assert.equal(result.id, 'm1');
  assert.equal(result.username, 'Viewer');
  assert.equal(result.message, 'hello');
  assert.equal(result.isMod, true);
  assert.equal(result.avatarUrl, CHAT_OVERLAY_AVATAR_FALLBACK);
  assert.deepEqual(result.emotes, []);
});

test('rejects avatar URLs with an unexpected protocol', () => {
  const result = normalizeChatOverlayMessage({ id: 'm', username: 'a', avatarUrl: 'javascript:alert(1)' });
  assert.equal(result.avatarUrl, CHAT_OVERLAY_AVATAR_FALLBACK);
});

test('drops malformed emote ranges and sorts the survivors', () => {
  const result = normalizeChatOverlayMessage({
    id: 'm',
    username: 'a',
    message: 'hi',
    emotes: [
      { id: '2', start: 5, end: 9 },
      { id: '', start: 0, end: 1 },
      { id: '1', start: 0, end: 4 },
      { id: '3', start: 9, end: 2 },
      { id: '4', start: -1, end: 3 },
      'nonsense',
    ],
  });
  assert.deepEqual(result.emotes, [
    { id: '1', start: 0, end: 4 },
    { id: '2', start: 5, end: 9 },
  ]);
});

test('keeps only a valid hex chat colour', () => {
  assert.equal(normalizeChatOverlayMessage({ id: 'm', username: 'a', color: '#FF0000' }).color, '#FF0000');
  assert.equal(normalizeChatOverlayMessage({ id: 'm', username: 'a', color: 'blue' }).color, '');
});

// --- BiDi ------------------------------------------------------------------

test('identifies RTL direction for Arabic and mixed messages', () => {
  assert.equal(isRtlText('انا لعبت BG3 و كانت اسطوريه'), true);
  assert.equal(isRtlText('@zeen1_th انا لعبت BG3 و كانت اسطوريه'), true);
  assert.equal(isRtlText('Today I played BG3 and it was epic'), false);
  assert.equal(isRtlText('Hello world'), false);
  assert.equal(isRtlText(''), false);
});

test('wraps RTL text in directional isolates', () => {
  const formatted = formatBidiText('انا لعبت BG3', true);
  assert.equal(formatted.startsWith('\u2067'), true);
  assert.equal(formatted.endsWith('\u2069'), true);
  assert.equal(formatBidiText('plain', false), 'plain');
});
