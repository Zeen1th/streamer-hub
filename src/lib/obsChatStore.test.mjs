import assert from 'node:assert/strict';
import test from 'node:test';
import { createObsChatStore } from '../store/obsChatStore.ts';

function createMockDeps(overrides = {}) {
  const sentChats = [];
  const timedOutUsers = [];
  const bannedUsers = [];
  const deletedMessageIds = [];
  const shoutouts = [];

  const deps = {
    sentChats,
    timedOutUsers,
    bannedUsers,
    deletedMessageIds,
    shoutouts,
    sendChat: async (message) => {
      sentChats.push(message);
      return { ok: true };
    },
    timeoutUser: async (target, durationSeconds, reason) => {
      timedOutUsers.push({ target, durationSeconds, reason });
      return { ok: true };
    },
    banUser: async (target, reason) => {
      bannedUsers.push({ target, reason });
      return { ok: true };
    },
    deleteMessage: async (messageId) => {
      deletedMessageIds.push(messageId);
      return { ok: true };
    },
    shoutoutUser: async (target) => {
      shoutouts.push(target);
      return { ok: true };
    },
    getDockUrl: async () => ({
      url: 'http://127.0.0.1:49178/chat-overlay.html',
      dockUrl: 'http://127.0.0.1:49178/obs-chat.html',
    }),
    saveSettings: async () => ({ ok: true }),
    ...overrides,
  };

  return deps;
}

test('obsChatStore initializes with default settings and empty messages', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);
  const state = store.getState();

  assert.equal(state.messages.length, 0);
  assert.equal(state.dockSettings.fontSize, 13);
  assert.equal(state.dockSettings.nameFontSize, 13);
  assert.equal(state.dockSettings.textFontSize, 13);
  assert.equal(state.dockSettings.fontFamily, 'system');
  assert.equal(state.dockSettings.customFontName, '');
  assert.equal(state.dockSettings.customFontUrl, '');
  assert.equal(state.dockSettings.density, 'comfortable');
  assert.equal(state.dockSettings.showTimestamps, true);
  assert.equal(state.dockSettings.showBadges, true);
  assert.equal(state.dockSettings.showAvatars, true);
});

test('addMessage appends messages and assigns defaults if missing', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  store.getState().addMessage({
    id: 'msg-1',
    username: 'Alice',
    message: 'Hello chat!',
    isBroadcaster: false,
    isMod: false,
    isSubscriber: true,
    isVip: false,
    emotes: [],
  });

  const messages = store.getState().messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].username, 'Alice');
  assert.equal(messages[0].message, 'Hello chat!');
  assert.ok(messages[0].timestamp);
});

test('addMessage caps total messages at maxMessages', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  for (let i = 0; i < 260; i++) {
    store.getState().addMessage({
      id: `m-${i}`,
      username: `User${i}`,
      message: `Message #${i}`,
      isBroadcaster: false,
      isMod: false,
      isSubscriber: false,
      isVip: false,
      emotes: [],
    });
  }

  const messages = store.getState().messages;
  assert.equal(messages.length, 250);
  assert.equal(messages[0].id, 'm-10');
  assert.equal(messages[249].id, 'm-259');
});

test('applyProfile patches avatarUrl and color across user messages', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  store.getState().addMessage({
    id: 'm-1',
    userId: 'u-123',
    username: 'Bob',
    message: 'Hey!',
    isBroadcaster: false,
    isMod: false,
    isSubscriber: false,
    isVip: false,
    emotes: [],
  });

  store.getState().applyProfile('u-123', 'https://avatar.test/bob.png', '#FF5500');

  const m = store.getState().messages[0];
  assert.equal(m.avatarUrl, 'https://avatar.test/bob.png');
  assert.equal(m.color, '#FF5500');
});

test('clearByScope marks specific messages or users as deleted, and clears all', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  store.getState().addMessage({ id: 'm-1', userId: 'u-1', username: 'user1', message: 'test 1', emotes: [] });
  store.getState().addMessage({ id: 'm-2', userId: 'u-2', username: 'user2', message: 'test 2', emotes: [] });

  store.getState().clearByScope('Message', 'm-1');
  assert.equal(store.getState().messages[0].deleted, true);
  assert.equal(store.getState().messages[1].deleted, undefined);

  store.getState().clearByScope('User', 'user2');
  assert.equal(store.getState().messages[1].deleted, true);

  store.getState().clearByScope('All');
  assert.equal(store.getState().messages.length, 0);
});

