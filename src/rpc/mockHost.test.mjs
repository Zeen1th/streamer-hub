import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import { pathToFileURL } from 'node:url';

class MemoryStorage {
  #store = new Map();

  clear() {
    this.#store.clear();
  }

  getItem(key) {
    return this.#store.has(key) ? this.#store.get(key) : null;
  }

  removeItem(key) {
    this.#store.delete(key);
  }

  setItem(key, value) {
    this.#store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'streamer-hub-rpc-'));

if (!globalThis.window) {
  globalThis.window = globalThis;
}

globalThis.localStorage = storage;
window.localStorage = storage;
window.setTimeout = (callback, delay, ...args) => {
  const timer = nativeSetTimeout(callback, delay, ...args);
  timer.unref?.();
  return timer;
};
window.clearTimeout = nativeClearTimeout;
globalThis.structuredClone ??= (value) => JSON.parse(JSON.stringify(value));

process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

afterEach(() => {
  storage.clear();
});

async function loadHarness() {
  const contractsSource = fs.readFileSync(new URL('./contracts.ts', import.meta.url), 'utf8');
  const mockHostSource = fs.readFileSync(new URL('./mockHost.ts', import.meta.url), 'utf8');
  const chatOverlaySource = fs.readFileSync(new URL('../lib/chatOverlay.ts', import.meta.url), 'utf8')
    .replaceAll("from '../rpc/contracts';", "from '../rpc/contracts.testable.ts';")
    .replaceAll("from '../rpc/contracts.ts';", "from '../rpc/contracts.testable.ts';");
  const chatOverlayPresetsSource = fs.readFileSync(new URL('../lib/chatOverlayPresets.ts', import.meta.url), 'utf8')
    .replaceAll("from '../rpc/contracts';", "from '../rpc/contracts.testable.ts';");
  const rpcDir = path.join(tempRoot, 'rpc');
  const libDir = path.join(tempRoot, 'lib');
  fs.mkdirSync(rpcDir, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });
  const contractsPath = path.join(rpcDir, 'contracts.testable.ts');
  const mockHostPath = path.join(rpcDir, 'mockHost.testable.ts');

  fs.writeFileSync(contractsPath, contractsSource, 'utf8');
  fs.writeFileSync(path.join(libDir, 'chatOverlay.ts'), chatOverlaySource, 'utf8');
  fs.writeFileSync(path.join(libDir, 'chatOverlayPresets.ts'), chatOverlayPresetsSource, 'utf8');
  fs.writeFileSync(
    mockHostPath,
    mockHostSource
      .split("import type { Transport } from './transport';\n").join('')
      .split("import type { Transport } from './transport';\r\n").join('')
      .split("from './contracts';").join("from './contracts.testable.ts';")
      .replaceAll("from '../lib/chatOverlay';", "from '../lib/chatOverlay.ts';")
      .replace(/\nexport class MockTransport[\s\S]*$/, '\n'),
    'utf8',
  );

  const [{ Channels, Events, PROTOCOL_VERSION }, { MockHost }] = await Promise.all([
    import(pathToFileURL(contractsPath).href),
    import(pathToFileURL(mockHostPath).href),
  ]);

  return { Channels, Events, PROTOCOL_VERSION, MockHost };
}

function waitForEvent(host, channel, timeoutMs = 1200) {
  return new Promise((resolve, reject) => {
    let off = () => {};
    const timer = nativeSetTimeout(() => {
      off();
      reject(new Error('TIMED OUT WAITING FOR EVENT ' + channel));
    }, timeoutMs);
    off = host.onMessage((message) => {
      if (message.kind !== 'event' || message.channel !== channel) return;
      nativeClearTimeout(timer);
      off();
      resolve(message.payload);
    });
  });
}

function invoke(host, protocolVersion, channel, payload) {
  const id = 'req-' + Math.random().toString(16).slice(2);
  return new Promise((resolve, reject) => {
    let off = () => {};
    const timer = nativeSetTimeout(() => {
      off();
      reject(new Error('TIMED OUT WAITING FOR RESPONSE ' + String(channel)));
    }, 1500);
    off = host.onMessage((message) => {
      if (message.kind !== 'response' || message.id !== id) return;
      nativeClearTimeout(timer);
      off();
      if (message.error) reject(new Error(message.error));
      else resolve(message.payload);
    });
    host.handleEnvelope({
      v: protocolVersion,
      id,
      kind: 'request',
      channel,
      payload,
    });
  });
}

test('hydrates saved chat overlay settings through rpc', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  assert.equal(typeof Channels.ChatOverlayGetState, 'string');

  localStorage.setItem('streamer-hub-mock-chat-overlay-settings', JSON.stringify({
    enabled: true,
    maxMessages: 6,
    durationSeconds: 45,
    displayMode: 'latest',
    fontSize: 18,
    avatarSize: 28,
    spacing: 10,
    showUsernames: false,
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
  }));

  const host = new MockHost();
  const state = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);

