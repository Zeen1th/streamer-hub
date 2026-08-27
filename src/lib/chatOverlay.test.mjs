import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_OVERLAY_AVATAR_FALLBACK,
  DEFAULT_CHAT_OVERLAY_SETTINGS,
  normalizeChatOverlayMessage,
  normalizeChatOverlaySettings,
} from './chatOverlay.ts';

test('exposes stable default chat overlay settings', () => {
  assert.deepEqual(DEFAULT_CHAT_OVERLAY_SETTINGS, {
    enabled: false,
    maxMessages: 8,
    durationSeconds: 20,
    displayMode: 'stacked',
    fontSize: 24,
    avatarSize: 32,
    spacing: 12,
    showUsernames: true,
    showAvatars: true,
    theme: 'dark',
    messageStyle: 'rounded',
    animation: 'slide',
    backgroundOpacity: 85,
    textShadow: true,
    fontFamily: 'barlow',
    avatarShape: 'circle',
    showBadges: true,
    compactMode: false,
    alignment: 'bottom-left',
    avatarPosition: 'left',
    scale: 100,
  });
});

test('clamps and sanitizes overlay settings', () => {
  assert.deepEqual(
    normalizeChatOverlaySettings({
      enabled: true,
      maxMessages: 99,
      durationSeconds: 0,
      displayMode: 'latest',
      fontSize: 9,
      avatarSize: 200,
      spacing: -5,
      showUsernames: false,
      showAvatars: false,
      theme: 'transparent',
      messageStyle: 'square',
      animation: 'off',
      backgroundOpacity: 150,
      textShadow: false,
      fontFamily: 'cairo',
      avatarShape: 'squircle',
      showBadges: false,
      compactMode: true,
      alignment: 'top-right',
      avatarPosition: 'left',
      scale: 300,
    }),
    {
      enabled: true,
      maxMessages: 24,
      durationSeconds: 3,
      displayMode: 'latest',
      fontSize: 12,
      avatarSize: 64,
      spacing: 0,
      showUsernames: false,
      showAvatars: false,
      theme: 'transparent',
      messageStyle: 'square',
      animation: 'off',
      backgroundOpacity: 100,
      textShadow: false,
      fontFamily: 'cairo',
      avatarShape: 'squircle',
      showBadges: false,
      compactMode: true,
      alignment: 'top-right',
      avatarPosition: 'left',
      scale: 200,
    },
  );
});

test('falls back to defaults for invalid overlay settings', () => {
  assert.deepEqual(
    normalizeChatOverlaySettings({
      enabled: 'yes',
      maxMessages: Number.NaN,
      durationSeconds: null,
      displayMode: 'carousel',
      fontSize: '24px',
      avatarSize: undefined,
      spacing: Infinity,
      showUsernames: 'true',
      showAvatars: 1,
      theme: 'invalid-theme',
      messageStyle: 'pill',
      animation: 'zoom',
      backgroundOpacity: 'opaque',
      textShadow: 'yes',
      fontFamily: 'comic-sans',
      avatarShape: 'triangle',
      showBadges: null,
      compactMode: 'false',
      alignment: 'center',
    }),
    DEFAULT_CHAT_OVERLAY_SETTINGS,
  );
});

test('normalizes chat messages and uses a neutral avatar fallback', () => {
  const username = ' viewer '.repeat(10);
  const message = ' hello world '.repeat(80);

  assert.deepEqual(
    normalizeChatOverlayMessage({
      id: '  msg-1  ',
      username,
      message,
      timestamp: ' 2026-08-26T00:00:00.000Z ',
      userId: ' 12345 ',
      avatarUrl: 'javascript:alert(1)',
      isBroadcaster: true,
      isMod: false,
      isVip: false,
      isSubscriber: true,
    }),
    {
      id: '  msg-1  ',
      username: username.trim().slice(0, 32),
      message: message.trim().slice(0, 500),
      timestamp: '2026-08-26T00:00:00.000Z',
      userId: '12345',
      avatarUrl: CHAT_OVERLAY_AVATAR_FALLBACK,
      isBroadcaster: true,
      isMod: false,
      isVip: false,
      isSubscriber: true,
    },
  );
});
test('does not reuse fallback ids for otherwise-identical missing-id messages', () => {
  const first = normalizeChatOverlayMessage({
    username: 'viewer',
    userId: '100',
    message: 'hello world',
    timestamp: '2026-08-26T00:00:00.000Z',
  });

  const second = normalizeChatOverlayMessage({
    username: 'viewer',
    userId: '100',
    message: 'hello world',
    timestamp: '2026-08-26T00:00:00.000Z',
  });

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^chat-/);
  assert.match(second.id, /^chat-/);
});

