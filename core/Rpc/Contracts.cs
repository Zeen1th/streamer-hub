using System.Text.Json;
using System.Text.Json.Serialization;

namespace StreamerHub.Core.Rpc;

public sealed record CounterCommandConfig
{
    public string CommandName { get; init; } = "deaths";
    public string Permission { get; init; } = "everyone";
    public int CooldownSeconds { get; init; } = 10;
}

public sealed record CounterConfig
{
    public CounterCommandConfig Increase { get; init; } = new();
    public CounterCommandConfig Decrease { get; init; } = new() { CommandName = "deathsdown" };
    public CounterCommandConfig Reset { get; init; } = new() { CommandName = "deathsreset", CooldownSeconds = 0 };
}

public sealed record Counter
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = "Deaths";
    public int Count { get; init; }
    public CounterConfig Commands { get; init; } = new();
    public ObsOutputConfig Obs { get; init; } = new();
    public bool TitleEnabled { get; init; }
    public string TitleTemplate { get; init; } = string.Empty;
}

public sealed record KeybindChord
{
    public string Key { get; init; } = string.Empty;
    public string? Modifier { get; init; }
}

public sealed record ActionKeybind
{
    public string Id { get; init; } = string.Empty;
    public bool Enabled { get; init; } = true;
    public string TargetType { get; init; } = "counter";
    public string TargetId { get; init; } = string.Empty;
    public string Action { get; init; } = "increase";
    public KeybindChord Chord { get; init; } = new();
}

public sealed record KeybindRegistration(string BindingId, string Status, string? Error = null);
public sealed record KeybindState(IReadOnlyList<ActionKeybind> Bindings, IReadOnlyList<KeybindRegistration> Registrations);

public sealed record ObsOutputConfig
{
    public bool Enabled { get; init; } = true;
    public string FilePath { get; init; } = string.Empty;
    public string Template { get; init; } = "Deaths: {count}";
}

public sealed record TwitchSettings
{
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
}

public sealed record AutoReply
{
    public string Id { get; init; } = string.Empty;
    public List<string> Triggers { get; init; } = new();
    public string Trigger { get; init; } = string.Empty;
    public string Response { get; init; } = string.Empty;
    public bool Enabled { get; init; } = true;
    public bool ResponseEnabled { get; init; } = true;
    public int CooldownSeconds { get; init; } = 30;
    public int UserCooldownSeconds { get; init; }
    public bool TitleActionEnabled { get; init; }
    public string TitleTemplate { get; init; } = string.Empty;
    public int TitleStart { get; init; } = 1;
    public int TitleCount { get; init; } = 1;
    public string TitleIncreaseCommand { get; init; } = string.Empty;
    public string TitleDecreaseCommand { get; init; } = string.Empty;
    public bool ThemeActionEnabled { get; init; }
    public string ThemeActionMode { get; init; } = "dark";
    public List<TitleCounter> TitleCounters { get; init; } = new();
    public string MinimumRank { get; init; } = "everyone";
    public int AiUserCooldownSeconds { get; init; } = 60;
    public string MatchMode { get; init; } = "exact";
    public string ResponseMode { get; init; } = "static";
    public string AiInstructions { get; init; } = string.Empty;
    public string AgentName { get; init; } = string.Empty;
    public string AgentRole { get; init; } = string.Empty;
    public string AgentContext { get; init; } = string.Empty;
    public string AiModel { get; init; } = "meta-llama/llama-3.2-3b-instruct:free";
    public string AiProvider { get; init; } = "openrouter";
    public int AiMaxTokens { get; init; } = 120;
    public string AiFallback { get; init; } = string.Empty;
    public string AiUserRestriction { get; init; } = "none";
    public List<string> AiTargetUsers { get; init; } = new();
    public List<AiConditionRule> AiConditions { get; init; } = new();
    public string? SenderRole { get; init; } = "default";
}

public sealed record AiConditionRule
{
    public string Id { get; init; } = string.Empty;
    public string IfType { get; init; } = "username";
    public string IfValue { get; init; } = string.Empty;
    public string ThenType { get; init; } = "instructions";
    public string ThenValue { get; init; } = string.Empty;
}

public sealed record TitleCounter
{
    public string Id { get; init; } = string.Empty;
    public int Start { get; init; } = 1;
    public int Count { get; init; } = 1;
}

public sealed record AutoReplySettings
{
    public int GlobalAiCooldownSeconds { get; init; }
    public int GlobalAiUserCooldownSeconds { get; init; } = 60;
}

public sealed record OpenRouterSettingsState
{
    public bool Configured { get; init; }
    public bool GroqConfigured { get; init; }
}

public sealed record SequenceStep
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = "chat"; // "chat" | "counter" | "command" | "wait" | "moderation"
    public double? WaitDuration { get; init; }
    public string? WaitUnit { get; init; } = "seconds"; // "seconds" | "minutes"
    public string? ChatMessage { get; init; }
    public string? CounterId { get; init; }
    public string? CounterAction { get; init; } // "increase" | "decrease" | "reset"
    public string? CommandTrigger { get; init; }
    public string? ModerationAction { get; init; } // "smart_timeout" | "timeout" | "ban" | "unban" | "mod" | "unmod" | "vip" | "unvip" | "clear_chat" | "shoutout"
    public string? TargetUser { get; init; }
    public int? DurationSeconds { get; init; }
    public string? Reason { get; init; }
    public string? CommentText { get; init; }
}

