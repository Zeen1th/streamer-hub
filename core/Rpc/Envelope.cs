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
    public const string WindowSetZoom = "window/set-zoom";
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
    public const string TwitchBotSimulate = "twitch/bot-simulate";
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
    public const string VotesGetState = "votes/get-state";
    public const string VotesSave = "votes/save";
    public const string VotesReset = "votes/reset";
    public const string VotesGenerateAi = "votes/generate-ai";
    public const string AudioPlaySound = "audio/play-sound";
    public const string AudioMuteMic = "audio/mute-mic";
    public const string AudioSpeakTts = "audio/speak-tts";
    public const string DialogOpenFile = "dialog/open-file";
    public const string AlertsGetFfmpegStatus = "alerts/get-ffmpeg-status";
    public const string AlertsDownloadFfmpeg = "alerts/download-ffmpeg";
    public const string AlertsInspect = "alerts/inspect";
    public const string AlertsCompress = "alerts/compress";
    public const string AlertsCancel = "alerts/cancel";
    public const string AlertsOpenFolder = "alerts/open-folder";
    public const string AlertsOpenFile = "alerts/open-file";
    public const string AlertsSaveDroppedFile = "alerts/save-dropped-file";
    public const string AlertsGetTempSettings = "alerts/get-temp-settings";
    public const string AlertsSetTempSettings = "alerts/set-temp-settings";
    public const string AlertsDiscardTemp = "alerts/discard-temp";
    public const string DialogPickFolder = "dialog/pick-folder";
    public const string ChatOverlayShowImage = "chat-overlay/show-image";
    public const string ChatOverlayHideImage = "chat-overlay/hide-image";
    public const string ChatOverlayGetImageUrl = "chat-overlay/get-image-url";
    public const string AiGenerateTrivia = "ai/generate-trivia";
    public const string ObsWebsocketGetStatus = "obs/websocket-get-status";
    public const string ObsWebsocketConnect = "obs/websocket-connect";
    public const string ObsWebsocketDisconnect = "obs/websocket-disconnect";
    public const string ObsWebsocketAutoDetect = "obs/websocket-auto-detect";
    public const string ObsGetAudioSources = "obs/get-audio-sources";
    public const string ObsMuteSource = "obs/mute-source";
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
    public const string TwitchFollow = "twitch/follow";
    public const string TwitchWatchStreak = "twitch/watch-streak";
    public const string ObsWebsocketStatusChanged = "obs/websocket-status-changed";
    public const string VotesChanged = "votes/changed";
    public const string AlertsProgress = "alerts/progress";
    public const string AlertsCompleted = "alerts/completed";
    public const string AlertsDownloadProgress = "alerts/download-progress";
    public const string AlertsFileDropped = "alerts/file-dropped";
}


