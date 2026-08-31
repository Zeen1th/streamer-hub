import type { ActionKeybind, AutoReply, AutoReplySettings, ChatOverlaySettings, ConnectionStatus, Counter, RpcEnvelope, TwitchSettings } from './contracts';
import { Channels, Events, PROTOCOL_VERSION } from './contracts';
import type { Transport } from './transport';
import { createDefaultChatOverlaySettings } from '../lib/chatOverlay';

const STORAGE_KEY = 'streamer-hub-mock-counters';
const LEGACY_STORAGE_KEY = 'streamer-hub-mock-state';
const TWITCH_STORAGE_KEY = 'streamer-hub-mock-settings';
const AUTO_REPLY_STORAGE_KEY = 'streamer-hub-mock-auto-replies';
const KEYBIND_STORAGE_KEY = 'streamer-hub-mock-keybinds';
const AUTO_REPLY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-auto-reply-settings';
const CHAT_OVERLAY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-chat-overlay-settings';
const CHAT_OVERLAY_URL = 'http://127.0.0.1:49178/chat-overlay.html';
const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = createDefaultChatOverlaySettings();

interface MockSettings {
  clientId: string;
  clientSecret: string;
  language: string;
}

function migrateLegacyCounters(): Counter[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      count?: number;
      config?: { commandName?: string; permission?: Counter['commands']['increase']['permission']; cooldownSeconds?: number };
      obs?: Counter['obs'];
    };
    if (typeof parsed.count !== 'number') return null;
    const commandName = parsed.config?.commandName ?? 'deaths';
    const permission = parsed.config?.permission ?? 'everyone';
    const cooldown = parsed.config?.cooldownSeconds ?? 10;
    return [
      {
        id: crypto.randomUUID(),
        name: 'Deaths',
        count: parsed.count,
        commands: {
          increase: { commandName, permission, cooldownSeconds: cooldown },
          decrease: { commandName: `${commandName}down`, permission, cooldownSeconds: cooldown },
          reset: { commandName: `${commandName}reset`, permission, cooldownSeconds: 0 },
        },
        obs: parsed.obs ?? { enabled: false, filePath: '', template: 'Deaths: {count}' },
      },
    ];
  } catch {
    return null;
  }
}

export class MockHost {
  private counters: Counter[];
  private autoReplies: AutoReply[];
  private autoReplySettings: AutoReplySettings;
  private keybinds: ActionKeybind[];
  private chatOverlaySettings: ChatOverlaySettings;
  private readonly listeners = new Set<(message: RpcEnvelope) => void>();
  private isMaximized = false;
  private twitchConnected = false;
  private readonly timers: number[] = [];

  constructor() {
    this.counters = this.loadCounters();
    this.autoReplies = this.loadAutoReplies();
    this.autoReplySettings = this.loadAutoReplySettings();
    this.keybinds = this.loadKeybinds();
    this.chatOverlaySettings = this.loadChatOverlaySettings();
    this.schedule(() => this.emitStatus(), 350);
    this.schedule(() => {
      this.twitchConnected = true;
      this.emitStatus();
    }, 1400);
    this.schedule(() => this.twitchBlip(), 90000);
  }

  simulateChat(message: { username: string; message: string }): void {
    this.emitEvent(Events.TwitchChatMessage, {
      id: crypto.randomUUID(),
      username: message.username,
      isBroadcaster: message.username === 'streamer',
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: message.message,
      timestamp: new Date().toISOString(),
    });
  }