  assert.deepEqual(state, {
    enabled: true,
    maxMessages: 6,
    durationSeconds: 45,
    displayMode: 'latest',
    fontSize: 18,
    avatarSize: 28,
    spacing: 10,
    showUsernames: false,
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
  });
});

test('saves chat overlay settings and returns the updated state', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  assert.equal(typeof Channels.ChatOverlaySaveSettings, 'string');

  const host = new MockHost();
  const next = {
    enabled: true,
    maxMessages: 5,
    durationSeconds: 30,
    displayMode: 'stacked',
    fontSize: 20,
    avatarSize: 24,
    spacing: 8,
    showUsernames: true,
    showAvatars: false,
    theme: 'light',
    messageStyle: 'rounded',
    animation: 'off',
    backgroundOpacity: 70,
    textShadow: false,
    fontFamily: 'cairo',
    avatarShape: 'squircle',
    showBadges: false,
    compactMode: true,
    alignment: 'top-right',
    scale: 120,
  };

  const result = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlaySaveSettings, next);
  const stored = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(stored, next);
  assert.deepEqual(JSON.parse(localStorage.getItem('streamer-hub-mock-chat-overlay-settings')), next);
});

test('provides a repeatable installer payload for updater debug flow', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const state = await invoke(host, PROTOCOL_VERSION, Channels.UpdateCheck, undefined);

  assert.equal(state.updateAvailable, false);
  assert.match(state.downloadUrl, /StreamerHub-Setup-v0\.3\.0\.exe$/);

  const install = await invoke(host, PROTOCOL_VERSION, Channels.UpdateInstall, {
    downloadUrl: state.downloadUrl,
  });
  assert.deepEqual(install, { ok: true });
});

test('returns a loopback overlay url for OBS/browser mode', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  assert.equal(typeof Channels.ChatOverlayGetUrl, 'string');

  const host = new MockHost();
  const result = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetUrl, undefined);

  assert.equal(result.url, 'http://127.0.0.1:49178/chat-overlay.html');
});

test('accepts a window resize direction through the typed RPC boundary', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const result = await invoke(host, PROTOCOL_VERSION, Channels.WindowBeginResize, { edge: 'bottom-right' });

  assert.deepEqual(result, { ok: true });
});
test('keeps forwarding existing status and chat events in mock mode', async () => {
  const { Events, MockHost } = await loadHarness();
  const host = new MockHost();

  const statusPromise = waitForEvent(host, Events.CoreStatusChanged);
  const chatPromise = waitForEvent(host, Events.TwitchChatMessage);
  host.simulateChat({ username: 'viewer', message: '!death' });

  const [status, chat] = await Promise.all([statusPromise, chatPromise]);
  assert.equal(status.coreConnected, true);
  assert.equal(chat.username, 'viewer');
  assert.equal(chat.message, '!death');
});

test('handles Twitch title query and update through mock host', async () => {
  const { Channels, Events, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const initial = await invoke(host, PROTOCOL_VERSION, Channels.TwitchGetTitle, undefined);
  assert.equal(initial.ok, true);
  assert.equal(initial.title, 'Chill Gaming Stream');

  const filePathRes = await invoke(host, PROTOCOL_VERSION, Channels.TwitchGetTitleFilePath, undefined);
  assert.ok(filePathRes.path.includes('title.txt'));

  const titleChangedPromise = waitForEvent(host, Events.TwitchTitleChanged);
  const updateResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchUpdateTitle, {
    title: 'Elden Ring No Hit Run | Deaths: 0',
  });
  assert.deepEqual(updateResult, { ok: true });

  const titleChangedEvent = await titleChangedPromise;
  assert.equal(titleChangedEvent.title, 'Elden Ring No Hit Run | Deaths: 0');

  const updated = await invoke(host, PROTOCOL_VERSION, Channels.TwitchGetTitle, undefined);
  assert.equal(updated.ok, true);
  assert.equal(updated.title, 'Elden Ring No Hit Run | Deaths: 0');
});

