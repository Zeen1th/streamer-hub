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

export type WindowResizeEdge = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

export type KeybindModifier = 'ctrl' | 'alt' | 'shift' | 'meta';
export type KeybindTargetType = 'counter' | 'title';
export type KeybindAction = CounterAction | 'apply';

export interface KeybindChord {
  key: string;
  modifier?: KeybindModifier;
}

export interface ActionKeybind {
  id: string;
  enabled: boolean;
  targetType: KeybindTargetType;
  targetId: string;
  action: KeybindAction;
  chord: KeybindChord;
}

export interface KeybindRegistration {
  bindingId: string;
  status: 'registered' | 'disabled' | 'conflict' | 'unsupported' | 'orphaned';
  error?: string;
}

export interface KeybindState {
  bindings: ActionKeybind[];
  registrations: KeybindRegistration[];
}

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
  titleEnabled?: boolean;
  titleTemplate?: string;
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
  responseEnabled?: boolean;
  cooldownSeconds: number;
  userCooldownSeconds?: number;
  titleActionEnabled?: boolean;
  titleTemplate?: string;
  titleStart?: number;
  titleCount?: number;
  titleIncreaseCommand?: string;
  titleDecreaseCommand?: string;
  themeActionEnabled?: boolean;
  themeActionMode?: 'light' | 'dark';
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

export type ChatOverlayDisplayMode = 'stacked' | 'latest';
export type ChatOverlayTheme = 'light' | 'dark' | 'transparent' | 'neon' | 'ember';
export type ChatOverlayMessageStyle = 'rounded' | 'square';
export type ChatOverlayAnimation = 'slide' | 'fade' | 'pop' | 'glow' | 'flip' | 'off';
export type ChatOverlayFontFamily = 'barlow' | 'cairo' | 'cinzel' | 'jetbrains-mono' | 'system';
export type ChatOverlayAvatarShape = 'circle' | 'rounded' | 'square' | 'squircle';
export type ChatOverlayAlignment = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export type ChatOverlayAvatarPosition = 'left' | 'right';
export type ChatOverlayIdentityDirection = 'ltr' | 'rtl';

/** The reference coordinate space the overlay is designed in. */
export const CHAT_OVERLAY_CANVAS = { width: 1920, height: 1080 } as const;

export type ChatOverlayFlowDirection = 'up' | 'down';
export type ChatOverlayShadow = 'off' | 'soft' | 'hard';
export type ChatOverlayColorMode = 'role' | 'custom';
export type ChatOverlayUsernameColorMode = 'role' | 'twitch' | 'custom';
export type ChatOverlayTextTransform = 'none' | 'uppercase' | 'lowercase';
export type ChatOverlayUsernamePosition = 'above' | 'inline';
export type ChatOverlayWrapMode = 'normal' | 'break-anywhere' | 'clip';
export type ChatOverlayBadgeStyle = 'text' | 'icon';
export type ChatOverlayBlockedWordAction = 'drop' | 'mask';

export interface ChatOverlayFontChoice {
  family: ChatOverlayFontFamily | 'custom';
  /** Only meaningful when `family` is 'custom'. Passed through to CSS font-family. */
  customName: string;
}

export interface ChatOverlayBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: ChatOverlayAlignment;
}

export interface ChatOverlayFlow {
  maxMessages: number;
  /** 0 means messages never expire. Otherwise 3..600. */
  durationSeconds: number;
  displayMode: ChatOverlayDisplayMode;
  direction: ChatOverlayFlowDirection;
  gap: number;
  /** Percent. Multiplies every pixel dimension before it reaches CSS. */
  sizeScale: number;
}

export interface ChatOverlayBubble {
  background: { color: string; alpha: number };
  border: { width: number; color: string; radius: number };
  padding: { x: number; y: number };
  shadow: ChatOverlayShadow;
  shadowColor: string;
  /** Backdrop blur in px. 0 disables the filter entirely. */
  blur: number;
  accent: { width: number; colorMode: ChatOverlayColorMode; color: string };
}

export interface ChatOverlayUsernameStyle {
  show: boolean;
  font: ChatOverlayFontChoice;
  size: number;
  weight: number;
  letterSpacing: number;
  colorMode: ChatOverlayUsernameColorMode;
  color: string;
  transform: ChatOverlayTextTransform;
  position: ChatOverlayUsernamePosition;
}

