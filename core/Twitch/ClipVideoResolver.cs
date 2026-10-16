using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace StreamerHub.Core.Twitch;

/// <summary>
/// Finds the best video file of a clip (1080p when it exists). Helix only returns a preview picture, and the
/// file derived from it is 360p, so this asks the same endpoint Twitch's own clip page uses. It is not an
/// official API: any failure returns null and the caller falls back to the lower quality link or the embed.
/// </summary>
public static class ClipVideoResolver
{
    private const string Endpoint = "https://gql.twitch.tv/gql";
    private const string WebClientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";
    private const string ClipTokenQueryHash = "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(8) };

    public static async Task<string?> ResolveBestAsync(string clipId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(clipId)) return null;
        try
        {
            var body = JsonSerializer.Serialize(new[]
            {
                new
                {
                    operationName = "VideoAccessToken_Clip",
                    variables = new { slug = clipId, platform = "web" },
                    extensions = new { persistedQuery = new { version = 1, sha256Hash = ClipTokenQueryHash } },
                },
            });
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = new StringContent(body, Encoding.UTF8, new MediaTypeHeaderValue("application/json")),
            };
            request.Headers.Add("Client-ID", WebClientId);
            using var response = await Http.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;
            return BestVideoUrl(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }

    /// <summary>Highest quality file from the access-token response, with its signed query attached.</summary>
    public static string? BestVideoUrl(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.ValueKind == JsonValueKind.Array) root = root.EnumerateArray().FirstOrDefault();
        if (root.ValueKind != JsonValueKind.Object) return null;
        if (!root.TryGetProperty("data", out var data) || !data.TryGetProperty("clip", out var clip) || clip.ValueKind != JsonValueKind.Object) return null;
        if (!clip.TryGetProperty("playbackAccessToken", out var access) || access.ValueKind != JsonValueKind.Object) return null;

        var signature = access.TryGetProperty("signature", out var sig) ? sig.GetString() : null;
        var token = access.TryGetProperty("value", out var value) ? value.GetString() : null;
        if (string.IsNullOrWhiteSpace(signature) || string.IsNullOrWhiteSpace(token)) return null;
        if (!clip.TryGetProperty("videoQualities", out var qualities) || qualities.ValueKind != JsonValueKind.Array) return null;

        string? bestUrl = null;
        var bestHeight = -1;
        foreach (var quality in qualities.EnumerateArray())
        {
            var url = quality.TryGetProperty("sourceURL", out var src) ? src.GetString() : null;
            if (string.IsNullOrWhiteSpace(url)) continue;
            var height = quality.TryGetProperty("quality", out var q) && int.TryParse(q.GetString(), out var h) ? h : 0;
            if (height > bestHeight)
            {
                bestHeight = height;
                bestUrl = url;
            }
        }

        return bestUrl is null ? null : $"{bestUrl}?sig={signature}&token={Uri.EscapeDataString(token)}";
    }
}
