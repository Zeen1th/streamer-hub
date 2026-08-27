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
    public const string OpenRouterGetState = "openrouter/get-state";
    public const string OpenRouterSave = "openrouter/save";
    public const string WindowBeginDrag = "window/begin-drag";
    public const string AutoRepliesGetState = "auto-replies/get-state";
    public const string AutoRepliesSettingsGet = "auto-replies/settings-get";
    public const string AutoRepliesSettingsSave = "auto-replies/settings-save";
    public const string AutoRepliesSave = "auto-replies/save";
    public const string AutoRepliesDelete = "auto-replies/delete";
    public const string TwitchSendChatMessage = "twitch/send-chat-message";
    public const string TwitchUpdateTitle = "twitch/update-title";
    public const string AutoRepliesGenerate = "auto-replies/generate";
    public const string UpdateCheck = "update/check";
    public const string UpdateInstall = "update/install";
}

public static class Events
{
    public const string CoreStatusChanged = "core/status-changed";
    public const string TwitchChatMessage = "twitch/chat-message";
    public const string WindowMaximizedChanged = "window/maximized-changed";
    public const string CoreLog = "core/log";
}