export interface ChatOverlayTextStyle {
  font: ChatOverlayFontChoice;
  size: number;
  weight: number;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  shadow: boolean;
  wrapMode: ChatOverlayWrapMode;
  /** 0 fills the block width. */
  maxWidth: number;
}

export interface ChatOverlayIdentityStyle {
  direction: ChatOverlayIdentityDirection;
}

export interface ChatOverlayAvatarStyle {
  show: boolean;
  size: number;
  shape: ChatOverlayAvatarShape;
  position: ChatOverlayAvatarPosition;
  borderWidth: number;
  borderColorMode: ChatOverlayColorMode;
  borderColor: string;
}

export interface ChatOverlayBadgeStyleSettings {
  show: boolean;
  style: ChatOverlayBadgeStyle;
  size: number;
}

export interface ChatOverlayEmoteSettings {
  twitch: boolean;
  bttv: boolean;
  ffz: boolean;
  sevenTv: boolean;
  /** Percent, relative to text size. */
  sizeScale: number;
  /** Percent, extra scale applied when a message contains only emotes. */
  emoteOnlyScale: number;
}

export interface ChatOverlayFilterSettings {
  blockedUsernames: string[];
  hideCommands: boolean;
  hideBots: boolean;
  botList: string[];
  blockedWords: string[];
  blockedWordAction: ChatOverlayBlockedWordAction;
  /** 0 disables the check. */
  minLength: number;
}

export interface ChatOverlayAnimationSettings {
  kind: ChatOverlayAnimation;
  durationMs: number;
}

export interface ChatOverlaySettings {
  version: 2;
  enabled: boolean;
  block: ChatOverlayBlock;
  flow: ChatOverlayFlow;
  bubble: ChatOverlayBubble;
  username: ChatOverlayUsernameStyle;
  text: ChatOverlayTextStyle;
  identity: ChatOverlayIdentityStyle;
  avatar: ChatOverlayAvatarStyle;
  badges: ChatOverlayBadgeStyleSettings;
  emotes: ChatOverlayEmoteSettings;
  filters: ChatOverlayFilterSettings;
  animation: ChatOverlayAnimationSettings;
}

