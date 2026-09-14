import type { ActionKeybind, AutoReply, AutoReplySettings, ChannelPointsRedemption, ChatMessage, ChatOverlaySettings, CommandSequence, ConnectionStatus, Counter, RpcEnvelope, TwitchRewardInfo, TwitchSettings } from './contracts';
import { Channels, Events, PROTOCOL_VERSION } from './contracts';
import type { Transport } from './transport';
import { createDefaultChatOverlaySettings } from '../lib/chatOverlay';

const STORAGE_KEY = 'streamer-hub-mock-counters';
const LEGACY_STORAGE_KEY = 'streamer-hub-mock-state';
const TWITCH_STORAGE_KEY = 'streamer-hub-mock-settings';
const AUTO_REPLY_STORAGE_KEY = 'streamer-hub-mock-auto-replies';
const SEQUENCES_STORAGE_KEY = 'streamer-hub-mock-sequences';
const KEYBIND_STORAGE_KEY = 'streamer-hub-mock-keybinds';
const AUTO_REPLY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-auto-reply-settings';
const CHAT_OVERLAY_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-chat-overlay-settings';
const OBS_CHAT_SETTINGS_STORAGE_KEY = 'streamer-hub-mock-obs-chat-settings';
const CHAT_OVERLAY_URL = 'http://127.0.0.1:49178/chat-overlay.html';
const OBS_CHAT_DOCK_URL = 'http://127.0.0.1:49178/obs-chat.html';
const DEFAULT_CHAT_OVERLAY_SETTINGS: ChatOverlaySettings = createDefaultChatOverlaySettings();

interface MockSettings {
  clientId: string;
  clientSecret: string;
  language: string;
  botAccountEnabled?: boolean;
  preferredChatSender?: 'bot' | 'broadcaster';
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
  private sequences: CommandSequence[];
  private keybinds: ActionKeybind[];
  private chatOverlaySettings: ChatOverlaySettings;
  private obsChatSettings: ChatOverlaySettings;
  private readonly listeners = new Set<(message: RpcEnvelope) => void>();
  private isMaximized = false;
  private twitchConnected = true;
  private streamTitle = 'Chill Gaming Stream';
  private readonly timers: number[] = [];

  constructor(options: { twitchConnected?: boolean } = {}) {
    this.counters = this.loadCounters();
    this.autoReplies = this.loadAutoReplies();
    this.sequences = this.loadSequences();
    this.autoReplySettings = this.loadAutoReplySettings();
    this.keybinds = this.loadKeybinds();
    this.chatOverlaySettings = this.loadChatOverlaySettings();
    this.obsChatSettings = this.loadObsChatSettings();
    if (options.twitchConnected !== undefined) {
      this.twitchConnected = options.twitchConnected;
    }
    this.schedule(() => this.emitStatus(), 350);
    this.schedule(() => this.twitchBlip(), 90000);
  }

  simulateChat(message: { username: string; message: string; avatarUrl?: string }): void {
    const letter = (message.username[0] || '?').toUpperCase();
    const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="mock_${letter}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#mock_${letter})"/><text x="50" y="54" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="44" fill="#ffffff">${letter}</text></svg>`)}`;

    this.emitEvent(Events.TwitchChatMessage, {
      id: crypto.randomUUID(),
      username: message.username,
      userId: `mock-${message.username}`,
      avatarUrl: message.avatarUrl || defaultAvatar,
      isBroadcaster: message.username === 'streamer',
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: message.message,
      timestamp: new Date().toISOString(),
    });
  }

