using System.Text;
using System.Text.Json;

namespace StreamerHub.Core.Storage;

/// <summary>One restorable copy of the leaderboard stats shown in Settings > Backups.</summary>
/// <param name="Name">Stable id passed back to <see cref="StatsBackupStore.Restore"/>.</param>
public sealed record StatsBackupInfo(string Name, string Kind, DateTime ModifiedUtc, int Users, long Bytes);

/// <summary>
/// The host's copy of the page's stats (leaderboards), so clearing the web view's storage cannot lose them.
/// stats.json sits next to settings.json, written through a temp file; the previous copy is stats.json.bak.
/// backups/ keeps one snapshot per day (last 7) and a copy taken before every leaderboard reset (last 5).
/// </summary>
public sealed class StatsBackupStore
{
    public const int MaxBytes = 8 * 1024 * 1024;
    public const int MaxDailySnapshots = 7;
    public const int MaxBeforeResetCopies = 5;
    private const string DailyPrefix = "stats-";
    private const string ResetPrefix = "stats-before-reset-";
    private const string ResetEverythingPrefix = "stats-before-reset-everything-";

    private readonly string _dir;
    private readonly string _filePath;
    private readonly string _bakPath;
    private readonly string _snapshotDir;
    private readonly Func<DateTime> _now;
    private readonly object _lock = new();

    public StatsBackupStore(string directory, Func<DateTime>? now = null)
    {
        _dir = directory;
        _filePath = Path.Combine(directory, "stats.json");
        _bakPath = _filePath + ".bak";
        _snapshotDir = Path.Combine(directory, "backups");
        _now = now ?? (() => DateTime.Now);
    }