export interface UpdateState {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

/**
 * A Twitch emote occurrence from the IRC `emotes` tag.
 * `start` and `end` are INCLUSIVE code-point offsets into the message, not
 * UTF-16 code-unit offsets. Slicing must iterate `[...text]`.
 */
export interface EmoteRange {
  id: string;
  start: number;
  end: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  userId?: string;
  avatarUrl?: string;
  isBroadcaster: boolean;
  isMod: boolean;
  isVip: boolean;
  isSubscriber: boolean;
  message: string;
  timestamp: string;
  /** From the IRC `emotes` tag. Absent or empty when the message has none. */
  emotes?: EmoteRange[];
  /** From the IRC `color` tag. Absent when the user has not set one. */
  color?: string;
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
  KeybindsGetState: 'keybinds/get-state',
  KeybindsSave: 'keybinds/save',
  ObsWrite: 'obs/write',
  DialogSaveFile: 'dialog/save-file',
  LogAppend: 'log/append',
  TwitchAuthorize: 'twitch/authorize',
  TwitchForget: 'twitch/forget',
  TwitchBotAuthorize: 'twitch/bot-authorize',
  TwitchBotForget: 'twitch/bot-forget',
  SettingsGetState: 'settings/get-state',
  SettingsSave: 'settings/save',
  ChatOverlayGetState: 'chat-overlay/get-state',
  ChatOverlaySaveSettings: 'chat-overlay/save-settings',
  ChatOverlayGetUrl: 'chat-overlay/get-url',
  SystemListFonts: 'system/list-fonts',
  OpenRouterGetState: 'openrouter/get-state',
  OpenRouterSave: 'openrouter/save',
  AutoRepliesGenerate: 'auto-replies/generate',
  WindowBeginDrag: 'window/begin-drag',
  WindowBeginResize: 'window/begin-resize',
  AutoRepliesGetState: 'auto-replies/get-state',
  AutoRepliesSettingsGet: 'auto-replies/settings-get',
  AutoRepliesSettingsSave: 'auto-replies/settings-save',
  AutoRepliesSave: 'auto-replies/save',
  AutoRepliesDelete: 'auto-replies/delete',
  TwitchSendChatMessage: 'twitch/send-chat-message',
  TwitchGetTitle: 'twitch/get-title',
  TwitchUpdateTitle: 'twitch/update-title',
  UpdateCheck: 'update/check',
  UpdateInstall: 'update/install',
} as const;

export type ChannelName = (typeof Channels)[keyof typeof Channels];

export const Events = {
  CoreStatusChanged: 'core/status-changed',
  TwitchChatMessage: 'twitch/chat-message',
  /** A profile resolved after its message was already published. */
  TwitchUserProfile: 'twitch/user-profile',
  /** A moderator deleted a message, timed out a user, or cleared chat. */
  TwitchChatCleared: 'twitch/chat-cleared',
  WindowMaximizedChanged: 'window/maximized-changed',
  CoreLog: 'core/log',
  KeybindTriggered: 'keybind/triggered',
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
    request: { counterId: string; count: number; source: 'manual' | 'chat' | 'keybind' };
    response: { ok: boolean; count: number };
  };
  [Channels.CountersSave]: { request: { counter: Counter }; response: { ok: boolean } };
  [Channels.CountersDelete]: { request: { counterId: string }; response: { ok: boolean } };
  [Channels.KeybindsGetState]: { request: undefined; response: KeybindState };
  [Channels.KeybindsSave]: { request: { bindings: ActionKeybind[] }; response: KeybindState };
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
  [Channels.SettingsGetState]: { request: undefined; response: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean; closeToTray?: boolean } };
  [Channels.SettingsSave]: {
    request: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; startupEnabled?: boolean; closeToTray?: boolean };
    response: { ok: boolean };
  };
  [Channels.ChatOverlayGetState]: { request: undefined; response: ChatOverlaySettings };
  [Channels.ChatOverlaySaveSettings]: { request: ChatOverlaySettings; response: { ok: boolean } };
  [Channels.ChatOverlayGetUrl]: { request: undefined; response: { url: string } };
  [Channels.SystemListFonts]: { request: undefined; response: { fonts: string[] } };
  [Channels.OpenRouterGetState]: { request: undefined; response: OpenRouterSettingsState };
  [Channels.OpenRouterSave]: { request: { provider: 'openrouter' | 'groq'; apiKey: string | null }; response: { ok: boolean; configured: boolean } };
  [Channels.WindowBeginDrag]: { request: undefined; response: { ok: boolean } };
  [Channels.WindowBeginResize]: { request: { edge: WindowResizeEdge }; response: { ok: boolean } };
  [Channels.AutoRepliesGetState]: { request: undefined; response: AutoReply[] };
  [Channels.AutoRepliesSettingsGet]: { request: undefined; response: AutoReplySettings };
  [Channels.AutoRepliesSettingsSave]: { request: AutoReplySettings; response: { ok: boolean } };
  [Channels.AutoRepliesSave]: { request: { rule: AutoReply }; response: { ok: boolean } };
  [Channels.AutoRepliesDelete]: { request: { ruleId: string }; response: { ok: boolean } };
  [Channels.AutoRepliesGenerate]: { request: { ruleId: string; message: ChatMessage; send?: boolean }; response: { ok: boolean; message?: string; usedFallback?: boolean; error?: string } };
  [Channels.TwitchSendChatMessage]: { request: { message: string }; response: { ok: boolean; error?: string } };
  [Channels.TwitchGetTitle]: { request: undefined; response: { ok: boolean; title?: string | null; error?: string } };
  [Channels.TwitchUpdateTitle]: { request: { title: string }; response: { ok: boolean; error?: string } };
  [Channels.UpdateCheck]: { request: undefined; response: UpdateState };
  [Channels.UpdateInstall]: { request: { downloadUrl: string }; response: { ok: boolean; error?: string } };
}

export interface EventMap {
  [Events.CoreStatusChanged]: ConnectionStatus;
  [Events.TwitchChatMessage]: ChatMessage;
  [Events.TwitchUserProfile]: { userId: string; avatarUrl: string; color?: string };
  [Events.TwitchChatCleared]: { scope: 'message' | 'user' | 'all'; id?: string };
  [Events.WindowMaximizedChanged]: { isMaximized: boolean };
  [Events.CoreLog]: { message: string };
  [Events.KeybindTriggered]: { bindingId: string };
}

