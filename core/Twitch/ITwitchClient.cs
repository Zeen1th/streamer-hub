using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Twitch;

public sealed record TwitchInfo(string Key, string? Arg);

public interface ITwitchClient : IAsyncDisposable
{
    event Action<ChatMessage>? ChatMessageReceived;
    /// <summary>Raised for CLEARMSG and CLEARCHAT so moderated messages leave the overlay.</summary>
    event Action<ChatClear>? ChatCleared;
    event Action<TwitchRaidEvent>? RaidReceived;
    event Action<TwitchWatchStreakEvent>? WatchStreakReceived;
    event Action<TwitchGiftEvent>? GiftReceived;
    event Action<TwitchState>? StateChanged;
    event Action<TwitchInfo>? Info;
    TwitchState State { get; }
    Func<Task<string?>>? TokenRefreshRequested { get; set; }
    void UpdateAccessToken(string accessToken);
    void Connect(string accessToken, string login, string? channel = null);
    void Disconnect();
    Task<bool> SendChatMessageAsync(string message);
    Task<(bool Ok, string? Title, string? Error)> GetChannelTitleAsync();
    Task<(bool Ok, string? Error)> UpdateChannelTitleAsync(string title);
    void SetLastKnownTitle(string? title);
    Task<IReadOnlyDictionary<string, string?>> GetUserProfileImagesAsync(IReadOnlyList<string> userIds, CancellationToken cancellationToken);
    Task<(bool Ok, string? UserId, string? Login, string? DisplayName, string? AvatarUrl, string? Error)> CheckUserProfileAsync(string? usernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, IReadOnlyList<TwitchRewardInfo> Rewards, string? Error)> GetCustomRewardsAsync(CancellationToken cancellationToken = default);
    Task<(bool Ok, bool IsMod, string? Error)> CheckIsModeratorAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> TimeoutUserAsync(string targetUsernameOrId, int durationSeconds, string? reason = null, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> BanUserAsync(string targetUsernameOrId, string? reason = null, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> UnbanUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> ModUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> UnmodUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> VipUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> UnvipUserAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> ClearChatAsync(CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> DeleteChatMessageAsync(string messageId, CancellationToken cancellationToken = default);
    Task<(bool Ok, string? Error)> SendShoutoutAsync(string targetUsernameOrId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Clips the last moments of the streamer's own live channel. Twitch credits every clip to the account that made it
    /// (the streamer), so who asked for it is tracked by the app. Error is MISSING_SCOPE, CHANNEL_OFFLINE or a Twitch message.
    /// </summary>
    Task<(bool Ok, string? Id, string? Url, string? Title, string? Error)> CreateClipAsync(string? title = null, int? durationSeconds = null, bool hasDelay = false, CancellationToken cancellationToken = default);
    /// <summary>Recent clips of any channel (up to 100, newest window first as Helix returns them).</summary>
    Task<(bool Ok, IReadOnlyList<TwitchClipInfo> Clips, string? Login, string? DisplayName, string? Error)> GetClipsAsync(string targetUsernameOrId, DateTimeOffset? startedAt, CancellationToken cancellationToken = default);
    /// <summary>Is the streamer's channel live right now (and since when, according to Twitch)?</summary>
    Task<(bool Ok, bool Live, DateTimeOffset? StartedAt, string? Error)> GetStreamStatusAsync(CancellationToken cancellationToken = default);
    Task<(bool Ok, bool WasMod, string? TargetUser, string? Error)> SmartModTimeoutAsync(string targetUsernameOrId, int durationSeconds, string? reason = null, CancellationToken cancellationToken = default);
}