    /// <summary>Stores the page's stats JSON. reason "reset" only keeps a before-reset copy; anything else replaces stats.json.</summary>
    public bool Save(string? json, string? reason, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(json)) { error = "EMPTY"; return false; }
        if (Encoding.UTF8.GetByteCount(json) > MaxBytes) { error = "TOO LARGE"; return false; }
        if (!TryCountUsers(json, out var users)) { error = "INVALID"; return false; }
        lock (_lock)
        {
            try
            {
                Directory.CreateDirectory(_dir);
                if (string.Equals(reason, "reset", StringComparison.OrdinalIgnoreCase))
                {
                    if (users > 0) KeepCopy(json, ResetPrefix + _now().ToString("yyyyMMdd-HHmmss") + ".json", ResetPrefix, MaxBeforeResetCopies, ResetEverythingPrefix);
                    return true;
                }

                var tmp = _filePath + ".tmp";
                WriteDurably(tmp, json);
                // Keep the last good file before replacing it (a damaged file never overwrites a good .bak)
                if (File.Exists(_filePath) && TryReadFile(_filePath, out _, out _))
                {
                    try { File.Copy(_filePath, _bakPath, overwrite: true); } catch { }
                }
                File.Move(tmp, _filePath, overwrite: true);
                if (users > 0) DailySnapshot(json);
                return true;
            }
            catch
            {
                error = "WRITE FAILED";
                return false;
            }
        }
    }

    /// <summary>The newest usable copy: stats.json, else stats.json.bak, else the newest daily snapshot. Null when there is none.</summary>
    public string? Load()
    {
        lock (_lock)
        {
            if (TryReadFile(_filePath, out var json, out _)) return json;
            if (TryReadFile(_bakPath, out json, out _)) return json;
            foreach (var (_, _, path) in Enumerate().Where(f => f.Kind == "daily").OrderByDescending(f => f.Name, StringComparer.Ordinal))
            {
                if (TryReadFile(path, out json, out _)) return json;
            }
            return null;
        }
    }

    /// <summary>Snapshots that can be restored from Settings > Backups, newest first.</summary>
    public IReadOnlyList<StatsBackupInfo> List()
    {
        lock (_lock)
        {
            var found = new List<StatsBackupInfo>();
            foreach (var (name, kind, path) in Enumerate())
            {
                if (!TryReadFile(path, out _, out var users)) continue;
                long bytes = 0;
                try { bytes = new FileInfo(path).Length; } catch { }
                found.Add(new StatsBackupInfo(name, kind, File.GetLastWriteTimeUtc(path), users, bytes));
            }
            return found.OrderByDescending(b => b.ModifiedUtc).ThenByDescending(b => b.Name, StringComparer.Ordinal).ToList();
        }
    }

    /// <summary>Returns the JSON of a listed snapshot. The page loads it into its own storage and the next save makes it the live copy.</summary>
    public bool Restore(string? name, out string? json, out string? error)
    {
        json = null;
        error = null;
        lock (_lock)
        {
            var match = Enumerate().FirstOrDefault(f => string.Equals(f.Name, name, StringComparison.Ordinal));
            if (match.Path is null) { error = "BACKUP NOT FOUND"; return false; }
            if (!TryReadFile(match.Path, out json, out _)) { json = null; error = "BACKUP UNREADABLE"; return false; }
            return true;
        }
    }

    /// <summary>
    /// Settings > System > Reset everything: stats.json and its .bak move into backups/ so the automatic restore at the next
    /// start does not bring the leaderboards back. Best effort.
    /// </summary>
    public void MoveAsideForReset()
    {
        lock (_lock)
        {
            try
            {
                Directory.CreateDirectory(_snapshotDir);
                var stamp = _now().ToString("yyyyMMdd-HHmmss");
                var target = Path.Combine(_snapshotDir, $"{ResetEverythingPrefix}{stamp}.json");
                var moved = false;
                if (File.Exists(_filePath))
                {
                    File.Move(_filePath, target, overwrite: true);
                    moved = true;
                }
                if (File.Exists(_bakPath))
                {
                    if (moved) File.Delete(_bakPath);
                    else File.Move(_bakPath, target, overwrite: true);
                }
                Prune(ResetEverythingPrefix, MaxBeforeResetCopies, null);
            }
            catch
            {
                // the reset itself must still succeed
            }
        }
    }

    private void DailySnapshot(string json)
    {
        KeepCopy(json, DailyPrefix + _now().ToString("yyyyMMdd") + ".json", null, MaxDailySnapshots, null, daily: true);
    }

    private void KeepCopy(string json, string fileName, string? prefix, int keep, string? excludePrefix, bool daily = false)
    {
        Directory.CreateDirectory(_snapshotDir);
        WriteDurably(Path.Combine(_snapshotDir, fileName), json);
        if (daily) PruneDaily();
        else Prune(prefix!, keep, excludePrefix);
    }

    private void PruneDaily()
    {
        foreach (var old in Directory.GetFiles(_snapshotDir, DailyPrefix + "*.json")
                     .Where(f => IsDailyName(Path.GetFileName(f)))
                     .OrderByDescending(f => f, StringComparer.Ordinal).Skip(MaxDailySnapshots))
        {
            try { File.Delete(old); } catch { }
        }
    }

    private void Prune(string prefix, int keep, string? excludePrefix)
    {
        foreach (var old in Directory.GetFiles(_snapshotDir, prefix + "*.json")
                     .Where(f => excludePrefix is null || !Path.GetFileName(f).StartsWith(excludePrefix, StringComparison.Ordinal))
                     .OrderByDescending(f => f, StringComparer.Ordinal).Skip(keep))
        {
            try { File.Delete(old); } catch { }
        }
    }

    /// <summary>stats-YYYYMMDD.json</summary>
    private static bool IsDailyName(string fileName) =>
        fileName.Length == "stats-YYYYMMDD.json".Length && fileName.StartsWith(DailyPrefix, StringComparison.Ordinal)
        && fileName.Skip(DailyPrefix.Length).Take(8).All(char.IsDigit);

    private IEnumerable<(string Name, string Kind, string Path)> Enumerate()
    {
        if (File.Exists(_bakPath)) yield return ("stats.json.bak", "last", _bakPath);
        string[] files;
        try { files = Directory.Exists(_snapshotDir) ? Directory.GetFiles(_snapshotDir, "stats-*.json") : Array.Empty<string>(); }
        catch { files = Array.Empty<string>(); }
        foreach (var file in files)
        {
            var fileName = Path.GetFileName(file);
            var kind = fileName.StartsWith(ResetEverythingPrefix, StringComparison.Ordinal) ? "before-reset-everything"
                : fileName.StartsWith(ResetPrefix, StringComparison.Ordinal) ? "before-reset"
                : IsDailyName(fileName) ? "daily"
                : null;
            if (kind is not null) yield return ("backups/" + fileName, kind, file);
        }
    }

    private static bool TryReadFile(string path, out string json, out int users)
    {
        json = string.Empty;
        users = 0;
        try
        {
            if (!File.Exists(path)) return false;
            var text = File.ReadAllText(path, Encoding.UTF8);
            if (!TryCountUsers(text, out users)) return false;
            json = text;
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Valid JSON object; users is the number of viewers in its all-time table.</summary>
    private static bool TryCountUsers(string json, out int users)
    {
        users = 0;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return false;
            if (doc.RootElement.TryGetProperty("allTime", out var all) && all.ValueKind == JsonValueKind.Object)
                users = all.EnumerateObject().Count();
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void WriteDurably(string path, string content)
    {
        var bytes = new UTF8Encoding(false).GetBytes(content);
        using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush(true);
    }
}