public sealed record ModerationTargetPayload(string? Target);
public sealed record ModerationTimeoutPayload(string? Target, int? DurationSeconds = null, string? Reason = null);
public sealed record ModerationSmartTimeoutPayload(string? Target, int? DurationSeconds = null, string? Reason = null);
public sealed record ModerationBanPayload(string? Target, string? Reason = null);
public sealed record ModerationDeleteMessagePayload(string? MessageId);


public sealed record ActionTrigger
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = "twitch_chat"; // "twitch_raid" | "twitch_chat" | "twitch_channel_points"
    public bool Enabled { get; init; } = true;
    public int? MinViewers { get; init; }
    public string? ChatCommand { get; init; }
    public string? MatchMode { get; init; } // "exact" | "startsWith" | "contains"
    public string? RewardId { get; init; }
    public string? RewardTitle { get; init; }
}

public sealed record TwitchRaidEvent(string FromUserId, string FromUserName, string FromUserLogin, int Viewers);

public sealed record CommandSequence
{
    public string Id { get; init; } = string.Empty;
    public bool Enabled { get; init; } = true;
    public string Name { get; init; } = string.Empty;
    public string TriggerType { get; init; } = "channel_points"; // "channel_points" | "chat" | "both"
    public string? RewardTitle { get; init; }
    public string? RewardId { get; init; }
    public string? ChatTrigger { get; init; }
    public int CooldownSeconds { get; init; }
    public List<SequenceStep> Steps { get; init; } = new();
    public List<ActionTrigger> Triggers { get; init; } = new();
}

public sealed record ChannelPointsRedemption
{
    public string Id { get; init; } = string.Empty;
    public string RewardId { get; init; } = string.Empty;
    public string RewardTitle { get; init; } = string.Empty;
    public int? RewardCost { get; init; }
    public string UserId { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string UserLogin { get; init; } = string.Empty;
    public string? UserInput { get; init; }
    public string RedeemedAt { get; init; } = string.Empty;
}

public sealed record TwitchRewardInfo
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public int Cost { get; init; }
    public string? Prompt { get; init; }
    public bool? UserInputRequired { get; init; }
}

/// <summary>
/// Chat overlay settings, carried verbatim.
///
/// The shape is owned by the UI, which holds the authoritative normalizer,
/// the version migration, and the tests for both. The host never reads an
/// individual field - it only persists the blob and forwards it to the overlay
/// - so mirroring the schema here would buy nothing and guarantee drift: any
/// field the C# record did not know about would be silently dropped on the next
/// save. Extension data round-trips the whole object untouched instead.
/// </summary>
public sealed record ChatOverlaySettings
{
    [JsonExtensionData]
    public Dictionary<string, JsonElement> Values { get; init; } = new();
}

public sealed record ChatOverlayInstance
{
    public string Id { get; init; } = "default";
    public string Name { get; init; } = "Main Overlay";
    public bool IsMain { get; init; } = false;
    public ChatOverlaySettings Settings { get; init; } = new();
}

public sealed record ChatOverlaysSavePayload(ChatOverlayInstance? Overlay);
public sealed record ChatOverlaysDeletePayload(string? Id);
public sealed record ChatOverlaySetPreviewPayload(bool Enabled, List<ChatMessage>? Messages = null, string? OverlayId = null);
public sealed record ChatOverlayReloadPayload(string? OverlayId = null);

/// <summary>
/// One emote occurrence from the IRC <c>emotes</c> tag.
///
/// <para><see cref="Start"/> and <see cref="End"/> are INCLUSIVE code point
/// offsets into the message, not UTF-16 code unit offsets. Consumers must slice
/// by enumerating text elements, or any message containing an astral-plane
/// character before the emote will be cut in the wrong place.</para>
/// </summary>
public sealed record EmoteRange(string Id, int Start, int End);

public sealed record ChatMessage
{
    public string Id { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public string? DisplayName { get; init; }
    public string? UserLogin { get; init; }
    public string? UserId { get; init; }
    public string? AvatarUrl { get; init; }
    public bool IsBroadcaster { get; init; }
    public bool IsMod { get; init; }
    public bool IsLeadMod { get; init; }
    public bool IsVip { get; init; }
    public bool IsSubscriber { get; init; }
    public string Message { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public IReadOnlyList<EmoteRange> Emotes { get; init; } = Array.Empty<EmoteRange>();
    /// <summary>The user's chosen Twitch chat colour, when they have set one.</summary>
    public string? Color { get; init; }
    public string? CustomRewardId { get; init; }
    public bool IsSelf { get; init; }
}

public enum ChatClearScope
{
    Message,
    User,
    All,
}

/// <summary>A moderator action that removes messages already on the overlay.</summary>
public sealed record ChatClear(ChatClearScope Scope, string? Id);

public sealed record ConnectionStatus
{
    public bool CoreConnected { get; init; }
    public string CoreVersion { get; init; } = string.Empty;
    public bool TwitchConnected { get; init; }
    public string TwitchChannel { get; init; } = string.Empty;
    public bool AuthRequired { get; init; }
    public bool BotAccountEnabled { get; init; }
    public bool BotConnected { get; init; }
    public string BotLogin { get; init; } = string.Empty;
    public string PreferredChatSender { get; init; } = "bot";
    public string ActiveChatSender { get; init; } = "broadcaster";
    public string ActiveChatSenderLogin { get; init; } = string.Empty;
}

public sealed record LogPayload
{
    public string Id { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public string Kind { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? Username { get; init; }
    public int? Count { get; init; }
}
