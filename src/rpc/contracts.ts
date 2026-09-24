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
  agentName?: string;
  agentRole?: string;
  agentContext?: string;
  aiModel?: string;
  aiProvider?: 'openrouter' | 'groq';
  aiMaxTokens?: number;
  aiFallback?: string;
  aiUserRestriction?: AiUserRestriction;
  aiTargetUsers?: string[];
  aiConditions?: AiConditionRule[];
  senderRole?: 'default' | 'bot' | 'broadcaster';
  aiWebSearch?: boolean;
  channelPointsRewardId?: string;
  channelPointsRewardTitle?: string;
}

export type AiUserRestriction = 'none' | 'allowlist' | 'blocklist';
export type AiConditionIfType = 'username' | 'role' | 'message_contains';
export type AiConditionThenType = 'instructions' | 'static_reply' | 'ignore';

export interface AiConditionRule {
  id: string;
  ifType: AiConditionIfType;
  ifValue: string;
  thenType: AiConditionThenType;
  thenValue: string;
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

export type ModerationAction =
  | 'smart_timeout'
  | 'timeout'
  | 'ban'
  | 'unban'
  | 'mod'
  | 'unmod'
  | 'vip'
  | 'unvip'
  | 'clear_chat'
  | 'shoutout';

export type SequenceStepType =
  | 'chat'
  | 'counter'
  | 'command'
  | 'wait'
  | 'moderation'
  | 'comment'
  | 'sound'
  | 'tts'
  | 'obs_text'
  | 'poll'
  | 'mic_mute';
export type SequenceWaitUnit = 'seconds' | 'minutes';
export type SequenceTriggerType = 'channel_points' | 'chat' | 'both';

export type ActionTriggerType = 'twitch_raid' | 'twitch_chat' | 'twitch_channel_points' | 'twitch_follow';

export interface ActionTrigger {
  id: string;
  type: ActionTriggerType;
  enabled: boolean;
  minViewers?: number;
  chatCommand?: string;
  matchMode?: 'exact' | 'startsWith' | 'contains';
  rewardId?: string;
  rewardTitle?: string;
}

export interface TwitchRaidEvent {
  fromUserId: string;
  fromUserName: string;
  fromUserLogin: string;
  viewers: number;
}

export interface TwitchFollowEvent {
  userId: string;
  userName: string;
  userLogin: string;
  followedAt: string;
}

export interface SequenceStep {
  id: string;
  type: SequenceStepType;
  waitDuration?: number;
  waitUnit?: SequenceWaitUnit;
  chatMessage?: string;
  counterId?: string;
  counterAction?: CounterAction;
  commandTrigger?: string;
  moderationAction?: ModerationAction;
  targetUser?: string;
  durationSeconds?: number;
  reason?: string;
  commentText?: string;

  // Sound Effect
  soundPath?: string;
  soundVolume?: number;

  // Text-To-Speech
  ttsText?: string;
  ttsVoice?: string;
  ttsRate?: number;
  ttsPitch?: number;
  ttsVolume?: number;

  // OBS Text Output
  filePath?: string;
  fileContent?: string;

  // Live Poll
  pollAction?: 'start' | 'end' | 'reset';
  pollQuestion?: string;
  pollOptions?: string[];
  pollDurationSeconds?: number;