test('sendMessage validates input and invokes deps.sendChat', async () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  const empty = await store.getState().sendMessage('   ');
  assert.equal(empty.ok, false);
  assert.equal(deps.sentChats.length, 0);

  const res = await store.getState().sendMessage('Hello world!');
  assert.equal(res.ok, true);
  assert.deepEqual(deps.sentChats, ['Hello world!']);
});

test('moderation actions timeout, ban, shoutout and mark messages deleted', async () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  store.getState().addMessage({ id: 'm-1', username: 'badguy', message: 'spam', emotes: [] });

  const timeoutRes = await store.getState().timeoutUser('@badguy', 300, 'rule 1');
  assert.equal(timeoutRes.ok, true);
  assert.deepEqual(deps.timedOutUsers[0], { target: 'badguy', durationSeconds: 300, reason: 'rule 1' });
  assert.equal(store.getState().messages[0].deleted, true);

  const banRes = await store.getState().banUser('badguy', 'repeated');
  assert.equal(banRes.ok, true);
  assert.deepEqual(deps.bannedUsers[0], { target: 'badguy', reason: 'repeated' });

  const shoutoutRes = await store.getState().shoutoutUser('@goodfriend');
  assert.equal(shoutoutRes.ok, true);
  assert.deepEqual(deps.shoutouts, ['goodfriend']);

  const deleteRes = await store.getState().deleteMessage('m-1');
  assert.equal(deleteRes.ok, true);
  assert.deepEqual(deps.deletedMessageIds, ['m-1']);
  assert.equal(store.getState().messages[0].deleted, true);
});

test('updateSettings updates dock preferences', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  store.getState().updateSettings({
    fontSize: 16,
    nameFontSize: 18,
    textFontSize: 15,
    fontFamily: 'custom',
    customFontName: 'Comic Sans MS',
    customFontUrl: 'https://example.com/font.css',
    density: 'compact',
    showTimestamps: false,
    showAvatars: false,
    showBadges: false,
  });
  const settings = store.getState().dockSettings;
  assert.equal(settings.fontSize, 16);
  assert.equal(settings.nameFontSize, 18);
  assert.equal(settings.textFontSize, 15);
  assert.equal(settings.fontFamily, 'custom');
  assert.equal(settings.customFontName, 'Comic Sans MS');
  assert.equal(settings.customFontUrl, 'https://example.com/font.css');
  assert.equal(settings.density, 'compact');
  assert.equal(settings.showTimestamps, false);
  assert.equal(settings.showAvatars, false);
  assert.equal(settings.showBadges, false);
});

test('addMessage deduplicates and upgrades self-message echoes within 15 seconds', () => {
  const deps = createMockDeps();
  const store = createObsChatStore(deps);

  // First: host sends self message
  store.getState().addMessage({
    id: 'self-12345',
    username: 'Streamer',
    userId: 'streamer',
    message: 'Welcome everyone to the stream!',
    isBroadcaster: true,
    isSelf: true,
    timestamp: new Date().toISOString(),
  });

  assert.equal(store.getState().messages.length, 1);
  assert.equal(store.getState().messages[0].id, 'self-12345');

  // Then: Twitch IRC echo arrives with real server id
  store.getState().addMessage({
    id: 'twitch-server-id-999',
    username: 'Streamer',
    userId: 'streamer',
    message: 'Welcome everyone to the stream!',
    isBroadcaster: true,
    isSelf: false,
    timestamp: new Date().toISOString(),
  });

  // Must not have added a second message! It should have upgraded the existing message id.
  const messages = store.getState().messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'twitch-server-id-999');
  assert.equal(messages[0].isSelf, true);

  // Different message from same user is not deduplicated
  store.getState().addMessage({
    id: 'twitch-server-id-1000',
    username: 'Streamer',
    userId: 'streamer',
    message: 'Enjoy the stream!',
    isBroadcaster: true,
    isSelf: false,
    timestamp: new Date().toISOString(),
  });
  assert.equal(store.getState().messages.length, 2);

  // Different user with same message is not deduplicated
  store.getState().addMessage({
    id: 'twitch-server-id-1001',
    username: 'ViewerAlice',
    userId: 'vieweralice',
    message: 'Welcome everyone to the stream!',
    isBroadcaster: false,
    isSelf: false,
    timestamp: new Date().toISOString(),
  });
  assert.equal(store.getState().messages.length, 3);
});
