import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatOverlayStore, selectVisibleChatMessages } from '../store/chatOverlayStore.ts';
import { createDefaultChatOverlaySettings } from './chatOverlay.ts';

function settings(overrides = {}) {
  const base = createDefaultChatOverlaySettings();
  return {
    ...base,
    ...overrides,
    enabled: true,
    flow: { ...base.flow, maxMessages: 2, durationSeconds: 15, ...(overrides.flow ?? {}) },
    filters: { ...base.filters, ...(overrides.filters ?? {}) },
  };
}

function message(id, text = id, extra = {}) {
  return {
    id,
    username: `viewer-${id}`,
    userId: `uid-${id}`,
    isBroadcaster: false,
    isMod: false,
    isVip: false,
    isSubscriber: false,
    message: text,
    timestamp: '2026-08-27T12:00:00.000Z',
    ...extra,
  };
}

function harness(overrides = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const saved = [];
  const store = createChatOverlayStore({
    loadSettings: async () => settings(),
    saveSettings: async (value) => {
      saved.push(value);
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

  assert.deepEqual(store.getState().settings, settings());
  assert.equal(store.getState().overlayUrl, 'http://127.0.0.1:49178/chat-overlay.html');
  assert.equal(store.getState().loadState, 'ready');
  assert.equal(store.getState().serverState, 'connected');
});

test('inserts messages and trims the oldest beyond the configured maximum', () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');

  store.getState().addMessage(message('one'));
  store.getState().addMessage(message('two'));
  store.getState().addMessage(message('three'));

  assert.deepEqual(store.getState().messages.map((m) => m.id), ['two', 'three']);
});

test('removes a message when its display duration expires', () => {
  const { store, timers } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  store.getState().addMessage(message('timed'));

  assert.equal(timers.size, 1);
  [...timers.values()][0]();

  assert.deepEqual(store.getState().messages, []);
});

test('schedules no expiry timer when duration is zero', () => {
  const { store, timers } = harness();
  store.getState().hydrate(settings({ flow: { maxMessages: 2, durationSeconds: 0 } }), 'http://overlay.test');
  store.getState().addMessage(message('forever'));

  assert.equal(timers.size, 0);
  assert.equal(store.getState().messages.length, 1);
});

test('shows only the newest message in latest display mode', () => {
  const { store } = harness();
  store.getState().hydrate(settings({ flow: { displayMode: 'latest', maxMessages: 2 } }), 'http://overlay.test');
  store.getState().addMessage(message('older'));
  store.getState().addMessage(message('newest'));

  assert.deepEqual(selectVisibleChatMessages(store.getState()).map((m) => m.id), ['newest']);
});

test('moves from connected to reconnecting and back with core status', () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');

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

test('patches settings deeply instead of replacing whole groups', async () => {
  const { store, saved } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  const before = store.getState().settings.text.color;

  await store.getState().updateSettings({ text: { size: 40 } });

  assert.equal(store.getState().settings.text.size, 40);
  assert.equal(store.getState().settings.text.color, before, 'sibling fields survive the patch');
  assert.equal(store.getState().settings.flow.maxMessages, 2, 'other groups are untouched');
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], store.getState().settings);
  assert.equal(store.getState().saveState, 'saved');
});

test('normalizes while persisting so out-of-range values never reach the host', async () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');

  await store.getState().updateSettings({ flow: { maxMessages: 9999 } });

  assert.equal(store.getState().settings.flow.maxMessages, 40);
});

// --- filters ---------------------------------------------------------------

test('drops messages from blocked usernames before they reach the overlay', () => {
  const { store } = harness();
  store.getState().hydrate(settings({ filters: { blockedUsernames: ['viewer-spam'] } }), 'http://overlay.test');

  store.getState().addMessage(message('spam'));
  store.getState().addMessage(message('ok'));

  assert.deepEqual(store.getState().messages.map((m) => m.id), ['ok']);
});

test('masks blocked words in place when the action is mask', () => {
  const { store } = harness();
  store.getState().hydrate(
    settings({ filters: { blockedWords: ['darn'], blockedWordAction: 'mask' } }),
    'http://overlay.test',
  );

  store.getState().addMessage(message('m', 'well darn that stinks'));

  assert.equal(store.getState().messages[0].message, 'well **** that stinks');
});

// --- profile patching (the first-message avatar fix) -----------------------