test('handles Twitch avatar lookup and test message broadcast through mock host', async () => {
  const { Channels, Events, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const profileEventPromise = waitForEvent(host, Events.TwitchUserProfile);
  const avatarCheckResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchCheckAvatar, {
    username: 'teststreamer',
  });

  assert.equal(avatarCheckResult.ok, true);
  assert.equal(avatarCheckResult.username, 'teststreamer');
  assert.ok(avatarCheckResult.avatarUrl.startsWith('data:image/svg+xml'));

  const profileEvent = await profileEventPromise;
  assert.equal(profileEvent.userId, avatarCheckResult.userId);
  assert.equal(profileEvent.avatarUrl, avatarCheckResult.avatarUrl);

  const chatEventPromise = waitForEvent(host, Events.TwitchChatMessage);
  const testMsgResult = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayTestMessage, {
    username: 'teststreamer',
    message: 'Testing avatar rendering in overlay',
    avatarUrl: avatarCheckResult.avatarUrl,
  });

  assert.deepEqual(testMsgResult, { ok: true });
  const chatEvent = await chatEventPromise;
  assert.equal(chatEvent.username, 'teststreamer');
  assert.equal(chatEvent.message, 'Testing avatar rendering in overlay');
  assert.equal(chatEvent.avatarUrl, avatarCheckResult.avatarUrl);
});

test('resolves active chat sender with bot default, broadcaster override, and offline fallback', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  // 1. Initially bot is disabled -> active sender should be broadcaster
  const initialSettings = await invoke(host, PROTOCOL_VERSION, Channels.SettingsGetState, undefined);
  assert.equal(initialSettings.botAccountEnabled, false);
  assert.equal(initialSettings.preferredChatSender, 'bot');

  let sendResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, { message: 'Hello stream' });
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.senderRole, 'broadcaster');
  assert.equal(sendResult.senderLogin, 'mock_channel');

  // 2. Enable bot -> default preference 'bot' is used, active sender becomes bot
  await invoke(host, PROTOCOL_VERSION, Channels.SettingsSave, { botAccountEnabled: true });
  const updatedSettings = await invoke(host, PROTOCOL_VERSION, Channels.SettingsGetState, undefined);
  assert.equal(updatedSettings.botAccountEnabled, true);

  sendResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, { message: 'Hello from bot' });
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.senderRole, 'bot');
  assert.equal(sendResult.senderLogin, 'mock_bot');

  // 3. Explicitly set preferredChatSender to 'broadcaster'
  await invoke(host, PROTOCOL_VERSION, Channels.SettingsSave, { preferredChatSender: 'broadcaster' });
  sendResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, { message: 'Hello from main' });
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.senderRole, 'broadcaster');
  assert.equal(sendResult.senderLogin, 'mock_channel');

  // 4. Switch preference back to 'bot' but disable bot -> falls back cleanly to broadcaster
  await invoke(host, PROTOCOL_VERSION, Channels.SettingsSave, {
    preferredChatSender: 'bot',
    botAccountEnabled: false,
  });
  sendResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, { message: 'Fallback test' });
  assert.equal(sendResult.ok, true);
  assert.equal(sendResult.senderRole, 'broadcaster');
  assert.equal(sendResult.senderLogin, 'mock_channel');
});

test('handles ChatOverlayReload and ChatOverlaySetPreview through mock host', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const reloadResult = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayReload, undefined);
  assert.deepEqual(reloadResult, { ok: true });

  const previewResult = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlaySetPreview, {
    enabled: true,
    messages: [
      {
        id: 'msg-1',
        username: 'ViewerOne',
        message: 'Hello from test preview!',
      },
    ],
  });
  assert.deepEqual(previewResult, { ok: true });

  const previewDisableResult = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlaySetPreview, {
    enabled: false,
  });
  assert.deepEqual(previewDisableResult, { ok: true });
});

test('handles ObsChat channels and keeps settings isolated from ChatOverlay', async () => {
  localStorage.removeItem('streamer-hub-mock-chat-overlay-settings');
  localStorage.removeItem('streamer-hub-mock-obs-chat-settings');
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const urlResult = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatGetUrl, undefined);
  assert.equal(urlResult.url, 'http://127.0.0.1:49178/obs-chat.html');

  const initialObs = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatGetState, undefined);
  assert.ok(initialObs);

  const initialOverlay = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);
  assert.ok(initialOverlay);

  const nextObs = {
    ...initialObs,
    flow: { ...initialObs.flow, maxMessages: 15 },
    bubble: {
      ...initialObs.bubble,
      background: { ...initialObs.bubble.background, color: '#191919' },
    },
  };

  const saveResult = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatSaveSettings, nextObs);
  assert.deepEqual(saveResult, { ok: true });

  const fetchedObs = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatGetState, undefined);
  assert.equal(fetchedObs.flow.maxMessages, 15);
  assert.equal(fetchedObs.bubble.background.color, '#191919');

  // Verify stream overlay settings remain untouched
  const fetchedOverlay = await invoke(host, PROTOCOL_VERSION, Channels.ChatOverlayGetState, undefined);
  assert.notEqual(fetchedOverlay.flow.maxMessages, 15);
  assert.notEqual(fetchedOverlay.bubble.background.color, '#191919');

  const reloadResult = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatReload, undefined);
  assert.deepEqual(reloadResult, { ok: true });

  const previewResult = await invoke(host, PROTOCOL_VERSION, Channels.ObsChatSetPreview, {
    enabled: true,
    messages: [{ id: 'test-obs', username: 'Streamer', message: 'Testing OBS dock' }],
  });
  assert.deepEqual(previewResult, { ok: true });
});

