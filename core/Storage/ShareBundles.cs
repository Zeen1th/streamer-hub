using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Storage;

/// <summary>A file of commands and overlay looks one streamer shares with another. It never holds logins, tokens or machine settings.</summary>
public sealed record ShareBundle
{
    public const string FormatName = "streamerhub-share";
    public const int CurrentVersion = 1;

    public string Format { get; init; } = FormatName;
    public int Version { get; init; } = CurrentVersion;
    public string AppVersion { get; init; } = string.Empty;
    public string ExportedAt { get; init; } = string.Empty;
    public List<Counter> Counters { get; init; } = new();
    public List<AutoReply> AutoReplies { get; init; } = new();
    public List<CommandSequence> Sequences { get; init; } = new();
    public List<ChatOverlayInstance> ChatOverlays { get; init; } = new();
}

/// <summary>How many things a bundle holds, or how many were added from it.</summary>
public sealed record ShareCounts(int Counters, int Replies, int Sequences, int Overlays);

/// <param name="Skipped">Items the streamer already had (same content), left alone.</param>
/// <param name="Clashes">Counter commands that are already used by one of the streamer's counters.</param>
public sealed record ShareMergeResult(
    List<Counter> Counters,
    List<AutoReply> AutoReplies,
    List<CommandSequence> Sequences,
    List<ChatOverlayInstance> ChatOverlays,
    ShareCounts Added,
    int Skipped,
    List<string> Clashes);

public static class ShareBundles
{
    private const long MaxBytes = 16 * 1024 * 1024;

    public static ShareBundle Build(
        IEnumerable<Counter> counters,
        IEnumerable<AutoReply> replies,
        IEnumerable<CommandSequence> sequences,
        IEnumerable<ChatOverlayInstance> overlays,
        bool includeCommands,
        bool includeOverlays,
        string appVersion) =>
        new()
        {
            AppVersion = appVersion,
            ExportedAt = DateTime.UtcNow.ToString("o"),
            // A shared counter starts from zero: the number belongs to the streamer who counted it
            Counters = includeCommands ? counters.Select(c => c with { Count = 0 }).ToList() : new(),
            AutoReplies = includeCommands ? replies.ToList() : new(),
            Sequences = includeCommands ? sequences.ToList() : new(),
            ChatOverlays = includeOverlays ? overlays.ToList() : new(),
        };

    public static ShareCounts Count(ShareBundle bundle) =>
        new(bundle.Counters.Count, bundle.AutoReplies.Count, bundle.Sequences.Count, bundle.ChatOverlays.Count);

    public static string Serialize(ShareBundle bundle) =>
        JsonSerializer.Serialize(bundle, new JsonSerializerOptions(Json.Options) { WriteIndented = true });

