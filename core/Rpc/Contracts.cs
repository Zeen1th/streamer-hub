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
    public string AiModel { get; init; } = "meta-llama/llama-3.2-3b-instruct:free";
    public string AiProvider { get; init; } = "openrouter";
    public int AiMaxTokens { get; init; } = 120;
    public string AiFallback { get; init; } = string.Empty;
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
    public string? UserId { get; init; }
    public string? AvatarUrl { get; init; }
    public bool IsBroadcaster { get; init; }
    public bool IsMod { get; init; }
    public bool IsVip { get; init; }
    public bool IsSubscriber { get; init; }
    public string Message { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public IReadOnlyList<EmoteRange> Emotes { get; init; } = Array.Empty<EmoteRange>();
    /// <summary>The user's chosen Twitch chat colour, when they have set one.</summary>
    public string? Color { get; init; }
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