  onMessage(handler: (message: RpcEnvelope) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  handleEnvelope(message: RpcEnvelope): void {
    if (message.kind !== 'request') return;
    this.schedule(() => this.handleRequest(message), this.latency());
  }

  private emit(message: RpcEnvelope): void {
    for (const handler of this.listeners) handler(message);
  }

  private handleRequest(request: RpcEnvelope): void {
    switch (request.channel) {
      case 'window/minimize':
        this.respond(request, undefined);
        break;
      case 'window/maximize-toggle':
        this.isMaximized = !this.isMaximized;
        this.respond(request, { isMaximized: this.isMaximized });
        this.emitEvent(Events.WindowMaximizedChanged, { isMaximized: this.isMaximized });
        break;
      case 'window/close':
        this.respond(request, undefined);
        break;
      case 'window/is-maximized':
        this.respond(request, { isMaximized: this.isMaximized });
        break;
      case 'window/begin-drag':
        this.respond(request, { ok: true });
        break;
      case 'core/get-status':
        this.respond(request, this.status());
        break;
      case 'counters/get-state':
        this.respond(request, structuredClone(this.counters));
        break;
      case 'keybinds/get-state':
        this.respond(request, { bindings: structuredClone(this.keybinds), registrations: this.keybinds.map((binding) => ({ bindingId: binding.id, status: binding.enabled ? 'registered' : 'disabled' })) });
        break;
      case 'keybinds/save': {
        const payload = request.payload as { bindings?: ActionKeybind[] };
        this.keybinds = structuredClone(payload.bindings ?? []);
        try { localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(this.keybinds)); } catch { void 0; }
        this.respond(request, { bindings: structuredClone(this.keybinds), registrations: this.keybinds.map((binding) => ({ bindingId: binding.id, status: binding.enabled ? 'registered' : 'disabled' })) });
        break;
      }
      case 'counters/set-count': {
        const payload = request.payload as { counterId: string; count: number };
        this.counters = this.counters.map((c) =>
          c.id === payload.counterId ? { ...c, count: Math.max(0, payload.count) } : c,
        );
        this.persist();
        this.respond(request, { ok: true, count: Math.max(0, payload.count) });
        break;
      }
      case 'counters/save': {
        const payload = request.payload as { counter?: Counter };
        if (payload?.counter) {
          this.counters = this.counters.some((c) => c.id === payload.counter!.id)
            ? this.counters.map((c) => (c.id === payload.counter!.id ? payload.counter! : c))
            : [...this.counters, payload.counter!];
          this.persist();
        }
        this.respond(request, { ok: true });
        break;
      }
      case 'counters/delete': {
        const payload = request.payload as { counterId: string };
        this.counters = this.counters.filter((c) => c.id !== payload.counterId);
        this.persist();
        this.respond(request, { ok: true });
        break;
      }
      case 'auto-replies/get-state':
        this.respond(request, structuredClone(this.autoReplies));
        break;
      case 'auto-replies/settings-get':
        this.respond(request, structuredClone(this.autoReplySettings));
        break;
      case 'auto-replies/settings-save':
        this.autoReplySettings = request.payload as AutoReplySettings;
        localStorage.setItem(AUTO_REPLY_SETTINGS_STORAGE_KEY, JSON.stringify(this.autoReplySettings));
        this.respond(request, { ok: true });
        break;
      case 'auto-replies/save': {
        const payload = request.payload as { rule?: AutoReply };
        if (payload?.rule) {
          this.autoReplies = this.autoReplies.some((rule) => rule.id === payload.rule!.id)
            ? this.autoReplies.map((rule) => (rule.id === payload.rule!.id ? payload.rule! : rule))
            : [...this.autoReplies, payload.rule!];
          this.persistAutoReplies();
        }
        this.respond(request, { ok: true });
        break;
      }
      case 'auto-replies/delete': {
        const payload = request.payload as { ruleId: string };
        this.autoReplies = this.autoReplies.filter((rule) => rule.id !== payload.ruleId);
        this.persistAutoReplies();
        this.respond(request, { ok: true });
        break;
      }
      case 'auto-replies/generate': {
        this.respond(request, { ok: true, message: 'Mock AI reply — configure OpenRouter in the desktop app.', usedFallback: false });
        break;
      }
      case 'twitch/send-chat-message':
        this.respond(request, { ok: this.twitchConnected });
        break;
      case 'twitch/get-title':
        this.respond(request, { ok: this.twitchConnected, title: 'Live Streamer Hub Gaming' });
        break;
      case 'twitch/update-title':
        this.respond(request, { ok: this.twitchConnected });
        break;
      case 'obs/write': {
        const payload = request.payload as { filePath: string; content: string };
        if (!payload.filePath.trim()) {
          this.respond(request, { ok: false, error: 'NO TARGET FILE SET' });
          break;
        }
        this.respond(request, { ok: true });
        break;
      }
      case 'dialog/save-file':
        this.respond(request, { path: 'C:\\StreamerHub\\deaths.txt' });
        break;
      case 'twitch/authorize':
        this.respond(request, { ok: true });
        break;
      case 'twitch/forget':
        this.respond(request, { ok: true });
        break;
      case 'settings/get-state': {
        const settings = this.loadSettings();
        this.respond(request, { twitch: { clientId: settings.clientId, clientSecret: settings.clientSecret }, language: settings.language, closeToTray: true });
        break;
      }
      case 'settings/save': {
        const payload = request.payload as { twitch?: TwitchSettings; language?: string; closeToTray?: boolean };
        if (payload?.twitch || payload?.language) {
          try {
            const current = this.loadSettings();
            const next: MockSettings = {
              clientId: payload.twitch?.clientId ?? current.clientId,
              clientSecret: payload.twitch?.clientSecret ?? current.clientSecret,
              language: payload.language ?? current.language,
            };
            localStorage.setItem(TWITCH_STORAGE_KEY, JSON.stringify(next));
          } catch {
            void 0;
          }
        }
        this.respond(request, { ok: true });
        break;
      }
      case Channels.ChatOverlayGetState:
        this.respond(request, structuredClone(this.chatOverlaySettings));
        break;
      case Channels.ChatOverlaySaveSettings:
        this.chatOverlaySettings = request.payload as ChatOverlaySettings;
        localStorage.setItem(CHAT_OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify(this.chatOverlaySettings));
        this.respond(request, { ok: true });
        break;
      case Channels.ChatOverlayGetUrl:
        this.respond(request, { url: CHAT_OVERLAY_URL });
        break;
      case 'openrouter/get-state':
        this.respond(request, { configured: false, groqConfigured: false });
        break;
      case 'openrouter/save': {
        const payload = request.payload as { apiKey?: string | null };
        this.respond(request, { ok: true, configured: Boolean(payload?.apiKey?.trim()) });
        break;
      }
      case 'log/append':
        this.respond(request, { ok: true });
        break;
      default:
        this.respond(request, undefined, `UNKNOWN CHANNEL: ${request.channel}`);
    }
  }