test('handles TwitchBotSimulate debug bot and sender switching in mock host', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  // Initially not simulated
  const simResult = await invoke(host, PROTOCOL_VERSION, Channels.TwitchBotSimulate, { enabled: true });
  assert.equal(simResult.ok, true);
  assert.equal(simResult.simulated, true);
  assert.equal(simResult.botLogin, 'ExampleBot');

  // Chat message defaults to bot
  const botSend = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, { message: 'Hello from simulated bot' });
  assert.equal(botSend.ok, true);
  assert.equal(botSend.senderRole, 'bot');
  assert.equal(botSend.senderLogin, 'ExampleBot');

  // Per-message override to broadcaster
  const hostSend = await invoke(host, PROTOCOL_VERSION, Channels.TwitchSendChatMessage, {
    message: 'Hello from streamer',
    senderRole: 'broadcaster',
  });
  assert.equal(hostSend.ok, true);
  assert.equal(hostSend.senderRole, 'broadcaster');
  assert.equal(hostSend.senderLogin, 'mock_channel');

  // Toggle off
  const turnOff = await invoke(host, PROTOCOL_VERSION, Channels.TwitchBotSimulate, { enabled: false });
  assert.equal(turnOff.ok, true);
  assert.equal(turnOff.simulated, false);
});

test('handles AutoRepliesGenerate and rejects duplicate message IDs', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  const msg = {
    id: 'msg-unique-1',
    username: 'viewer123',
    message: 'What games do you play?',
    isBroadcaster: false,
    isMod: false,
    isVip: false,
    isSubscriber: false,
    timestamp: new Date().toISOString(),
  };

  // First call succeeds
  const res1 = await invoke(host, PROTOCOL_VERSION, Channels.AutoRepliesGenerate, {
    ruleId: 'rule-1',
    message: msg,
    send: false,
  });
  assert.equal(res1.ok, true);
  assert.match(res1.message, /AI Reply/);

  // Second call with same message ID is rejected as duplicate
  const res2 = await invoke(host, PROTOCOL_VERSION, Channels.AutoRepliesGenerate, {
    ruleId: 'rule-1',
    message: msg,
    send: false,
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'DUPLICATE MESSAGE ALREADY PROCESSED');
});

test('handles AutoRepliesGenerate senderRole switching between broadcaster and bot', async () => {
  const { Channels, PROTOCOL_VERSION, MockHost } = await loadHarness();
  const host = new MockHost();

  await invoke(host, PROTOCOL_VERSION, Channels.TwitchBotSimulate, { enabled: true, login: 'MySuperBot' });

  const msg1 = {
    id: 'msg-sender-broadcaster',
    username: 'viewer123',
    message: 'test question',
    isBroadcaster: false,
    isMod: false,
    isVip: false,
    isSubscriber: false,
    timestamp: new Date().toISOString(),
  };

  const resBroadcaster = await invoke(host, PROTOCOL_VERSION, Channels.AutoRepliesGenerate, {
    ruleId: 'rule-1',
    message: msg1,
    send: false,
    senderRole: 'broadcaster',
  });
  assert.equal(resBroadcaster.ok, true);
  assert.equal(resBroadcaster.senderRole, 'broadcaster');
  assert.equal(resBroadcaster.senderLogin, 'mock_channel');

  const msg2 = {
    id: 'msg-sender-bot',
    username: 'viewer123',
    message: 'test question 2',
    isBroadcaster: false,
    isMod: false,
    isVip: false,
    isSubscriber: false,
    timestamp: new Date().toISOString(),
  };

  const resBot = await invoke(host, PROTOCOL_VERSION, Channels.AutoRepliesGenerate, {
    ruleId: 'rule-1',
    message: msg2,
    send: false,
    senderRole: 'bot',
  });
  assert.equal(resBot.ok, true);
  assert.equal(resBot.senderRole, 'bot');
  assert.equal(resBot.senderLogin, 'ExampleBot');
});