test('patches a resolved avatar onto messages already on screen', () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  store.getState().addMessage(message('first'));

  const before = store.getState().messages[0].avatarUrl;
  store.getState().applyProfile('uid-first', 'https://cdn.test/avatar.png', '#00ff00');

  const after = store.getState().messages[0];
  assert.notEqual(after.avatarUrl, before);
  assert.equal(after.avatarUrl, 'https://cdn.test/avatar.png');
  assert.equal(after.color, '#00ff00');
});

test('profile patches leave other users alone and ignore empty ids', () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  store.getState().addMessage(message('a'));
  store.getState().addMessage(message('b'));

  store.getState().applyProfile('uid-a', 'https://cdn.test/a.png');
  store.getState().applyProfile('', 'https://cdn.test/nobody.png');

  const [a, b] = store.getState().messages;
  assert.equal(a.avatarUrl, 'https://cdn.test/a.png');
  assert.notEqual(b.avatarUrl, 'https://cdn.test/a.png');
});

// --- moderation ------------------------------------------------------------

test('clears a single moderated message and cancels its timer', () => {
  const { store, timers } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  store.getState().addMessage(message('deleted'));

  store.getState().clearByScope('message', 'deleted');

  assert.deepEqual(store.getState().messages, []);
  assert.equal(timers.size, 0, 'the expiry timer is cancelled, not leaked');
});

test('clears every message from a timed-out user', () => {
  const { store } = harness();
  store.getState().hydrate(settings({ flow: { maxMessages: 10, durationSeconds: 15 } }), 'http://overlay.test');
  store.getState().addMessage(message('a', 'a', { userId: 'troll' }));
  store.getState().addMessage(message('b', 'b', { userId: 'someone' }));
  store.getState().addMessage(message('c', 'c', { userId: 'troll' }));

  store.getState().clearByScope('user', 'troll');

  assert.deepEqual(store.getState().messages.map((m) => m.id), ['b']);
});

test('clears the whole overlay on a full chat clear', () => {
  const { store } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');
  store.getState().addMessage(message('a'));
  store.getState().addMessage(message('b'));

  store.getState().clearByScope('all');

  assert.deepEqual(store.getState().messages, []);
});

test('saveNow explicitly flushes current settings', async () => {
  const { store, saved } = harness();
  store.getState().hydrate(settings(), 'http://overlay.test');

  const ok = await store.getState().saveNow();
  assert.equal(ok, true);
  assert.equal(saved.length, 1);
  assert.equal(store.getState().saveState, 'saved');
});

test('sequential save queue serializes rapid concurrent updates and preserves final value', async () => {
  const { store, saved } = harness({
    saveSettings: async (val) => {
      // Introduce micro-delay to simulate async RPC transit
      await new Promise((r) => setTimeout(r, 10));
      saved.push(val);
      return true;
    },
  });
  store.getState().hydrate(settings(), 'http://overlay.test');

  // Trigger rapid concurrent updates like scrubbing a slider
  const p1 = store.getState().updateSettings({ text: { size: 20 } });
  const p2 = store.getState().updateSettings({ text: { size: 30 } });
  const p3 = store.getState().updateSettings({ text: { size: 45 } });

  await Promise.all([p1, p2, p3]);

  assert.equal(store.getState().settings.text.size, 45);
  assert.equal(saved[saved.length - 1].text.size, 45, 'last saved value matches latest update');
  assert.equal(store.getState().saveState, 'saved');
});

test('loads multiple chat overlays and switches active overlay', async () => {
  const overlay2Settings = settings({ text: { size: 28 } });
  const mockOverlays = [
    { id: 'default', name: 'Main Overlay', isMain: true, settings: settings() },
    { id: 'custom-1', name: 'Gaming Overlay', isMain: false, settings: overlay2Settings },
  ];

  const { store } = harness({
    loadOverlays: async () => mockOverlays,
    getOverlayUrl: async (id) =>
      id && id !== 'default'
        ? `http://127.0.0.1:49178/chat-overlay.html?id=${id}`
        : 'http://127.0.0.1:49178/chat-overlay.html',
  });

  await store.getState().load();

  assert.equal(store.getState().overlays.length, 2);
  assert.equal(store.getState().activeOverlayId, 'default');
  assert.equal(store.getState().overlayUrl, 'http://127.0.0.1:49178/chat-overlay.html');

  // Switch to custom-1
  await store.getState().setActiveOverlay('custom-1');
  assert.equal(store.getState().activeOverlayId, 'custom-1');
  assert.equal(store.getState().settings.text.size, 28);
  assert.equal(store.getState().overlayUrl, 'http://127.0.0.1:49178/chat-overlay.html?id=custom-1');
});