  // Mute Mic
  micMuteDurationSeconds?: number;
}

export interface CommandSequence {
  id: string;
  enabled: boolean;
  name: string;
  triggerType?: SequenceTriggerType;
  rewardTitle?: string;
  rewardId?: string;
  chatTrigger?: string;
  cooldownSeconds: number;
  steps: SequenceStep[];
  triggers?: ActionTrigger[];
}

export interface ChannelPointsRedemption {
  id: string;
  rewardId: string;
  rewardTitle: string;
  rewardCost?: number;
  userId: string;
  userName: string;
  userLogin: string;
  userInput?: string;
  redeemedAt: string;
}

export interface TwitchRewardInfo {
  id: string;
  title: string;
  cost: number;
  prompt?: string;
  userInputRequired?: boolean;
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

export interface ChatOverlayInstance {
  id: string;
  name: string;
  isMain?: boolean;
  settings: ChatOverlaySettings;
}

export interface ChatOverlaysSavePayload {
  overlay: ChatOverlayInstance;
}

export interface ChatOverlaysDeletePayload {
  id: string;
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
  displayName?: string;
  userLogin?: string;
  userId?: string;
  avatarUrl?: string;
  isBroadcaster: boolean;
  isMod: boolean;
  isLeadMod?: boolean;
  isVip: boolean;
  isSubscriber: boolean;
  message: string;
  timestamp: string;
  /** From the IRC `emotes` tag. Absent or empty when the message has none. */
  emotes?: EmoteRange[];
  /** From the IRC `color` tag. Absent when the user has not set one. */
  color?: string;
  /** From the IRC `custom-reward-id` tag when redeemed via Channel Points */
  customRewardId?: string;
  isSelf?: boolean;
}

export type ChatSenderRole = 'bot' | 'broadcaster';

export type ChatClearScope = 'message' | 'user' | 'all';

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
  preferredChatSender?: ChatSenderRole;
  activeChatSender?: ChatSenderRole;
  activeChatSenderLogin?: string;
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

export interface VoteOption {
  id: string;
  key: string;
  label: string;
  votes: number;
  color?: string;
  imageUrl?: string;
}

export interface PollState {
  id: string;
  title: string;
  options: VoteOption[];
  isActive: boolean;
  isEnded: boolean;
  allowChatVotes: boolean;
  allowChangeVote: boolean;
  durationSeconds: number;
  startedAt?: number;
  endedAt?: number;
  totalVotes: number;
  voters: Record<string, string>;
}

export interface GenerateAiPollPayload {
  topic: string;
  instructions?: string;
  optionCount?: number;
  language?: string;
}

export interface AiPollOptionDto {
  label: string;
  imageUrl?: string;
  color?: string;
}

export interface GenerateAiPollResponse {
  ok: boolean;
  title?: string;
  options?: AiPollOptionDto[];
  error?: string;
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
  TwitchBotSimulate: 'twitch/bot-simulate',
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
  SequencesGetState: 'sequences/get-state',
  SequencesSave: 'sequences/save',
  SequencesDelete: 'sequences/delete',
  TwitchChannelPointsGetRewards: 'twitch/channel-points-get-rewards',
  TwitchSendChatMessage: 'twitch/send-chat-message',
  TwitchGetTitle: 'twitch/get-title',
  TwitchUpdateTitle: 'twitch/update-title',
  TwitchGetTitleFilePath: 'twitch/get-title-file-path',
  TwitchCheckAvatar: 'twitch/check-avatar',
  TwitchModerationCheckMod: 'twitch/moderation/check-mod',
  TwitchModerationTimeout: 'twitch/moderation/timeout',
  TwitchModerationSmartTimeout: 'twitch/moderation/smart-timeout',
  TwitchModerationBan: 'twitch/moderation/ban',
  TwitchModerationUnban: 'twitch/moderation/unban',
  TwitchModerationMod: 'twitch/moderation/mod',
  TwitchModerationUnmod: 'twitch/moderation/unmod',
  TwitchModerationVip: 'twitch/moderation/vip',
  TwitchModerationUnvip: 'twitch/moderation/unvip',
  TwitchModerationClear: 'twitch/moderation/clear',
  TwitchModerationDeleteMessage: 'twitch/moderation/delete-message',
  TwitchModerationShoutout: 'twitch/moderation/shoutout',
  ChatOverlayTestMessage: 'chat-overlay/test-message',
  ChatOverlayReload: 'chat-overlay/reload',
  ChatOverlaySetPreview: 'chat-overlay/set-preview',
  ChatOverlaysList: 'chat-overlays/list',
  ChatOverlaysSave: 'chat-overlays/save',
  ChatOverlaysDelete: 'chat-overlays/delete',
  ObsChatGetState: 'obs-chat/get-state',
  ObsChatSaveSettings: 'obs-chat/save-settings',
  ObsChatGetUrl: 'obs-chat/get-url',
  ObsChatReload: 'obs-chat/reload',
  ObsChatSetPreview: 'obs-chat/set-preview',
  UpdateCheck: 'update/check',
  UpdateInstall: 'update/install',
  VotesGetState: 'votes/get-state',
  VotesSave: 'votes/save',
  VotesReset: 'votes/reset',
  VotesGenerateAi: 'votes/generate-ai',
  AudioPlaySound: 'audio/play-sound',
  AudioMuteMic: 'audio/mute-mic',
  DialogOpenFile: 'dialog/open-file',
} as const;

export type ChannelName = (typeof Channels)[keyof typeof Channels];

export const Events = {
  CoreStatusChanged: 'core/status-changed',
  TwitchChatMessage: 'twitch/chat-message',
  /** A profile resolved after its message was already published. */
  TwitchUserProfile: 'twitch/user-profile',
  /** A moderator deleted a message, timed out a user, or cleared chat. */
  TwitchChatCleared: 'twitch/chat-cleared',
  TwitchChannelPointsRedeemed: 'twitch/channel-points-redeemed',
  TwitchTitleChanged: 'twitch/title-changed',
  WindowMaximizedChanged: 'window/maximized-changed',
  CoreLog: 'core/log',
  KeybindTriggered: 'keybind/triggered',
  TwitchRaid: 'twitch/raid',
  TwitchFollow: 'twitch/follow',
  VotesChanged: 'votes/changed',
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
  [Channels.TwitchBotSimulate]: {
    request: { enabled?: boolean; login?: string } | undefined;
    response: { ok: boolean; simulated: boolean; botLogin: string };
  };
  [Channels.SettingsGetState]: { request: undefined; response: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; preferredChatSender?: ChatSenderRole; startupEnabled?: boolean; closeToTray?: boolean } };
  [Channels.SettingsSave]: {
    request: { twitch: TwitchSettings; language: string; botAccountEnabled?: boolean; preferredChatSender?: ChatSenderRole; startupEnabled?: boolean; closeToTray?: boolean };
    response: { ok: boolean };
  };
  [Channels.ChatOverlayGetState]: { request: undefined; response: ChatOverlaySettings };
  [Channels.ChatOverlaySaveSettings]: { request: ChatOverlaySettings; response: { ok: boolean } };
  [Channels.ChatOverlayGetUrl]: { request: { overlayId?: string } | undefined; response: { url: string; dockUrl?: string } };
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
  [Channels.AutoRepliesGenerate]: { request: { ruleId: string; message: ChatMessage; send?: boolean; overrideInstructions?: string; senderRole?: ChatSenderRole }; response: { ok: boolean; message?: string; usedFallback?: boolean; senderRole?: ChatSenderRole; senderLogin?: string; error?: string } };
  [Channels.SequencesGetState]: { request: undefined; response: CommandSequence[] };
  [Channels.SequencesSave]: { request: { sequence: CommandSequence }; response: { ok: boolean } };
  [Channels.SequencesDelete]: { request: { sequenceId: string }; response: { ok: boolean } };
  [Channels.TwitchChannelPointsGetRewards]: { request: undefined; response: { ok: boolean; rewards: TwitchRewardInfo[]; error?: string } };
  [Channels.TwitchSendChatMessage]: { request: { message: string; senderRole?: ChatSenderRole }; response: { ok: boolean; senderRole?: ChatSenderRole; senderLogin?: string; error?: string } };
  [Channels.TwitchGetTitle]: { request: undefined; response: { ok: boolean; title?: string | null; error?: string } };
  [Channels.TwitchUpdateTitle]: { request: { title: string }; response: { ok: boolean; error?: string } };
  [Channels.TwitchGetTitleFilePath]: { request: undefined; response: { path: string } };
  [Channels.TwitchCheckAvatar]: {
    request: { username?: string; userId?: string };
    response: {
      ok: boolean;
      userId?: string | null;
      username?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      error?: string | null;
    };
  };
  [Channels.TwitchModerationCheckMod]: {
    request: { target: string };
    response: { ok: boolean; isMod: boolean; error?: string };
  };
  [Channels.TwitchModerationTimeout]: {
    request: { target: string; durationSeconds?: number; reason?: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationSmartTimeout]: {
    request: { target: string; durationSeconds?: number; reason?: string };
    response: { ok: boolean; wasMod?: boolean; target?: string; error?: string };
  };
  [Channels.TwitchModerationBan]: {
    request: { target: string; reason?: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationUnban]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationMod]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationUnmod]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationVip]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationUnvip]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationClear]: {
    request: undefined;
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationDeleteMessage]: {
    request: { messageId: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.TwitchModerationShoutout]: {
    request: { target: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.ChatOverlayTestMessage]: {
    request: Partial<ChatMessage> & { message: string; username: string };
    response: { ok: boolean; error?: string };
  };
  [Channels.ChatOverlayReload]: { request: { overlayId?: string } | undefined; response: { ok: boolean } };
  [Channels.ChatOverlaySetPreview]: { request: { enabled: boolean; overlayId?: string; messages?: Partial<ChatMessage>[] }; response: { ok: boolean } };
  [Channels.ChatOverlaysList]: { request: undefined; response: { overlays: ChatOverlayInstance[] } };
  [Channels.ChatOverlaysSave]: { request: ChatOverlaysSavePayload; response: { ok: boolean; error?: string } };
  [Channels.ChatOverlaysDelete]: { request: ChatOverlaysDeletePayload; response: { ok: boolean; error?: string } };
  [Channels.ObsChatGetState]: { request: undefined; response: ChatOverlaySettings };
  [Channels.ObsChatSaveSettings]: { request: ChatOverlaySettings; response: { ok: boolean } };
  [Channels.ObsChatGetUrl]: { request: undefined; response: { url: string } };
  [Channels.ObsChatReload]: { request: undefined; response: { ok: boolean } };
  [Channels.ObsChatSetPreview]: { request: { enabled: boolean; messages?: Partial<ChatMessage>[] }; response: { ok: boolean } };
  [Channels.UpdateCheck]: { request: undefined; response: UpdateState };
  [Channels.UpdateInstall]: { request: { downloadUrl: string }; response: { ok: boolean; error?: string } };
  [Channels.VotesGetState]: { request: undefined; response: { poll: PollState; url: string } };
  [Channels.VotesSave]: { request: { poll: PollState }; response: { ok: boolean; poll?: PollState } };
  [Channels.VotesReset]: { request: undefined; response: { ok: boolean; poll?: PollState } };
  [Channels.VotesGenerateAi]: { request: GenerateAiPollPayload; response: GenerateAiPollResponse };
  [Channels.AudioPlaySound]: { request: { soundPath: string; volume?: number }; response: { ok: boolean; error?: string } };
  [Channels.AudioMuteMic]: { request: { durationSeconds: number }; response: { ok: boolean; error?: string } };
  [Channels.DialogOpenFile]: { request: { filter?: string; title?: string }; response: { path: string | null } };
}

export interface EventMap {
  [Events.CoreStatusChanged]: ConnectionStatus;
  [Events.TwitchChatMessage]: ChatMessage;
  [Events.TwitchUserProfile]: { userId: string; avatarUrl: string; color?: string };
  [Events.TwitchChatCleared]: { scope: 'message' | 'user' | 'all'; id?: string };
  [Events.TwitchChannelPointsRedeemed]: ChannelPointsRedemption;
  [Events.TwitchTitleChanged]: { title: string };
  [Events.WindowMaximizedChanged]: { isMaximized: boolean };
  [Events.CoreLog]: { message: string };
  [Events.KeybindTriggered]: { bindingId: string };
  [Events.TwitchRaid]: TwitchRaidEvent;
  [Events.TwitchFollow]: TwitchFollowEvent;
  [Events.VotesChanged]: PollState;
}

