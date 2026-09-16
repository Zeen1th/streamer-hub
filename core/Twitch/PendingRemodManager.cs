using System.Text.Json;

namespace StreamerHub.Core.Twitch;

public sealed record PendingRemodEntry
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N");
    public string BroadcasterId { get; init; } = string.Empty;
    public string TargetUserId { get; init; } = string.Empty;
    public string TargetLogin { get; init; } = string.Empty;
    public bool WasLeadMod { get; init; }
    public DateTime RemodAtUtc { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAtUtc { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Manages pending moderator re-elevation jobs with disk persistence and progressive backoff retries.
/// Prevents mods and lead mods from losing mod privileges due to Twitch API propagation races,
/// rate limits, temporary ban expiration delays, or Streamer Hub application restarts.
/// </summary>
public sealed class PendingRemodManager
{
    public const int MaxAttempts = 12;

    private readonly string _storagePath;
    private readonly object _lock = new();
    private readonly List<PendingRemodEntry> _entries = new();

    public int Count
    {
        get
        {
            lock (_lock) return _entries.Count;
        }
    }

    public PendingRemodManager(string? storagePath = null)
    {
        _storagePath = !string.IsNullOrWhiteSpace(storagePath)
            ? storagePath
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "StreamerHub",
                "pending_remods.json");

        Load();
    }

    public void Enqueue(string broadcasterId, string targetUserId, string targetLogin, DateTime remodAtUtc, bool wasLeadMod = false)
    {
        lock (_lock)
        {
            // If an entry for the same user already exists, update it to the later time
            var existing = _entries.FirstOrDefault(e =>
                string.Equals(e.BroadcasterId, broadcasterId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(e.TargetUserId, targetUserId, StringComparison.OrdinalIgnoreCase));

            if (existing != null)
            {
                if (remodAtUtc > existing.RemodAtUtc)
                {
                    existing.RemodAtUtc = remodAtUtc;
                }
                existing.Attempts = 0;
            }
            else
            {
                _entries.Add(new PendingRemodEntry
                {
                    BroadcasterId = broadcasterId,
                    TargetUserId = targetUserId,
                    TargetLogin = targetLogin,
                    WasLeadMod = wasLeadMod,
                    RemodAtUtc = remodAtUtc,
                    Attempts = 0,
                    CreatedAtUtc = DateTime.UtcNow,
                });
            }

            SaveInternal();
        }
    }

    public IReadOnlyList<PendingRemodEntry> GetDueEntries(DateTime? nowUtc = null)
    {
        var now = nowUtc ?? DateTime.UtcNow;
        lock (_lock)
        {
            return _entries.Where(e => now >= e.RemodAtUtc).ToList();
        }
    }

    public IReadOnlyList<PendingRemodEntry> GetAllEntries()
    {
        lock (_lock)
        {
            return _entries.ToList();
        }
    }

    public bool Remove(string id)
    {
        lock (_lock)
        {
            var removed = _entries.RemoveAll(e => e.Id == id) > 0;
            if (removed)
            {
                SaveInternal();
            }
            return removed;
        }
    }

    public TimeSpan CalculateNextBackoff(int attempt)
    {
        return attempt switch
        {
            1 => TimeSpan.FromSeconds(3),
            2 => TimeSpan.FromSeconds(6),
            3 => TimeSpan.FromSeconds(12),
            4 => TimeSpan.FromSeconds(20),
            _ => TimeSpan.FromSeconds(30),
        };
    }

    public bool RecordRetry(string id, string? lastError = null)
    {
        lock (_lock)
        {
            var item = _entries.FirstOrDefault(e => e.Id == id);
            if (item == null) return false;

            item.Attempts++;
            if (item.Attempts >= MaxAttempts)
            {
                _entries.Remove(item);
                SaveInternal();
                return false; // Abandoned
            }

            var backoff = CalculateNextBackoff(item.Attempts);
            item.RemodAtUtc = DateTime.UtcNow.Add(backoff);
            SaveInternal();
            return true; // Scheduled for retry
        }
    }

    public async Task ProcessDueRemodsAsync(
        Func<string, CancellationToken, Task<(bool Ok, bool IsMod, string? Error)>> checkModAsync,
        Func<string, CancellationToken, Task<(bool Ok, string? Error)>> modUserAsync,
        Func<PendingRemodEntry, bool, string?, Task> onResultAsync,
        CancellationToken cancellationToken = default)
    {
        var due = GetDueEntries();
        if (due.Count == 0) return;

        foreach (var item in due)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                // First check if they already have moderator status (e.g. from manual assignment or previous run)
                var (checkOk, isMod, _) = await checkModAsync(item.TargetUserId, cancellationToken).ConfigureAwait(false);
                if (checkOk && isMod)
                {
                    Remove(item.Id);
                    await onResultAsync(item, true, null).ConfigureAwait(false);
                    continue;
                }

                // Attempt to grant moderator privileges
                var (modOk, modErr) = await modUserAsync(item.TargetUserId, cancellationToken).ConfigureAwait(false);
                if (modOk)
                {
                    Remove(item.Id);
                    await onResultAsync(item, true, null).ConfigureAwait(false);
                }
                else
                {
                    var stillHasAttempts = RecordRetry(item.Id, modErr);
                    if (stillHasAttempts)
                    {
                        var nextBackoff = CalculateNextBackoff(item.Attempts);
                        await onResultAsync(item, false, $"FAILED_TEMPORARILY_WILL_RETRY (attempt {item.Attempts}/{MaxAttempts}, next in {nextBackoff.TotalSeconds}s): {modErr}").ConfigureAwait(false);
                    }
                    else
                    {
                        await onResultAsync(item, false, $"MAX_ATTEMPTS_EXCEEDED: {modErr}").ConfigureAwait(false);
                    }
                }
            }
            catch (Exception ex)
            {
                var stillHasAttempts = RecordRetry(item.Id, ex.Message);
                await onResultAsync(item, false, $"EXCEPTION (attempt {item.Attempts}/{MaxAttempts}): {ex.Message}").ConfigureAwait(false);
            }
        }
    }

    public void Load()
    {
        lock (_lock)
        {
            try
            {
                if (!File.Exists(_storagePath)) return;
                var json = File.ReadAllText(_storagePath);
                var loaded = JsonSerializer.Deserialize<List<PendingRemodEntry>>(json);
                if (loaded != null)
                {
                    _entries.Clear();
                    _entries.AddRange(loaded);
                }
            }
            catch
            {
                // In corrupted file scenario, start fresh to prevent crash
            }
        }
    }

    private void SaveInternal()
    {
        try
        {
            var dir = Path.GetDirectoryName(_storagePath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var json = JsonSerializer.Serialize(_entries, new JsonSerializerOptions { WriteIndented = true });
            var tempPath = _storagePath + ".tmp";
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, _storagePath, overwrite: true);
        }
        catch
        {
            // Disk persistence failures must not crash the in-memory execution
        }
    }
}
