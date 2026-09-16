using System.Text.Json;
using System.Text.Json.Serialization;

namespace StreamerHub.Core.Rpc;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static string Serialize(object? value) => JsonSerializer.Serialize(value, Options);

    public static T? Deserialize<T>(JsonElement element) =>
        JsonSerializer.Deserialize<T>(element.GetRawText(), Options);
}

public sealed record RpcEnvelope
{
    [JsonPropertyName("v")] public int V { get; init; } = 1;
    [JsonPropertyName("id")] public string Id { get; init; } = string.Empty;
    [JsonPropertyName("kind")] public string Kind { get; init; } = "request";
    [JsonPropertyName("channel")] public string Channel { get; init; } = string.Empty;
    [JsonPropertyName("payload")] public JsonElement? Payload { get; init; }
    [JsonPropertyName("error")] public string? Error { get; init; }
}

public static class Channels
{
    public const string WindowMinimize = "window/minimize";
    public const string WindowMaximizeToggle = "window/maximize-toggle";
    public const string WindowClose = "window/close";
    public const string WindowIsMaximized = "window/is-maximized";
    public const string CoreGetStatus = "core/get-status";
    public const string CountersGetState = "counters/get-state";
    public const string CountersSetCount = "counters/set-count";
    public const string CountersSave = "counters/save";
    public const string CountersDelete = "counters/delete";
    public const string KeybindsGetState = "keybinds/get-state";
    public const string KeybindsSave = "keybinds/save";
    public const string ObsWrite = "obs/write";
    public const string DialogSaveFile = "dialog/save-file";
    public const string LogAppend = "log/append";
    public const string TwitchAuthorize = "twitch/authorize";
    public const string TwitchForget = "twitch/forget";
    public const string TwitchBotAuthorize = "twitch/bot-authorize";
    public const string TwitchBotForget = "twitch/bot-forget";
    public const string SettingsGetState = "settings/get-state";
    public const string SettingsSave = "settings/save";
    public const string ChatOverlayGetState = "chat-overlay/get-state";
    public const string ChatOverlaySaveSettings = "chat-overlay/save-settings";
    public const string ChatOverlayGetUrl = "chat-overlay/get-url";
    public const string SystemListFonts = "system/list-fonts";
    public const string OpenRouterGetState = "openrouter/get-state";
    public const string OpenRouterSave = "openrouter/save";
    public const string WindowBeginDrag = "window/begin-drag";
    public const string WindowBeginResize = "window/begin-resize";
    public const string AutoRepliesGetState = "auto-replies/get-state";
    public const string AutoRepliesSettingsGet = "auto-replies/settings-get";
    public const string AutoRepliesSettingsSave = "auto-replies/settings-save";
    public const string AutoRepliesSave = "auto-replies/save";
    public const string AutoRepliesDelete = "auto-replies/delete";
    public const string SequencesGetState = "sequences/get-state";
    public const string SequencesSave = "sequences/save";
    public const string SequencesDelete = "sequences/delete";
    public const string TwitchChannelPointsGetRewards = "twitch/channel-points-get-rewards";
    public const string TwitchSendChatMessage = "twitch/send-chat-message";
    public const string TwitchGetTitle = "twitch/get-title";
    public const string TwitchUpdateTitle = "twitch/update-title";
    public const string TwitchGetTitleFilePath = "twitch/get-title-file-path";
    public const string AutoRepliesGenerate = "auto-replies/generate";
    public const string TwitchCheckAvatar = "twitch/check-avatar";
    public const string TwitchModerationCheckMod = "twitch/moderation/check-mod";
    public const string TwitchModerationTimeout = "twitch/moderation/timeout";
    public const string TwitchModerationSmartTimeout = "twitch/moderation/smart-timeout";
    public const string TwitchModerationBan = "twitch/moderation/ban";
    public const string TwitchModerationUnban = "twitch/moderation/unban";
    public const string TwitchModerationMod = "twitch/moderation/mod";
    public const string TwitchModerationUnmod = "twitch/moderation/unmod";
    public const string TwitchModerationVip = "twitch/moderation/vip";
    public const string TwitchModerationUnvip = "twitch/moderation/unvip";
    public const string TwitchModerationClear = "twitch/moderation/clear";
    public const string TwitchModerationDeleteMessage = "twitch/moderation/delete-message";
    public const string TwitchModerationShoutout = "twitch/moderation/shoutout";
    public const string ChatOverlayTestMessage = "chat-overlay/test-message";
    public const string ChatOverlayReload = "chat-overlay/reload";
    public const string ChatOverlaySetPreview = "chat-overlay/set-preview";
    public const string ChatOverlaysList = "chat-overlays/list";
    public const string ChatOverlaysSave = "chat-overlays/save";
    public const string ChatOverlaysDelete = "chat-overlays/delete";
    public const string ObsChatGetState = "obs-chat/get-state";
    public const string ObsChatSaveSettings = "obs-chat/save-settings";
    public const string ObsChatGetUrl = "obs-chat/get-url";
    public const string ObsChatReload = "obs-chat/reload";
    public const string ObsChatSetPreview = "obs-chat/set-preview";
    public const string UpdateCheck = "update/check";
    public const string UpdateInstall = "update/install";
}

public static class Events
{
    public const string CoreStatusChanged = "core/status-changed";
    public const string TwitchChatMessage = "twitch/chat-message";
    /// <summary>A profile resolved after its message was already published.</summary>
    public const string TwitchUserProfile = "twitch/user-profile";
    /// <summary>A moderator deleted a message, timed out a user, or cleared chat.</summary>
    public const string TwitchChatCleared = "twitch/chat-cleared";
    public const string TwitchChannelPointsRedeemed = "twitch/channel-points-redeemed";
    public const string TwitchTitleChanged = "twitch/title-changed";
    public const string WindowMaximizedChanged = "window/maximized-changed";
    public const string CoreLog = "core/log";
    public const string KeybindTriggered = "keybind/triggered";
    public const string TwitchRaid = "twitch/raid";
}

