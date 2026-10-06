using System.Text.Json;
using System.Text.RegularExpressions;

namespace StreamerHub.Core.Media;

public sealed record AlertTempSettings(bool KeepTempFiles = false, string? Directory = null);

/// <summary>
/// Owns the staging area for videos dropped into Alert Studio. Staged copies are named
/// "{guid32}_{original}" and are deleted by default; the user can opt to keep them and can
/// pick the folder. Only files with that exact naming pattern are ever deleted, so a user
/// folder choice can never cause unrelated files to be removed.
/// </summary>
public static class AlertTempStore
{
    private static readonly Regex OwnedName = new(@"^[0-9a-f]{32}_", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly object Gate = new();
    private static string _settingsPath = string.Empty;
    private static AlertTempSettings _settings = new();

    public static string DefaultDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamerHub", "TempAlerts");

    public static void Initialize(string appData)
    {
        lock (Gate)
        {
            _settingsPath = Path.Combine(appData, "alert-temp.json");
            try
            {
                if (File.Exists(_settingsPath))
                {
                    _settings = JsonSerializer.Deserialize<AlertTempSettings>(File.ReadAllText(_settingsPath),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AlertTempSettings();
                }
            }
            catch
            {
                _settings = new AlertTempSettings();
            }
        }

        // Clean leftovers from the previous session, and again on a normal exit
        Sweep();
        AppDomain.CurrentDomain.ProcessExit += (_, _) => Sweep();
    }

    public static AlertTempSettings Get()
    {
        lock (Gate) return _settings;
    }

    public static string EffectiveDirectory()
    {
        var dir = Get().Directory;
        return string.IsNullOrWhiteSpace(dir) ? DefaultDirectory : dir;
    }

    public static AlertTempSettings Set(bool keep, string? directory)
    {
        var dir = string.IsNullOrWhiteSpace(directory) ? null : directory.Trim();
        if (dir is not null)
        {
            // Reject folders we can't create/write to rather than failing on the next drop
            Directory.CreateDirectory(dir);
            var probe = Path.Combine(dir, $".write-test-{Guid.NewGuid():N}");
            File.WriteAllText(probe, string.Empty);
            File.Delete(probe);
        }

        lock (Gate)
        {
            _settings = new AlertTempSettings(keep, dir);
            try
            {
                if (!string.IsNullOrEmpty(_settingsPath))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath)!);
                    File.WriteAllText(_settingsPath, JsonSerializer.Serialize(_settings));
                }
            }
            catch
            {
                // settings still apply for this session
            }
            return _settings;
        }
    }

    /// <summary>Reserve a path for a newly staged file in the configured folder.</summary>
    public static string NewTempPath(string fileName)
    {
        string dir;
        try
        {
            dir = EffectiveDirectory();
            Directory.CreateDirectory(dir);
        }
        catch
        {
            dir = DefaultDirectory;
            Directory.CreateDirectory(dir);
        }
        return Path.Combine(dir, $"{Guid.NewGuid():N}_{Path.GetFileName(fileName)}");
    }

    public static string StripPrefix(string fileName) => OwnedName.Replace(fileName, string.Empty, 1);

    private static bool SameDir(string? a, string? b)
    {
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) return false;
        return string.Equals(
            Path.GetFullPath(a).TrimEnd('\\', '/'),
            Path.GetFullPath(b).TrimEnd('\\', '/'),
            StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsStagedFile(string path)
    {
        try
        {
            if (!OwnedName.IsMatch(Path.GetFileName(path))) return false;
            var dir = Path.GetDirectoryName(Path.GetFullPath(path));
            return SameDir(dir, EffectiveDirectory()) || SameDir(dir, DefaultDirectory);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>True when a folder is one of our staging folders (outputs must never default there).</summary>
    public static bool IsStagingDirectory(string? dir) =>
        SameDir(dir, EffectiveDirectory()) || SameDir(dir, DefaultDirectory);

    /// <summary>Delete one staged file unless the user chose to keep temp files.</summary>
    public static bool Discard(string path)
    {
        if (Get().KeepTempFiles || !IsStagedFile(path)) return false;
        try
        {
            File.Delete(path);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Delete every staged file (guid-prefixed only) in the staging folders.</summary>
    public static void Sweep()
    {
        if (Get().KeepTempFiles) return;
        foreach (var dir in new[] { EffectiveDirectory(), DefaultDirectory }.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                if (!Directory.Exists(dir)) continue;
                foreach (var file in Directory.EnumerateFiles(dir))
                {
                    if (!OwnedName.IsMatch(Path.GetFileName(file))) continue;
                    try { File.Delete(file); } catch { /* in use; next sweep */ }
                }
            }
            catch
            {
                // folder unavailable
            }
        }
    }
}