  simulateRedemption(redemption: Partial<ChannelPointsRedemption>): void {
    this.emitEvent(Events.TwitchChannelPointsRedeemed, {
      id: redemption.id || crypto.randomUUID(),
      rewardId: redemption.rewardId || 'mock-reward-hydrate',
      rewardTitle: redemption.rewardTitle || 'Hydrate',
      rewardCost: redemption.rewardCost ?? 250,
      userId: redemption.userId || 'mock-viewer-1',
      userName: redemption.userName || 'viewer',
      userLogin: redemption.userLogin || 'viewer',
      userInput: redemption.userInput,
      redeemedAt: redemption.redeemedAt || new Date().toISOString(),
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
      case 'window/begin-resize':
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
      case Channels.SequencesGetState:
        this.respond(request, structuredClone(this.sequences));
        break;
      case Channels.SequencesSave: {
        const payload = request.payload as { sequence?: CommandSequence };
        if (payload?.sequence) {
          const seq = payload.sequence;
          const idx = this.sequences.findIndex((s) => s.id === seq.id);
          if (idx >= 0) this.sequences[idx] = seq;
          else this.sequences.push(seq);
          this.persistSequences();
        }
        this.respond(request, { ok: true });
        break;
      }
      case Channels.SequencesDelete: {
        const payload = request.payload as { sequenceId?: string };
        if (payload?.sequenceId) {
          this.sequences = this.sequences.filter((s) => s.id !== payload.sequenceId);
          this.persistSequences();
        }
        this.respond(request, { ok: true });
        break;
      }
      case Channels.TwitchChannelPointsGetRewards:
        this.respond(request, {
          ok: true,
          rewards: [
            { id: 'mock-reward-hydrate', title: 'Hydrate', cost: 250, prompt: 'Remind the streamer to drink water', userInputRequired: false },
            { id: 'mock-reward-stretch', title: 'Stretch Break', cost: 500, prompt: 'Time to stand up and stretch', userInputRequired: false },
            { id: 'mock-reward-shoutout', title: 'VIP Shoutout', cost: 1000, prompt: 'Shoutout your channel', userInputRequired: true },
          ] as TwitchRewardInfo[],
        });
        break;
      case Channels.TwitchModerationCheckMod: {
        const payload = request.payload as { target?: string };
        const isMod = payload?.target?.toLowerCase().includes('mod') ?? true;
        this.respond(request, { ok: true, isMod });
        break;
      }
      case Channels.TwitchModerationTimeout: {
        this.respond(request, { ok: true });
        break;
      }
      case Channels.TwitchModerationSmartTimeout: {
        const payload = request.payload as { target?: string; durationSeconds?: number };
        const clean = (payload?.target ?? '').replace(/^[@#!]+/, '');
        this.respond(request, { ok: true, wasMod: true, target: clean });
        break;
      }
      case Channels.TwitchModerationBan:
      case Channels.TwitchModerationUnban:
      case Channels.TwitchModerationMod:
      case Channels.TwitchModerationUnmod:
      case Channels.TwitchModerationVip:
      case Channels.TwitchModerationUnvip:
      case Channels.TwitchModerationClear:
      case Channels.TwitchModerationShoutout: {
        this.respond(request, { ok: true });
        break;
      }
      case 'auto-replies/generate': {
        const payload = request.payload as { message?: { username?: string; message?: string } } | undefined;
        this.respond(request, {
          ok: true,
          message: `Mock AI reply for @${payload?.message?.username || 'viewer'}!`,
          usedFallback: false,
        });
        break;
      }
      case 'twitch/get-title':
        this.respond(request, { ok: true, title: this.streamTitle });
        break;
      case 'twitch/update-title': {
        const payload = request.payload as { title?: string };
        if (payload?.title) {
          this.streamTitle = payload.title;
          this.emitEvent(Events.TwitchTitleChanged, { title: payload.title });
        }
        this.respond(request, { ok: true });
        break;
      }
      case Channels.TwitchGetTitleFilePath:
      case 'twitch/get-title-file-path':
        this.respond(request, { path: 'C:\\StreamerHub\\title.txt' });
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
      case 'twitch/bot-authorize':
        this.respond(request, { ok: true });
        break;
      case 'twitch/bot-forget':
        this.respond(request, { ok: true });
        break;
      case Channels.TwitchSendChatMessage: {
        const st = this.status();
        this.respond(request, {
          ok: this.twitchConnected,
          senderRole: st.activeChatSender,
          senderLogin: st.activeChatSenderLogin,
        });
        break;
      }
      case 'settings/get-state': {
        const settings = this.loadSettings();
        this.respond(request, {
          twitch: { clientId: settings.clientId, clientSecret: settings.clientSecret },
          language: settings.language,
          botAccountEnabled: settings.botAccountEnabled ?? false,
          preferredChatSender: settings.preferredChatSender ?? 'bot',
          closeToTray: true,
        });
        break;
      }
      case 'settings/save': {
        const payload = request.payload as {
          twitch?: TwitchSettings;
          language?: string;
          botAccountEnabled?: boolean;
          preferredChatSender?: 'bot' | 'broadcaster';
          closeToTray?: boolean;
        };
        if (payload) {
          try {
            const current = this.loadSettings();
            const next: MockSettings = {
              clientId: payload.twitch?.clientId ?? current.clientId,
              clientSecret: payload.twitch?.clientSecret ?? current.clientSecret,
              language: payload.language ?? current.language,
              botAccountEnabled: payload.botAccountEnabled ?? current.botAccountEnabled,
              preferredChatSender: payload.preferredChatSender ?? current.preferredChatSender,
            };
            localStorage.setItem(TWITCH_STORAGE_KEY, JSON.stringify(next));
            this.emitStatus();
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
        this.respond(request, { url: CHAT_OVERLAY_URL, dockUrl: OBS_CHAT_DOCK_URL });
        break;
      case Channels.ChatOverlayReload:
      case 'chat-overlay/reload':
        this.respond(request, { ok: true });
        break;
      case Channels.ChatOverlaySetPreview:
      case 'chat-overlay/set-preview':
        this.respond(request, { ok: true });
        break;
      case Channels.ObsChatGetState:
        this.respond(request, structuredClone(this.obsChatSettings));
        break;
      case Channels.ObsChatSaveSettings:
        this.obsChatSettings = request.payload as ChatOverlaySettings;
        localStorage.setItem(OBS_CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(this.obsChatSettings));
        this.respond(request, { ok: true });
        break;
      case Channels.ObsChatGetUrl:
        this.respond(request, { url: OBS_CHAT_DOCK_URL });
        break;
      case Channels.ObsChatReload:
      case 'obs-chat/reload':
        this.respond(request, { ok: true });
        break;
      case Channels.ObsChatSetPreview:
      case 'obs-chat/set-preview':
        this.respond(request, { ok: true });
        break;
      case Channels.SystemListFonts:
        this.respond(request, { fonts: ['Arial', 'Cairo', 'Inter', 'Segoe UI', 'Times New Roman'] });
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
      case Channels.UpdateCheck:
        this.respond(request, {
          currentVersion: '0.2.9',
          latestVersion: '0.2.9',
          updateAvailable: false,
          releaseUrl: 'https://github.com/Zeen1th/streamer-hub/releases/latest',
          downloadUrl: 'https://github.com/Zeen1th/streamer-hub/releases/download/v0.2.9/StreamerHub-Setup-v0.2.9.exe',
          releaseNotes: 'The current release is installed.',
        });
        break;
      case Channels.TwitchCheckAvatar: {
        const payload = request.payload as { username?: string; userId?: string } | undefined;
        const target = (payload?.username || payload?.userId || 'streamer').trim();
        const letter = (target[0] || '?').toUpperCase();
        const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="mock_av" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#mock_av)"/><text x="50" y="54" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="44" fill="#ffffff">${letter}</text></svg>`;
        const avatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg)}`;
        const userId = payload?.userId || 'mock-user-1';
        this.emitEvent(Events.TwitchUserProfile, { userId, avatarUrl });
        this.respond(request, {
          ok: true,
          userId,
          username: target.toLowerCase(),
          displayName: target,
          avatarUrl,
        });
        break;
      }
      case Channels.ChatOverlayTestMessage: {
        const payload = request.payload as Partial<ChatMessage> | undefined;
        if (payload && payload.username) {
          const letter = (payload.username[0] || '?').toUpperCase();
          const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="mock_t" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#be123c"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#mock_t)"/><text x="50" y="54" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="44" fill="#ffffff">${letter}</text></svg>`)}`;
          this.emitEvent(Events.TwitchChatMessage, {
            id: payload.id || crypto.randomUUID(),
            username: payload.username,
            userId: payload.userId || 'mock-user',
            avatarUrl: payload.avatarUrl || defaultAvatar,
            isBroadcaster: payload.isBroadcaster ?? false,
            isMod: payload.isMod ?? false,
            isVip: payload.isVip ?? false,
            isSubscriber: payload.isSubscriber ?? false,
            message: payload.message || '',
            emotes: payload.emotes || [],
            color: payload.color || '',
            timestamp: payload.timestamp || new Date().toISOString(),
          });
        }
        this.respond(request, { ok: true });
        break;
      }
      case Channels.UpdateInstall:
        this.respond(request, { ok: true });
        break;
      case Channels.TwitchModerationSmartTimeout:
      case Channels.TwitchModerationTimeout:
      case Channels.TwitchModerationBan:
      case Channels.TwitchModerationUnban:
      case Channels.TwitchModerationMod:
      case Channels.TwitchModerationUnmod:
      case Channels.TwitchModerationVip:
      case Channels.TwitchModerationUnvip:
      case Channels.TwitchModerationClear:
      case Channels.TwitchModerationShoutout:
        this.respond(request, { ok: true, wasMod: false });
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
    const settings = this.loadSettings();
    const botEnabled = settings.botAccountEnabled ?? false;
    const botConnected = botEnabled && this.twitchConnected;
    const preferredSender = settings.preferredChatSender ?? 'bot';
    const activeSender = preferredSender === 'bot' && botConnected ? 'bot' : 'broadcaster';
    return {
      coreConnected: true,
      coreVersion: '1.0.0-mock',
      twitchConnected: this.twitchConnected,
      twitchChannel: this.twitchConnected ? 'mock_channel' : '',
      authRequired: false,
      botAccountEnabled: botEnabled,
      botConnected,
      botLogin: botConnected ? 'mock_bot' : '',
      preferredChatSender: preferredSender,
      activeChatSender: activeSender,
      activeChatSenderLogin: activeSender === 'bot' ? 'mock_bot' : (this.twitchConnected ? 'mock_channel' : ''),
    };
  }

  private loadChatOverlaySettings(): ChatOverlaySettings {
    try {
      const raw = localStorage.getItem(CHAT_OVERLAY_SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ChatOverlaySettings;
    } catch {
      void 0;
    }
    return { ...DEFAULT_CHAT_OVERLAY_SETTINGS };
  }

  private loadObsChatSettings(): ChatOverlaySettings {
    try {
      const raw = localStorage.getItem(OBS_CHAT_SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ChatOverlaySettings;
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

  private loadSequences(): CommandSequence[] {
    try {
      const raw = localStorage.getItem(SEQUENCES_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CommandSequence[];
    } catch {
      return [];
    }
    return [
      {
        id: 'seq-default-hydrate',
        enabled: true,
        name: 'Hydrate Stack',
        triggerType: 'both',
        rewardTitle: 'Hydrate',
        rewardId: 'mock-reward-hydrate',
        chatTrigger: '!hydrate',
        cooldownSeconds: 15,
        steps: [
          {
            id: 'step-1',
            type: 'chat',
            chatMessage: '🥤 Hydrate alert! Drink some water, {username}!',
          },
          {
            id: 'step-2',
            type: 'wait',
            waitDuration: 3,
            waitUnit: 'seconds',
          },
          {
            id: 'step-3',
            type: 'chat',
            chatMessage: '💧 Refreshed! Thanks {username} for the reminder!',
          },
        ],
      },
    ];
  }

  private persistSequences(): void {
    try {
      localStorage.setItem(SEQUENCES_STORAGE_KEY, JSON.stringify(this.sequences));
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
          botAccountEnabled: parsed.botAccountEnabled ?? false,
          preferredChatSender: parsed.preferredChatSender ?? 'bot',
        };
      }
    } catch {
      void 0;
    }
    const legacy = this.loadLegacyTwitch();
    return {
      clientId: legacy.clientId,
      clientSecret: legacy.clientSecret,
      language: '',
      botAccountEnabled: false,
      preferredChatSender: 'bot',
    };
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
