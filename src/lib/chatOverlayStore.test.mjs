import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatOverlayStore, selectVisibleChatMessages } from '../store/chatOverlayStore.ts';

const savedSettings = {
  enabled: true,
  maxMessages: 2,
  durationSeconds: 15,
  displayMode: 'stacked',
  fontSize: 20,
  avatarSize: 28,
  spacing: 8,
  showUsernames: true,
  showAvatars: true,
  theme: 'transparent',
  messageStyle: 'square',
  animation: 'fade',
  backgroundOpacity: 85,
  textShadow: true,
  fontFamily: 'barlow',
  avatarShape: 'circle',
  showBadges: true,
  compactMode: false,
  alignment: 'bottom-left',
  avatarPosition: 'left',
  scale: 100,
};

function message(id, text = id) {
  return {
    id,
    username: `viewer-${id}`,
    isBroadcaster: false,
    isMod: false,
    isVip: false,
    isSubscriber: false,
    message: text,
    timestamp: '2026-08-27T12:00:00.000Z',
  };
}

function harness(overrides = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const saved = [];
  const store = createChatOverlayStore({
    loadSettings: async () => savedSettings,
    saveSettings: async (settings) => {
      saved.push(settings);
      return true;
    },
    getOverlayUrl: async () => 'http://127.0.0.1:49178/chat-overlay.html',
    schedule: (callback) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    cancel: (id) => timers.delete(id),
    ...overrides,
  });
  return { store, timers, saved };
}

test('hydrates saved settings and OBS URL through the host', async () => {
  const { store } = harness();

  await store.getState().load();

  assert.deepEqual(store.getState().settings, savedSettings);
  assert.equal(store.getState().overlayUrl, 'http://127.0.0.1:49178/chat-overlay.html');
  assert.equal(store.getState().loadState, 'ready');
  assert.equal(store.getState().serverState, 'connected');
});

test('inserts chat messages and trims the oldest beyond the configured maximum', () => {
  const { store } = harness();
  store.getState().hydrate(savedSettings, 'http://overlay.test');

  store.getState().addMessage(message('one'));
  store.getState().addMessage(message('two'));
  store.getState().addMessage(message('three'));

  assert.deepEqual(store.getState().messages.map((item) => item.id), ['two', 'three']);
});

test('removes a message when its display duration expires', () => {
  const { store, timers } = harness();
  store.getState().hydrate(savedSettings, 'http://overlay.test');
  store.getState().addMessage(message('timed'));

  assert.equal(timers.size, 1);
  [...timers.values()][0]();

  assert.deepEqual(store.getState().messages, []);
});

test('shows only the newest message in latest display mode', () => {
  const { store } = harness();
  store.getState().hydrate({ ...savedSettings, displayMode: 'latest' }, 'http://overlay.test');
  store.getState().addMessage(message('older'));
  store.getState().addMessage(message('newest'));

  assert.deepEqual(selectVisibleChatMessages(store.getState()).map((item) => item.id), ['newest']);
});

test('moves from connected to reconnecting and back with core status', () => {
  const { store } = harness();
  store.getState().hydrate(savedSettings, 'http://overlay.test');

  store.getState().setCoreConnected(false);
  assert.equal(store.getState().serverState, 'reconnecting');

  store.getState().setCoreConnected(true);
  assert.equal(store.getState().serverState, 'connected');
});

test('exposes a server-unavailable state when the overlay URL cannot load', async () => {
  const { store } = harness({
    getOverlayUrl: async () => {
      throw new Error('server unavailable');
    },
  });

  await store.getState().load();

  assert.equal(store.getState().loadState, 'error');
  assert.equal(store.getState().serverState, 'unavailable');
  assert.equal(store.getState().overlayUrl, '');
});

test('persists normalized settings while updating the preview immediately', async () => {
  const { store, saved } = harness();
  store.getState().hydrate(savedSettings, 'http://overlay.test');

  await store.getState().updateSettings({ maxMessages: 99, displayMode: 'latest' });

  assert.equal(store.getState().settings.maxMessages, 24);
  assert.equal(store.getState().settings.displayMode, 'latest');
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], store.getState().settings);
  assert.equal(store.getState().saveState, 'saved');
});

test('correctly identifies RTL direction for Arabic and mixed Arabic/English messages', async () => {
  const { isRtlText, formatBidiText } = await import('./chatOverlay.ts');

  assert.equal(isRtlText('انا لعبت BG3 و كانت اسطوريه'), true);
  assert.equal(isRtlText('@zeen1_th انا لعبت BG3 و كانت اسطوريه'), true);
  assert.equal(isRtlText('Today I played BG3 and it was epic'), false);
  assert.equal(isRtlText('Hello world'), false);

  const formatted = formatBidiText('انا لعبت BG3 و كانت اسطوريه', true);
  assert.equal(formatted.startsWith('\u2067'), true);
  assert.equal(formatted.endsWith('\u2069'), true);
});

