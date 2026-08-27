using System.Text.Json;

namespace StreamerHub.Core.Twitch;

/// <summary>
/// Fetches third-party emote sets (BetterTTV, FrankerFaceZ, 7TV) and exposes
/// them as name to URL maps for the overlay.
///
/// These are public APIs we do not control, so every provider is isolated: each
/// is fetched independently with a short timeout, and one that fails, times out,
/// or rate-limits is simply skipped - its emotes render as text and the others
/// are unaffected. Nothing here ever blocks or delays chat.
/// </summary>
public sealed class EmoteRegistry : IDisposable
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(6);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(8);

    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private readonly object _lock = new();
    private readonly Func<DateTimeOffset> _clock;

    private Dictionary<string, IReadOnlyDictionary<string, string>> _providers = new(StringComparer.Ordinal);
    private DateTimeOffset _fetchedAt = DateTimeOffset.MinValue;
    private string _channelUserId = string.Empty;

    public EmoteRegistry(HttpClient? http = null, Func<DateTimeOffset>? clock = null)
    {
        _ownsHttp = http is null;
        _http = http ?? new HttpClient { Timeout = RequestTimeout };
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    /// <summary>The most recently fetched maps, keyed by provider.</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Providers
    {
        get { lock (_lock) return _providers; }
    }

    public bool IsFresh(string channelUserId)
    {
        lock (_lock)
        {
            return string.Equals(_channelUserId, channelUserId, StringComparison.Ordinal)
                && _providers.Count > 0
                && _clock() - _fetchedAt < CacheTtl;
        }
    }

    /// <summary>
    /// Refreshes every provider. Returns the merged provider map, which is the
    /// previous one when nothing could be fetched.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> RefreshAsync(
        string channelUserId,
        CancellationToken cancellationToken = default)
    {
        if (IsFresh(channelUserId)) return Providers;

        var bttv = FetchProviderAsync(() => FetchBttvAsync(channelUserId, cancellationToken));
        var ffz = FetchProviderAsync(() => FetchFfzAsync(channelUserId, cancellationToken));
        var sevenTv = FetchProviderAsync(() => FetchSevenTvAsync(channelUserId, cancellationToken));

        await Task.WhenAll(bttv, ffz, sevenTv).ConfigureAwait(false);

        var next = new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.Ordinal);
        if (bttv.Result.Count > 0) next["bttv"] = bttv.Result;
        if (ffz.Result.Count > 0) next["ffz"] = ffz.Result;
        if (sevenTv.Result.Count > 0) next["sevenTv"] = sevenTv.Result;

        lock (_lock)
        {
            // Keep the previous map rather than blanking every emote when the
            // whole refresh failed (offline, DNS, all three providers down).
            if (next.Count > 0 || _providers.Count == 0)
            {
                _providers = next;
                _fetchedAt = _clock();
                _channelUserId = channelUserId;
            }
            return _providers;
        }
    }

    private static async Task<IReadOnlyDictionary<string, string>> FetchProviderAsync(
        Func<Task<IReadOnlyDictionary<string, string>>> fetch)
    {
        try
        {
            return await fetch().ConfigureAwait(false);
        }
        catch
        {
            // One provider failing must never affect the others.
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }
    }

    private async Task<JsonDocument?> GetJsonAsync(string url, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(RequestTimeout);

        using var response = await _http.GetAsync(url, timeout.Token).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return null;

        var stream = await response.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
        return await JsonDocument.ParseAsync(stream, cancellationToken: timeout.Token).ConfigureAwait(false);
    }

    // --- BetterTTV ---------------------------------------------------------

    private async Task<IReadOnlyDictionary<string, string>> FetchBttvAsync(string channelUserId, CancellationToken cancellationToken)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);

        using (var global = await GetJsonAsync("https://api.betterttv.net/3/cached/emotes/global", cancellationToken).ConfigureAwait(false))
        {
            if (global is not null) AddBttvArray(global.RootElement, map);
        }

        if (!string.IsNullOrWhiteSpace(channelUserId))
        {
            using var channel = await GetJsonAsync(
                $"https://api.betterttv.net/3/cached/users/twitch/{Uri.EscapeDataString(channelUserId)}",
                cancellationToken).ConfigureAwait(false);

            if (channel is not null && channel.RootElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var key in new[] { "channelEmotes", "sharedEmotes" })
                {
                    if (channel.RootElement.TryGetProperty(key, out var array)) AddBttvArray(array, map);
                }
            }
        }

        return map;
    }

    private static void AddBttvArray(JsonElement array, Dictionary<string, string> map)
    {
        if (array.ValueKind != JsonValueKind.Array) return;
        foreach (var entry in array.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object) continue;
            var code = entry.TryGetProperty("code", out var c) ? c.GetString() : null;
            var id = entry.TryGetProperty("id", out var i) ? i.GetString() : null;
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(id)) continue;
            map[code] = $"https://cdn.betterttv.net/emote/{id}/3x";
        }
    }

    // --- FrankerFaceZ ------------------------------------------------------

    private async Task<IReadOnlyDictionary<string, string>> FetchFfzAsync(string channelUserId, CancellationToken cancellationToken)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(channelUserId)) return map;

        using var document = await GetJsonAsync(
            $"https://api.frankerfacez.com/v1/room/id/{Uri.EscapeDataString(channelUserId)}",
            cancellationToken).ConfigureAwait(false);

        if (document is null || !document.RootElement.TryGetProperty("sets", out var sets)) return map;
        if (sets.ValueKind != JsonValueKind.Object) return map;

        foreach (var set in sets.EnumerateObject())
        {
            if (!set.Value.TryGetProperty("emoticons", out var emoticons)) continue;
            if (emoticons.ValueKind != JsonValueKind.Array) continue;

            foreach (var emote in emoticons.EnumerateArray())
            {
                var name = emote.TryGetProperty("name", out var n) ? n.GetString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;
                if (!emote.TryGetProperty("urls", out var urls) || urls.ValueKind != JsonValueKind.Object) continue;

                // FFZ offers 1/2/4; take the largest available.
                string? best = null;
                foreach (var scale in new[] { "4", "2", "1" })
                {
                    if (urls.TryGetProperty(scale, out var candidate) && candidate.ValueKind == JsonValueKind.String)
                    {
                        best = candidate.GetString();
                        if (!string.IsNullOrWhiteSpace(best)) break;
                    }
                }
                if (string.IsNullOrWhiteSpace(best)) continue;
                map[name] = best.StartsWith("//", StringComparison.Ordinal) ? $"https:{best}" : best;
            }
        }

        return map;
    }

    // --- 7TV --------------------------------------------------------------

    private async Task<IReadOnlyDictionary<string, string>> FetchSevenTvAsync(string channelUserId, CancellationToken cancellationToken)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(channelUserId)) return map;

        using var document = await GetJsonAsync(
            $"https://7tv.io/v3/users/twitch/{Uri.EscapeDataString(channelUserId)}",
            cancellationToken).ConfigureAwait(false);

        if (document is null) return map;
        if (!document.RootElement.TryGetProperty("emote_set", out var emoteSet)) return map;
        if (!emoteSet.TryGetProperty("emotes", out var emotes) || emotes.ValueKind != JsonValueKind.Array) return map;

        foreach (var emote in emotes.EnumerateArray())
        {
            var name = emote.TryGetProperty("name", out var n) ? n.GetString() : null;
            var id = emote.TryGetProperty("id", out var i) ? i.GetString() : null;
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(id)) continue;
            map[name] = $"https://cdn.7tv.app/emote/{id}/4x.webp";
        }

        return map;
    }

    public void Dispose()
    {
        if (_ownsHttp) _http.Dispose();
    }
}