test('creates a new overlay and sets it active', async () => {
  const savedOverlays = [];
  const { store } = harness({
    saveOverlay: async (overlay) => {
      savedOverlays.push(overlay);
      return true;
    },
    getOverlayUrl: async (id) => `http://127.0.0.1:49178/chat-overlay.html?id=${id}`,
  });

  const newId = await store.getState().createOverlay('Alerts Overlay');

  assert.ok(newId.startsWith('overlay-'));
  assert.equal(store.getState().activeOverlayId, newId);
  assert.equal(store.getState().overlays.length, 2);
  const created = store.getState().overlays.find((o) => o.id === newId);
  assert.ok(created);
  assert.equal(created.name, 'Alerts Overlay');
  assert.equal(created.isMain, false);
  assert.equal(savedOverlays.length, 1);
  assert.equal(savedOverlays[0].id, newId);
});

test('duplicates existing overlay and preserves settings', async () => {
  const savedOverlays = [];
  const { store } = harness({
    saveOverlay: async (overlay) => {
      savedOverlays.push(overlay);
      return true;
    },
    getOverlayUrl: async (id) => `http://127.0.0.1:49178/chat-overlay.html?id=${id}`,
  });

  await store.getState().updateSettings({ text: { size: 32 } });
  const copyId = await store.getState().duplicateOverlay('default');

  assert.ok(copyId);
  assert.equal(store.getState().overlays.length, 2);
  const copy = store.getState().overlays.find((o) => o.id === copyId);
  assert.ok(copy);
  assert.equal(copy.name, 'Main Overlay (Copy)');
  assert.equal(copy.settings.text.size, 32);
});

test('renames an overlay', async () => {
  const savedOverlays = [];
  const { store } = harness({
    saveOverlay: async (overlay) => {
      savedOverlays.push(overlay);
      return true;
    },
  });

  const id = await store.getState().createOverlay('Old Name');
  const ok = await store.getState().renameOverlay(id, 'New Renamed Overlay');

  assert.equal(ok, true);
  const updated = store.getState().overlays.find((o) => o.id === id);
  assert.equal(updated.name, 'New Renamed Overlay');
  assert.equal(savedOverlays[savedOverlays.length - 1].name, 'New Renamed Overlay');
});

test('deletes a custom overlay but prevents deleting the main overlay', async () => {
  const deletedIds = [];
  const { store } = harness({
    saveOverlay: async () => true,
    deleteOverlay: async (id) => {
      deletedIds.push(id);
      return true;
    },
    getOverlayUrl: async () => 'http://127.0.0.1:49178/chat-overlay.html',
  });

  // Attempt to delete main overlay 'default'
  const blocked = await store.getState().deleteOverlay('default');
  assert.equal(blocked, false, 'cannot delete main overlay');
  assert.equal(deletedIds.length, 0);

  // Create custom overlay and delete it
  const customId = await store.getState().createOverlay('To Delete');
  assert.equal(store.getState().activeOverlayId, customId);

  const deleted = await store.getState().deleteOverlay(customId);
  assert.equal(deleted, true);
  assert.equal(deletedIds.length, 1);
  assert.equal(deletedIds[0], customId);
  assert.equal(store.getState().activeOverlayId, 'default', 'falls back to default active overlay');
  assert.equal(store.getState().overlays.some((o) => o.id === customId), false);
});

test('copies and pastes settings between overlays', async () => {
  const { store } = harness({
    saveOverlay: async () => true,
    getOverlayUrl: async (id) => `http://127.0.0.1:49178/chat-overlay.html?id=${id}`,
  });

  // Configure custom styling on main overlay
  await store.getState().updateSettings({
    text: { size: 26, font: { family: 'cinzel' } },
    bubble: { background: { color: '#123456' } },
  });

  // Copy settings
  store.getState().copySettings();
  assert.ok(store.getState().copiedSettings);
  assert.equal(store.getState().copiedSettings.text.size, 26);
  assert.equal(store.getState().copiedSettings.text.font.family, 'cinzel');

  // Create a new overlay with default settings
  const customId = await store.getState().createOverlay('Secondary');
  assert.equal(store.getState().activeOverlayId, customId);

  // Paste settings onto the new overlay
  const pasted = await store.getState().pasteSettings();
  assert.equal(pasted, true);
  assert.equal(store.getState().settings.text.size, 26);
  assert.equal(store.getState().settings.text.font.family, 'cinzel');
  assert.equal(store.getState().settings.bubble.background.color, '#123456');
});


