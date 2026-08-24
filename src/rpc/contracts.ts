export const PROTOCOL_VERSION = 1;

export interface RpcEnvelope {
  v: number;
  id: string;
  kind: 'request' | 'response' | 'event';
  channel: string;
  payload?: unknown;
  error?: string;
}

export type PermissionLevel = 'everyone' | 'subscriber' | 'vip' | 'mod' | 'broadcaster';

export type CounterAction = 'increase' | 'decrease' | 'reset';

export interface CounterCommandConfig {
  commandName: string;
  permission: PermissionLevel;
  cooldownSeconds: number;
}

export interface CounterConfig {
  increase: CounterCommandConfig;
  decrease: CounterCommandConfig;
  reset: CounterCommandConfig;
}

export interface Counter {
  id: string;
  name: string;
  count: number;
  commands: CounterConfig;
  obs: ObsOutputConfig;
}

export interface ObsOutputConfig {
  enabled: boolean;
  filePath: string;
  template: string;
}

export interface TwitchSettings {
  clientId: string;
  clientSecret: string;
}

export interface AutoReply {
  id: string;
  triggers: string[];
  response: string;
  enabled: boolean;
  cooldownSeconds: number;
  userCooldownSeconds?: number;
  titleActionEnabled?: boolean;
  titleTemplate?: string;
  titleStart?: number;
  titleCount?: number;
  titleCounters?: TitleCounter[];
  minimumRank?: PermissionLevel;
  aiUserCooldownSeconds?: number;
  matchMode: 'exact' | 'startsWith' | 'contains' | 'regex';
  responseMode?: 'static' | 'ai';
  aiInstructions?: string;
  aiModel?: string;
  aiProvider?: 'openrouter' | 'groq';
  aiMaxTokens?: number;
  aiFallback?: string;
}

export interface TitleCounter {
  id: string;
  start: number;
  count: number;
}

export interface AutoReplySettings {
  globalAiCooldownSeconds: number;
  globalAiUserCooldownSeconds: number;
}

export interface OpenRouterSettingsState {
  configured: boolean;
  groqConfigured: boolean;
}

export interface UpdateState {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  isBroadcaster: boolean;
  isMod: boolean;
  isVip: boolean;
  isSubscriber: boolean;
  message: string;
  timestamp: string;
}

export interface ConnectionStatus {
  coreConnected: boolean;
  coreVersion: string;
  twitchConnected: boolean;
  twitchChannel: string;
  authRequired?: boolean;
  botAccountEnabled?: boolean;
  startupEnabled?: boolean;
  botConnected?: boolean;
  botLogin?: string;
}

export type LogKind =
  | 'chat'
  | 'trigger'
  | 'cooldown-denied'
  | 'permission-denied'
  | 'manual'
  | 'reset'
  | 'system'
  | 'obs-ok'
  | 'obs-error';

export interface LogPayload {
  id: string;
  timestamp: string;
  kind: LogKind;
  message: string;
  username?: string;
  count?: number;
}

export const Channels = {
  WindowMinimize: 'window/minimize',
  WindowMaximizeToggle: 'window/maximize-toggle',
  WindowClose: 'window/close',
  WindowIsMaximized: 'window/is-maximized',
  CoreGetStatus: 'core/get-status',
  CountersGetState: 'counters/get-state',
  CountersSetCount: 'counters/set-count',
  CountersSave: 'counters/save',
  CountersDelete: 'counters/delete',
  ObsWrite: 'obs/write',
  DialogSaveFile: 'dialog/save-file',
  LogAppend: 'log/append',
  TwitchAuthorize: 'twitch/authorize',
  TwitchForget: 'twitch/forget',
  TwitchBotAuthorize: 'twitch/bot-authorize',
  TwitchBotForget: 'twitch/bot-forget',
  SettingsGetState: 'settings/get-state',
  SettingsSave: 'settings/save',
  OpenRouterGetState: 'openrouter/get-state',
  OpenRouterSave: 'openrouter/save',
  AutoRepliesGenerate: 'auto-replies/generate',
  WindowBeginDrag: 'window/begin-drag',
  AutoRepliesGetState: 'auto-replies/get-state',
  AutoRepliesSettingsGet: 'auto-replies/settings-get',
  AutoRepliesSettingsSave: 'auto-replies/settings-save',
  AutoRepliesSave: 'auto-replies/save',
  AutoRepliesDelete: 'auto-replies/delete',
  TwitchSendChatMessage: 'twitch/send-chat-message',
  TwitchUpdateTitle: 'twitch/update-title',
  UpdateCheck: 'update/check',
  UpdateInstall: 'update/install',
} as const;