  private respond(request: RpcEnvelope, payload: unknown, error?: string): void {
    this.emit({
      v: PROTOCOL_VERSION,
      id: request.id,
      kind: 'response',
      channel: request.channel,
      payload,
      error,
    });
  }

  private emitEvent(channel: string, payload: unknown): void {
    this.emit({ v: PROTOCOL_VERSION, id: crypto.randomUUID(), kind: 'event', channel, payload });
  }

  private status(): ConnectionStatus {
    return {
      coreConnected: true,
      coreVersion: '1.0.0-mock',
      twitchConnected: this.twitchConnected,
      twitchChannel: this.twitchConnected ? 'mock_channel' : '',
      authRequired: false,
    };
  }

  private loadChatOverlaySettings(): ChatOverlaySettings {
    try {
      const raw = localStorage.getItem(CHAT_OVERLAY_SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_CHAT_OVERLAY_SETTINGS, ...JSON.parse(raw) } as ChatOverlaySettings;
    } catch {
      void 0;
    }
    return { ...DEFAULT_CHAT_OVERLAY_SETTINGS };
  }

  private loadKeybinds(): ActionKeybind[] {
    try {
      const raw = localStorage.getItem(KEYBIND_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ActionKeybind[]) : [];
    } catch {
      return [];
    }
  }

  private loadAutoReplies(): AutoReply[] {
    try {
      const raw = localStorage.getItem(AUTO_REPLY_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AutoReply[]) : [];
    } catch {
      return [];
    }
  }

  private persistAutoReplies(): void {
    try {
      localStorage.setItem(AUTO_REPLY_STORAGE_KEY, JSON.stringify(this.autoReplies));
    } catch {
      void 0;
    }
  }

  private emitStatus(): void {
    this.emitEvent(Events.CoreStatusChanged, this.status());
  }

  private twitchBlip(): void {
    this.twitchConnected = false;
    this.emitStatus();
    this.schedule(() => {
      this.twitchConnected = true;
      this.emitStatus();
    }, 5000);
    this.schedule(() => this.twitchBlip(), 90000);
  }

  private loadCounters(): Counter[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Counter[];
    } catch {
      void 0;
    }
    const migrated = migrateLegacyCounters();
    if (migrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        void 0;
      }
      return migrated;
    }
    return [];
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.counters));
    } catch {
      void 0;
    }
  }

  private loadSettings(): MockSettings {
    try {
      const raw = localStorage.getItem(TWITCH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MockSettings>;
        return {
          clientId: parsed.clientId ?? '',
          clientSecret: parsed.clientSecret ?? '',
          language: parsed.language ?? '',
        };
      }
    } catch {
      void 0;
    }
    const legacy = this.loadLegacyTwitch();
    return { clientId: legacy.clientId, clientSecret: legacy.clientSecret, language: '' };
  }

  private loadAutoReplySettings(): AutoReplySettings {
    try {
      const raw = localStorage.getItem(AUTO_REPLY_SETTINGS_STORAGE_KEY);
      if (raw) return { globalAiCooldownSeconds: 0, globalAiUserCooldownSeconds: 60, ...JSON.parse(raw) };
    } catch {
      void 0;
    }
    return { globalAiCooldownSeconds: 0, globalAiUserCooldownSeconds: 60 };
  }

  private loadLegacyTwitch(): TwitchSettings {
    try {
      const raw = localStorage.getItem('streamer-hub-mock-twitch');
      if (raw) return JSON.parse(raw) as TwitchSettings;
    } catch {
      void 0;
    }
    return { clientId: '', clientSecret: '' };
  }

  private latency(): number {
    return 25 + Math.random() * 60;
  }

  private schedule(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }
}

export class MockTransport implements Transport {
  constructor(private readonly host: MockHost) {}

  postMessage(message: RpcEnvelope): void {
    this.host.handleEnvelope(message);
  }

  onMessage(handler: (message: RpcEnvelope) => void): () => void {
    return this.host.onMessage(handler);
  }
}