    /// <summary>Reads a shared file. Anything that is not a StreamerHub share file (or is from a newer app) is refused with a reason.</summary>
    public static bool TryParse(string json, out ShareBundle bundle, out string? error)
    {
        bundle = new ShareBundle();
        error = null;
        try
        {
            if (string.IsNullOrWhiteSpace(json)) { error = "EMPTY FILE"; return false; }
            if (json.Length > MaxBytes) { error = "FILE TOO LARGE"; return false; }
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("format", out var format) ||
                format.ValueKind != JsonValueKind.String ||
                format.GetString() != ShareBundle.FormatName)
            {
                error = "NOT A SHARE FILE";
                return false;
            }
            var parsed = JsonSerializer.Deserialize<ShareBundle>(json, Json.Options);
            if (parsed is null) { error = "NOT A SHARE FILE"; return false; }
            if (parsed.Version > ShareBundle.CurrentVersion) { error = "NEWER VERSION"; return false; }
            bundle = parsed with
            {
                Counters = parsed.Counters ?? new(),
                AutoReplies = parsed.AutoReplies ?? new(),
                Sequences = parsed.Sequences ?? new(),
                ChatOverlays = parsed.ChatOverlays ?? new(),
            };
            return true;
        }
        catch
        {
            error = "NOT A SHARE FILE";
            return false;
        }
    }

    /// <summary>
    /// Works out what the streamer's lists look like after adding a bundle. Nothing the streamer already has is changed:
    /// every imported item gets a fresh id, items they already have are skipped, and imported replies and sequences arrive
    /// switched off so they cannot answer twice or clash with an existing command before the streamer has looked at them.
    /// </summary>
    public static ShareMergeResult Merge(
        IReadOnlyList<Counter> counters,
        IReadOnlyList<AutoReply> replies,
        IReadOnlyList<CommandSequence> sequences,
        IReadOnlyList<ChatOverlayInstance> overlays,
        ShareBundle bundle)
    {
        // Imported items point at each other by id (a sequence can use a counter), so ids are swapped everywhere in the text
        var idMap = new Dictionary<string, string>(StringComparer.Ordinal);
        string Remap(string json)
        {
            foreach (var (oldId, newId) in idMap) json = json.Replace(oldId, newId, StringComparison.Ordinal);
            return json;
        }
        T Reread<T>(T item) => JsonSerializer.Deserialize<T>(Remap(JsonSerializer.Serialize(item, Json.Options)), Json.Options)!;
        string Key<T>(T item) => JsonSerializer.Serialize(item, Json.Options);

        var skipped = 0;
        var clashes = new List<string>();

        // Counters
        var counterIdsByKey = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var c in counters) counterIdsByKey.TryAdd(Key(c with { Id = string.Empty, Count = 0 }), c.Id);
        var usedCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in counters) foreach (var name in CounterCommandNames(c)) usedCommands.Add(name);
        var newCounters = new List<Counter>();
        foreach (var source in bundle.Counters)
        {
            var clean = source with { Count = 0 };
            if (counterIdsByKey.TryGetValue(Key(clean with { Id = string.Empty }), out var existingId))
            {
                // Already there: anything in the bundle that points at it should point at the streamer's own copy
                if (!string.IsNullOrEmpty(source.Id)) idMap[source.Id] = existingId;
                skipped++;
                continue;
            }
            var fresh = clean with { Id = Guid.NewGuid().ToString() };
            if (!string.IsNullOrEmpty(source.Id)) idMap[source.Id] = fresh.Id;
            foreach (var name in CounterCommandNames(fresh))
            {
                if (!usedCommands.Add(name)) clashes.Add($"{fresh.Name}: !{name}");
            }
            newCounters.Add(fresh);
        }

        // Auto replies and sequences: fresh ids, switched off
        var replyKeys = replies.Select(r => Key(r with { Id = string.Empty, Enabled = false })).ToHashSet(StringComparer.Ordinal);
        var newReplies = new List<AutoReply>();
        foreach (var source in bundle.AutoReplies)
        {
            var rebuilt = Reread(source) with { Enabled = false };
            if (!replyKeys.Add(Key(rebuilt with { Id = string.Empty })))
            {
                skipped++;
                continue;
            }
            newReplies.Add(rebuilt with { Id = Guid.NewGuid().ToString() });
        }

        var sequenceKeys = sequences.Select(s => Key(s with { Id = string.Empty, Enabled = false })).ToHashSet(StringComparer.Ordinal);
        var newSequences = new List<CommandSequence>();
        foreach (var source in bundle.Sequences)
        {
            var rebuilt = Reread(source) with { Enabled = false };
            var key = Key(rebuilt with { Id = string.Empty });
            if (!sequenceKeys.Add(key))
            {
                skipped++;
                continue;
            }
            newSequences.Add(rebuilt with { Id = Guid.NewGuid().ToString() });
        }

        // Overlay looks arrive as extra overlays; the main overlay is never replaced
        var overlayNames = overlays.Select(o => o.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var overlayKeys = overlays.Select(o => Key(o.Settings)).ToHashSet(StringComparer.Ordinal);
        var newOverlays = new List<ChatOverlayInstance>();
        foreach (var source in bundle.ChatOverlays)
        {
            if (!overlayKeys.Add(Key(source.Settings)))
            {
                skipped++;
                continue;
            }
            var baseName = string.IsNullOrWhiteSpace(source.Name) ? "Chat overlay" : source.Name.Trim();
            var name = baseName;
            for (var n = 1; !overlayNames.Add(name); n++) name = n == 1 ? $"{baseName} (shared)" : $"{baseName} (shared {n})";
            newOverlays.Add(source with { Id = Guid.NewGuid().ToString(), IsMain = false, Name = name });
        }

        return new ShareMergeResult(
            counters.Concat(newCounters).ToList(),
            replies.Concat(newReplies).ToList(),
            sequences.Concat(newSequences).ToList(),
            overlays.Concat(newOverlays).ToList(),
            new ShareCounts(newCounters.Count, newReplies.Count, newSequences.Count, newOverlays.Count),
            skipped,
            clashes);
    }

    private static IEnumerable<string> CounterCommandNames(Counter c)
    {
        foreach (var name in new[] { c.Commands.Increase.CommandName, c.Commands.Decrease.CommandName, c.Commands.Reset.CommandName })
        {
            var clean = (name ?? string.Empty).Trim().TrimStart('!');
            if (clean.Length > 0) yield return clean;
        }
        if (c.Commands.Set.Enabled)
        {
            var clean = (c.Commands.Set.CommandName ?? string.Empty).Trim().TrimStart('!');
            if (clean.Length > 0) yield return clean;
        }
    }
}