export type ChannelName = (typeof Channels)[keyof typeof Channels];

export const Events = {
  CoreStatusChanged: 'core/status-changed',
  TwitchChatMessage: 'twitch/chat-message',
  WindowMaximizedChanged: 'window/maximized-changed',
  CoreLog: 'core/log',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface HostApi {
  [Channels.WindowMinimize]: { request: undefined; response: void };
  [Channels.WindowMaximizeToggle]: { request: undefined; response: { isMaximized: boolean } };
  [Channels.WindowClose]: { request: undefined; response: void };
  [Channels.WindowIsMaximized]: { request: undefined; response: { isMaximized: boolean } };
  [Channels.CoreGetStatus]: { request: undefined; response: ConnectionStatus };
  [Channels.CountersGetState]: { request: undefined; response: Counter[] };
  [Channels.CountersSetCount]: {
    request: { counterId: string; count: number; source: 'manual' | 'chat' };
    response: { ok: boolean; count: number };
  };
  [Channels.CountersSave]: { request: { counter: Counter }; response: { ok: boolean } };
  [Channels.CountersDelete]: { request: { counterId: string }; response: { ok: boolean } };
  [Channels.ObsWrite]: {
    request: { filePath: string; content: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.DialogSaveFile]: { request: { defaultName: string }; response: { path: string | null } };
  [Channels.LogAppend]: { request: LogPayload; response: { ok: boolean } };
  [Channels.TwitchAuthorize]: { request: undefined; response: { ok: boolean } };
  [Channels.TwitchForget]: { request: undefined; response: { ok: boolean } };
  [Channels.TwitchBotAuthorize]: { request: undefined; response: { ok: boolean } };
  [Channels.TwitchBotForget]: { request: undefined; response: { ok: boolean } };
  [Channels.SettingsGetState]: { request: undefined; response: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean } };
  [Channels.SettingsSave]: {
    request: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean };
    response: { ok: boolean };
  };
  [Channels.OpenRouterGetState]: { request: undefined; response: OpenRouterSettingsState };
  [Channels.OpenRouterSave]: { request: { provider: 'openrouter' | 'groq'; apiKey: string | null }; response: { ok: boolean; configured: boolean } };
  [Channels.WindowBeginDrag]: { request: undefined; response: { ok: boolean } };
  [Channels.AutoRepliesGetState]: { request: undefined; response: AutoReply[] };
  [Channels.AutoRepliesSettingsGet]: { request: undefined; response: AutoReplySettings };
  [Channels.AutoRepliesSettingsSave]: { request: AutoReplySettings; response: { ok: boolean } };
  [Channels.AutoRepliesSave]: { request: { rule: AutoReply }; response: { ok: boolean } };
  [Channels.AutoRepliesDelete]: { request: { ruleId: string }; response: { ok: boolean } };
  [Channels.AutoRepliesGenerate]: { request: { ruleId: string; message: ChatMessage; send?: boolean }; response: { ok: boolean; message?: string; usedFallback?: boolean; error?: string } };
  [Channels.TwitchSendChatMessage]: { request: { message: string }; response: { ok: boolean; error?: string } };
  [Channels.TwitchUpdateTitle]: { request: { title: string }; response: { ok: boolean; error?: string } };
  [Channels.UpdateCheck]: { request: undefined; response: UpdateState };
  [Channels.UpdateInstall]: { request: { downloadUrl: string }; response: { ok: boolean; error?: string } };
}

export interface EventMap {
  [Events.CoreStatusChanged]: ConnectionStatus;
  [Events.TwitchChatMessage]: ChatMessage;
  [Events.WindowMaximizedChanged]: { isMaximized: boolean };
  [Events.CoreLog]: { message: string };
}

