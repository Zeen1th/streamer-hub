using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Overlay;

public static class ChatOverlayProtocol
{
    public const int Version = 1;

    public static string Hello(ChatOverlaySettings settings, bool connected) =>
        Serialize("hello", new { settings, connected });

    public static string ChatMessage(ChatMessage message) =>
        Serialize("chat-message", message, message.Id);

    public static string Settings(ChatOverlaySettings settings) =>
        Serialize("settings", settings);

    public static string Connected() => Serialize("connected", new { connected = true });

    public static string Disconnected() => Serialize("disconnected", new { connected = false });

    /// <summary>
    /// A resolved user profile, sent after the message it belongs to.
    ///
    /// Profile lookups are asynchronous, so a viewer's first message is
    /// published before their avatar is known. The overlay patches the avatar
    /// onto messages already on screen when this arrives, rather than chat
    /// waiting on a Helix round trip.
    /// </summary>
    public static string Profile(string userId, string? avatarUrl, string? color) =>
        Serialize("profile", new { userId, avatarUrl, color });

    /// <summary>A moderator removing one message, one user's messages, or all of them.</summary>
    public static string Clear(ChatClear clear) =>
        Serialize("clear", new { scope = ScopeName(clear.Scope), id = clear.Id });

    /// <summary>Third-party emote name to URL maps, keyed by provider.</summary>
    public static string Emotes(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> providers) =>
        Serialize("emotes", new { providers });

    private static string ScopeName(ChatClearScope scope) => scope switch
    {
        ChatClearScope.Message => "message",
        ChatClearScope.User => "user",
        _ => "all",
    };

    private static string Serialize(string kind, object payload, string? id = null) =>
        Json.Serialize(new
        {
            v = Version,
            id = string.IsNullOrWhiteSpace(id) ? $"overlay-{Guid.NewGuid():N}" : id,
            kind,
            payload,
        });
}
