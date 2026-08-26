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

    private static string Serialize(string kind, object payload, string? id = null) =>
        Json.Serialize(new
        {
            v = Version,
            id = string.IsNullOrWhiteSpace(id) ? $"overlay-{Guid.NewGuid():N}" : id,
            kind,
            payload,
        });
}
