using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Twitch;

public sealed record TwitchInfo(string Key, string? Arg);

public interface ITwitchClient : IAsyncDisposable
{
    event Action<ChatMessage>? ChatMessageReceived;
    event Action<TwitchState>? StateChanged;
    event Action<TwitchInfo>? Info;
    TwitchState State { get; }
    void Connect(string accessToken, string login, string? channel = null);
    void Disconnect();
    Task<bool> SendChatMessageAsync(string message);
    Task<(bool Ok, string? Error)> UpdateChannelTitleAsync(string title);
}
