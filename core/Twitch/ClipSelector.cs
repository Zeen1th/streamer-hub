using System.Text.RegularExpressions;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Twitch;

/// <summary>Chooses which clip of a channel the clip sub-action plays. Pure, so it can be tested without Twitch.</summary>
public static partial class ClipSelector
{
    /// <summary>Start of the look-back window for a period name, or null for "all time".</summary>
    public static DateTimeOffset? PeriodStart(string? period, DateTimeOffset now) =>
        period?.Trim().ToLowerInvariant() switch
        {
            "week" => now.AddDays(-7),
            "year" => now.AddDays(-365),
            "all" => null,
            _ => now.AddDays(-30),
        };

    /// <summary>
    /// Picks one clip. Clips that fit in <paramref name="maxSeconds"/> are preferred so a clip is rarely cut off;
    /// when none fit, any clip may be chosen (the overlay stops it at the cap).
    /// </summary>
    public static TwitchClipInfo? Pick(IReadOnlyList<TwitchClipInfo> clips, string? selection, int maxSeconds, Random? random = null)
    {
        if (clips.Count == 0) return null;

        var cap = Math.Max(1, maxSeconds);
        var fitting = clips.Where(c => c.DurationSeconds <= cap).ToList();
        IReadOnlyList<TwitchClipInfo> pool = fitting.Count > 0 ? fitting : clips;

        return selection?.Trim().ToLowerInvariant() switch
        {
            "random" => pool[(random ?? Random.Shared).Next(pool.Count)],
            "recent" => pool.OrderByDescending(c => c.CreatedAt).First(),
            _ => pool.OrderByDescending(c => c.ViewCount).First(),
        };
    }

    /// <summary>
    /// Direct video file for a clip, derived from its preview thumbnail (".../ID-preview-480x272.jpg" -> ".../ID.mp4").
    /// Null when the thumbnail has another shape; the overlay then falls back to Twitch's embedded player.
    /// </summary>
    public static string? DirectVideoUrl(string? thumbnailUrl)
    {
        if (string.IsNullOrWhiteSpace(thumbnailUrl)) return null;
        var match = LegacyPreview().Match(thumbnailUrl.Trim());
        return match.Success ? match.Groups[1].Value + ".mp4" : null;
    }

    [GeneratedRegex(@"^(https://.+?)-preview-\d+x\d+\.(?:jpe?g|png)$", RegexOptions.IgnoreCase)]
    private static partial Regex LegacyPreview();
}
