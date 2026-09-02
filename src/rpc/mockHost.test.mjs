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
