using System.Text.Json;

namespace StreamerHub.Core.Rpc;

public sealed class RpcDispatcher
{
    public delegate Task<object?> Handler(JsonElement? payload, CancellationToken ct);

    private readonly Dictionary<string, Handler> _handlers = new();

    public void Register(string channel, Handler handler) => _handlers[channel] = handler;

    public async Task<object?> DispatchAsync(string channel, JsonElement? payload, CancellationToken ct)
    {
        if (!_handlers.TryGetValue(channel, out var handler))
            throw new InvalidOperationException($"Unknown channel: {channel}");
        return await handler(payload, ct).ConfigureAwait(false);
    }
}
