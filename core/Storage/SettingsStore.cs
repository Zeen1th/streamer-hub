using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Storage;

public sealed record WindowSettings
{
    public int X { get; init; } = int.MinValue;
    public int Y { get; init; } = int.MinValue;
    public int Width { get; init; } = 1280;
    public int Height { get; init; } = 800;
    public bool Maximized { get; init; }
    /// <summary>Set once the one-time move off the old 1280x800 default has been considered.</summary>
    public bool SizeUpgraded { get; init; }
}

public sealed record ObsSettings
{
    public string Host { get; init; } = "127.0.0.1";
    public int Port { get; init; } = 4455;
    public string Password { get; init; } = string.Empty;
    public bool AutoConnect { get; init; } = true;
}

/// <summary>What happened when settings.json could not be used at startup.</summary>
/// <param name="RestoredFrom">File the settings were restored from, or null when nothing could be restored.</param>
/// <param name="SavedAs">Where the unreadable settings.json was kept, or null when the file was simply missing.</param>
public sealed record SettingsRecovery(string? RestoredFrom, string? SavedAs);

/// <summary>One restorable copy of settings.json shown in Settings > Backups.</summary>
/// <param name="Name">Stable id passed back to <see cref="SettingsStore.RestoreBackup"/>.</param>
/// <param name="Kind">last, pending, snapshot or before-restore.</param>
public sealed record SettingsBackupInfo(string Name, string Kind, DateTime ModifiedUtc, int Counters, int Replies, int Sequences, int Keybinds, long Bytes);

public sealed class SettingsStore : IDisposable
{
    private const int MaxBeforeRestoreCopies = 5;
    private const int MaxSnapshots = 8;
    private const int MaxCorruptCopies = 5;
    private static readonly TimeSpan SnapshotEvery = TimeSpan.FromHours(6);

    private sealed record SettingsDocument
    {
        public List<Counter> Counters { get; init; } = new();
        public List<AutoReply> AutoReplies { get; init; } = new();
        public List<CommandSequence> Sequences { get; init; } = new();
        public List<ActionKeybind> Keybinds { get; init; } = new();
        public AutoReplySettings AutoReplySettings { get; init; } = new();
        public TwitchSettings Twitch { get; init; } = new();
        public ChatOverlaySettings ChatOverlay { get; init; } = new();
        public List<ChatOverlayInstance> ChatOverlays { get; init; } = new();
        public ChatOverlaySettings ObsChat { get; init; } = new();
        public WindowSettings Window { get; init; } = new();
        public ObsSettings Obs { get; init; } = new();
        public string Language { get; init; } = string.Empty;
        public bool BotAccountEnabled { get; init; }
        public string PreferredChatSender { get; init; } = "bot";
        public bool StartupEnabled { get; init; } = true;
        public bool? CloseToTray { get; init; }
        public PollState ActivePoll { get; init; } = new();
        /// <summary>Every command profile. The active one is also held in the top-level lists above, which are what the rest of the host reads.</summary>
        public List<CommandProfile> Profiles { get; init; } = new();
        public string ActiveProfileId { get; init; } = string.Empty;
        /// <summary>Set once the Starter profile has been added, so deleting it does not bring it back.</summary>
        public bool StarterSeeded { get; init; }
    }

    private const int MaxProfileNameLength = 40;

    private readonly string _filePath;
    private readonly string _backupPath;
    private readonly string _snapshotDir;
    private readonly object _lock = new();
    private SettingsRecovery? _recovery;
    private readonly System.Threading.Timer _debounce;
    private SettingsDocument _document;

    public SettingsStore(string filePath)
    {
        _filePath = filePath;
        _backupPath = filePath + ".bak";
        _snapshotDir = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(filePath)) ?? ".", "backups");
        _document = Load();
        _debounce = new System.Threading.Timer(_ => Flush(), null, Timeout.Infinite, Timeout.Infinite);
        AppDomain.CurrentDomain.ProcessExit += OnProcessExit;
    }

    private void OnProcessExit(object? sender, EventArgs e)
    {
        try { Flush(); } catch { }
    }

    public IReadOnlyList<Counter> Counters
    {
        get { lock (_lock) return _document.Counters; }
    }

    public IReadOnlyList<AutoReply> AutoReplies
    {
        get { lock (_lock) return _document.AutoReplies; }
    }

    public IReadOnlyList<CommandSequence> Sequences
    {
        get { lock (_lock) return _document.Sequences; }
    }

    public IReadOnlyList<ActionKeybind> Keybinds
    {
        get { lock (_lock) return _document.Keybinds; }
    }

    public void SetKeybinds(IReadOnlyList<ActionKeybind> bindings)
    {
        lock (_lock) _document = _document with { Keybinds = bindings.ToList() };
        ScheduleSave();
    }

    public string ActiveProfileId
    {
        get { lock (_lock) return _document.ActiveProfileId; }
    }

    public bool StarterSeeded
    {
        get { lock (_lock) return _document.StarterSeeded; }
    }

    public ProfilesState GetProfilesState()
    {
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            return new ProfilesState(
                doc.Profiles.Select(p => new ProfileSummary(p.Id, p.Name, p.Counters.Count, p.AutoReplies.Count, p.Sequences.Count, p.Keybinds.Count)).ToList(),
                doc.ActiveProfileId,
                doc.StarterSeeded);
        }
    }

    /// <summary>
    /// Makes another profile the live one: what is live is first saved into its own profile, then the target's commands become
    /// the top-level lists and everything is written to disk. Nothing from either profile is lost.
    /// </summary>
    public bool SwitchProfile(string id)
    {
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            var target = doc.Profiles.FirstOrDefault(p => p.Id == id);
            if (target is null) return false;
            _document = MakeActive(doc, target);
        }
        Flush();
        return true;
    }

    /// <summary>A new empty profile (not switched to). Returns its id, or null when the name is empty.</summary>
    public string? AddProfile(string name)
    {
        var clean = CleanProfileName(name);
        if (clean is null) return null;
        var profile = new CommandProfile { Id = Guid.NewGuid().ToString(), Name = clean };
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            _document = doc with { Profiles = doc.Profiles.Append(profile).ToList() };
        }
        Flush();
        return profile.Id;
    }

    /// <summary>A copy of a profile under a new name (not switched to). The copy keeps the same command ids: only one profile is live at a time.</summary>
    public string? DuplicateProfile(string id, string name)
    {
        var clean = CleanProfileName(name);
        if (clean is null) return null;
        string newId;
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            var source = doc.Profiles.FirstOrDefault(p => p.Id == id);
            if (source is null) return null;
            newId = Guid.NewGuid().ToString();
            var copy = source with
            {
                Id = newId,
                Name = clean,
                Counters = source.Counters.ToList(),
                AutoReplies = source.AutoReplies.ToList(),
                Sequences = source.Sequences.ToList(),
                Keybinds = source.Keybinds.ToList(),
            };
            _document = doc with { Profiles = doc.Profiles.Append(copy).ToList() };
        }
        Flush();
        return newId;
    }

    public bool RenameProfile(string id, string name)
    {
        var clean = CleanProfileName(name);
        if (clean is null) return false;
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            if (!doc.Profiles.Any(p => p.Id == id)) return false;
            _document = doc with { Profiles = doc.Profiles.Select(p => p.Id == id ? p with { Name = clean } : p).ToList() };
        }
        Flush();
        return true;
    }

    /// <summary>
    /// Deletes a profile; the last one cannot be deleted. Deleting the live profile switches to its neighbour
    /// (<paramref name="activeChanged"/> tells the caller to reload the commands).
    /// </summary>
    public bool DeleteProfile(string id, out bool activeChanged)
    {
        activeChanged = false;
        lock (_lock)
        {
            var doc = WithActiveProfileSynced(_document);
            var index = doc.Profiles.FindIndex(p => p.Id == id);
            if (index < 0 || doc.Profiles.Count <= 1) return false;
            var remaining = doc.Profiles.Where(p => p.Id != id).ToList();
            doc = doc with { Profiles = remaining };
            if (doc.ActiveProfileId == id)
            {
                activeChanged = true;
                doc = MakeActive(doc, remaining[Math.Min(Math.Max(index - 1, 0), remaining.Count - 1)]);
            }
            _document = doc;
        }
        Flush();
        return true;
    }

    /// <summary>
    /// Adds the Starter profile once (the page builds it in the app language). A streamer with no commands yet gets it as the
    /// live profile; everyone else gets it next to their own, not switched to. Does nothing when it was already added.
    /// </summary>
    public bool SeedStarter(CommandProfile starter, out bool activated)
    {
        activated = false;
        var clean = CleanProfileName(starter.Name);
        if (clean is null) return false;
        lock (_lock)
        {
            if (_document.StarterSeeded) return false;
            var doc = WithActiveProfileSynced(_document);
            var entry = starter with { Id = Guid.NewGuid().ToString(), Name = clean };
            if (doc.Profiles.All(IsEmptyProfile))
            {
                // Nothing to protect yet: Starter replaces the empty placeholder profile and is live straight away
                doc = doc with { Profiles = new List<CommandProfile> { entry }, StarterSeeded = true };
                _document = MakeActive(doc, entry);
                activated = true;
            }
            else
            {
                _document = doc with { Profiles = doc.Profiles.Append(entry).ToList(), StarterSeeded = true };
            }
        }
        Flush();
        return true;
    }

    private static string? CleanProfileName(string? name)
    {
        var clean = string.Join(' ', (name ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (clean.Length == 0) return null;
        return clean.Length > MaxProfileNameLength ? clean[..MaxProfileNameLength].TrimEnd() : clean;
    }

    /// <summary>Whether any profile (not just the live one) holds a command worth backing up.</summary>
    private static bool HasCommands(SettingsDocument doc) =>
        doc.Counters.Count + doc.AutoReplies.Count + doc.Sequences.Count + doc.Keybinds.Count > 0 || doc.Profiles.Any(p => !IsEmptyProfile(p));

    private static bool IsEmptyProfile(CommandProfile p) =>
        p.Counters.Count + p.AutoReplies.Count + p.Sequences.Count + p.Keybinds.Count == 0;

    /// <summary>The document with the live commands written back into the active profile's entry.</summary>
    private static SettingsDocument WithActiveProfileSynced(SettingsDocument doc)
    {
        if (!doc.Profiles.Any(p => p.Id == doc.ActiveProfileId)) return doc;
        return doc with
        {
            Profiles = doc.Profiles.Select(p => p.Id == doc.ActiveProfileId
                ? p with { Counters = doc.Counters, AutoReplies = doc.AutoReplies, Sequences = doc.Sequences, Keybinds = doc.Keybinds }
                : p).ToList(),
        };
    }

    /// <summary>The document with this profile's commands as the live (top-level) lists.</summary>
    private static SettingsDocument MakeActive(SettingsDocument doc, CommandProfile profile) => doc with
    {
        ActiveProfileId = profile.Id,
        Counters = profile.Counters.ToList(),
        AutoReplies = profile.AutoReplies.ToList(),
        Sequences = profile.Sequences.ToList(),
        Keybinds = profile.Keybinds.ToList(),
    };

    public AutoReplySettings AutoReplySettings
    {
        get { lock (_lock) return _document.AutoReplySettings; }
    }

    public void SetAutoReplySettings(AutoReplySettings settings)
    {
        lock (_lock) _document = _document with { AutoReplySettings = settings };
        ScheduleSave();
    }

    public TwitchSettings Twitch
    {
        get { lock (_lock) return _document.Twitch; }
    }

    public ChatOverlaySettings ChatOverlay
    {
        get { lock (_lock) return _document.ChatOverlay; }
    }

    public IReadOnlyList<ChatOverlayInstance> ChatOverlays
    {
        get { lock (_lock) return _document.ChatOverlays; }
    }

    public ChatOverlayInstance? GetChatOverlay(string id)
    {
        lock (_lock)
        {
            return _document.ChatOverlays.FirstOrDefault(o => string.Equals(o.Id, id, StringComparison.OrdinalIgnoreCase));
        }
    }

    public void SaveChatOverlay(ChatOverlayInstance overlay)
    {
        ArgumentNullException.ThrowIfNull(overlay);
        lock (_lock)
        {
            var overlays = _document.ChatOverlays.ToList();
            var index = overlays.FindIndex(o => string.Equals(o.Id, overlay.Id, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                overlays[index] = overlay;
            }
            else
            {
                overlays.Add(overlay);
            }

            var newDoc = _document with { ChatOverlays = overlays };
            if (overlay.Id == "default" || overlay.IsMain)
            {
                newDoc = newDoc with { ChatOverlay = overlay.Settings };
            }
            _document = newDoc;
        }
        ScheduleSave();
    }

    public bool DeleteChatOverlay(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || string.Equals(id, "default", StringComparison.OrdinalIgnoreCase))
            return false;

        lock (_lock)
        {
            var existing = _document.ChatOverlays.FirstOrDefault(o => string.Equals(o.Id, id, StringComparison.OrdinalIgnoreCase));
            if (existing is null || existing.IsMain) return false;

            var overlays = _document.ChatOverlays.Where(o => !string.Equals(o.Id, id, StringComparison.OrdinalIgnoreCase)).ToList();
            _document = _document with { ChatOverlays = overlays };
        }
        ScheduleSave();
        return true;
    }

    public void SetChatOverlay(ChatOverlaySettings settings)
    {
        lock (_lock)
        {
            var s = settings ?? new();
            var overlays = _document.ChatOverlays.ToList();
            var index = overlays.FindIndex(o => o.Id == "default" || o.IsMain);
            if (index >= 0)
            {
                overlays[index] = overlays[index] with { Settings = s };
            }
            else
            {
                overlays.Insert(0, new ChatOverlayInstance { Id = "default", Name = "Main Overlay", IsMain = true, Settings = s });
            }
            _document = _document with { ChatOverlay = s, ChatOverlays = overlays };
        }
        ScheduleSave();
    }

    public ChatOverlaySettings ObsChat
    {
        get { lock (_lock) return _document.ObsChat; }
    }

    public void SetObsChat(ChatOverlaySettings settings)
    {
        lock (_lock) _document = _document with { ObsChat = settings ?? new() };
        ScheduleSave();
    }

    public WindowSettings Window
    {
        get { lock (_lock) return _document.Window; }
    }

    public string Language
    {
        get { lock (_lock) return _document.Language; }
    }

    public bool StartupEnabled
    {
        get { lock (_lock) return _document.StartupEnabled; }
    }

    public void SetStartupEnabled(bool enabled)
    {
        lock (_lock) _document = _document with { StartupEnabled = enabled };
        ScheduleSave();
    }

    public bool? CloseToTray
    {
        get { lock (_lock) return _document.CloseToTray; }
    }

    public void SetCloseToTray(bool closeToTray)
    {
        lock (_lock) _document = _document with { CloseToTray = closeToTray };
        ScheduleSave();
    }

    public bool BotAccountEnabled
    {
        get { lock (_lock) return _document.BotAccountEnabled; }
    }

    public void SetBotAccountEnabled(bool enabled)
    {
        lock (_lock) _document = _document with { BotAccountEnabled = enabled };
        ScheduleSave();
    }

    public string PreferredChatSender
    {
        get { lock (_lock) return string.IsNullOrWhiteSpace(_document.PreferredChatSender) ? "bot" : _document.PreferredChatSender; }
    }

    public void SetPreferredChatSender(string sender)
    {
        var normalized = sender?.Trim().ToLowerInvariant() == "broadcaster" ? "broadcaster" : "bot";
        lock (_lock) _document = _document with { PreferredChatSender = normalized };
        ScheduleSave();
    }

    public void SetLanguage(string language)
    {
        lock (_lock)
        {
            _document = _document with { Language = NormalizeLanguage(language) };
        }
        ScheduleSave();
    }

    public PollState ActivePoll
    {
        get { lock (_lock) return _document.ActivePoll; }
    }

    public void SetActivePoll(PollState poll)
    {
        ArgumentNullException.ThrowIfNull(poll);
        lock (_lock) _document = _document with { ActivePoll = poll };
        ScheduleSave();
    }


    public void SetCount(string counterId, int count)
    {
        lock (_lock)
        {
            var counters = _document.Counters
                .Select(c => c.Id == counterId ? c with { Count = Math.Max(0, count) } : c)
                .ToList();
            _document = _document with { Counters = counters };
        }
        ScheduleSave();
    }

    public void SaveCounter(Counter counter)
    {
        lock (_lock)
        {
            var counters = _document.Counters.Any(c => c.Id == counter.Id)
                ? _document.Counters.Select(c => c.Id == counter.Id ? counter : c).ToList()
                : _document.Counters.Append(counter).ToList();
            _document = _document with { Counters = counters };
        }
        ScheduleSave();
    }

    public void DeleteCounter(string counterId)
    {
        lock (_lock)
        {
            _document = _document with { Counters = _document.Counters.Where(c => c.Id != counterId).ToList() };
        }
        ScheduleSave();
    }

    public void SaveAutoReply(AutoReply rule)
    {
        lock (_lock)
        {
            var rules = _document.AutoReplies.Any(r => r.Id == rule.Id)
                ? _document.AutoReplies.Select(r => r.Id == rule.Id ? rule : r).ToList()
                : _document.AutoReplies.Append(rule).ToList();
            _document = _document with { AutoReplies = rules };
        }
        ScheduleSave();
    }

    public void DeleteAutoReply(string ruleId)
    {
        lock (_lock)
        {
            _document = _document with { AutoReplies = _document.AutoReplies.Where(r => r.Id != ruleId).ToList() };
        }
        ScheduleSave();
    }

    public void SaveSequence(CommandSequence sequence)
    {
        lock (_lock)
        {
            var sequences = _document.Sequences.Any(s => s.Id == sequence.Id)
                ? _document.Sequences.Select(s => s.Id == sequence.Id ? sequence : s).ToList()
                : _document.Sequences.Append(sequence).ToList();
            _document = _document with { Sequences = sequences };
        }
        ScheduleSave();
    }

    public void DeleteSequence(string sequenceId)
    {
        lock (_lock)
        {
            _document = _document with { Sequences = _document.Sequences.Where(s => s.Id != sequenceId).ToList() };
        }
        ScheduleSave();
    }

    public void SetTwitch(TwitchSettings twitch)
    {
        lock (_lock)
        {
            _document = _document with { Twitch = twitch };
        }
        ScheduleSave();
    }

    public void SetWindow(WindowSettings window)
    {
        lock (_lock)
        {
            _document = _document with { Window = window };
        }
        ScheduleSave();
    }

    public ObsSettings GetObsSettings()
    {
        lock (_lock) return _document.Obs;
    }

    public void SaveObsSettings(ObsSettings obs)
    {
        lock (_lock)
        {
            _document = _document with { Obs = obs };
        }
        ScheduleSave();
    }

    private void ScheduleSave() => _debounce.Change(500, Timeout.Infinite);

    /// <summary>
    /// Returns (once) what startup recovery did, or null when settings.json loaded normally or this is a first run.
    /// </summary>
    public SettingsRecovery? TakeRecoveryNotice()
    {
        lock (_lock)
        {
            var notice = _recovery;
            _recovery = null;
            return notice;
        }
    }

    private SettingsDocument Load()
    {
        var mainExists = File.Exists(_filePath);
        if (mainExists && TryReadDocument(_filePath, out var document)) return document;

        // settings.json is missing or unreadable (a crash or power cut mid-write, for example).
        // Never start empty while a good copy exists: an empty start gets saved over the real data.
        string? savedAs = mainExists ? Quarantine() : null;
        foreach (var candidate in RecoveryCandidates())
        {
            if (!TryReadDocument(candidate, out var recovered)) continue;
            try { File.Copy(candidate, _filePath, overwrite: true); } catch { }
            _recovery = new SettingsRecovery(Path.GetFileName(candidate), savedAs);
            return recovered;
        }

        if (mainExists) _recovery = new SettingsRecovery(null, savedAs);
        return new SettingsDocument();
    }

    /// <summary>Copies that hold real user data (commands, counters, replies...), newest first. Empty ones are not worth restoring.</summary>
    public IReadOnlyList<SettingsBackupInfo> ListBackups()
    {
        var found = new List<SettingsBackupInfo>();
        foreach (var (name, kind, path) in EnumerateBackupFiles())
        {
            if (!TryReadDocument(path, out var doc)) continue;
            if (!HasCommands(doc)) continue;
            long bytes = 0;
            try { bytes = new FileInfo(path).Length; } catch { }
            found.Add(new SettingsBackupInfo(name, kind, File.GetLastWriteTimeUtc(path), doc.Counters.Count, doc.AutoReplies.Count, doc.Sequences.Count, doc.Keybinds.Count, bytes));
        }
        return found.OrderByDescending(b => b.ModifiedUtc).ToList();
    }

    private IEnumerable<(string Name, string Kind, string Path)> EnumerateBackupFiles()
    {
        if (File.Exists(_filePath + ".tmp")) yield return ("settings.json.tmp", "pending", _filePath + ".tmp");
        if (File.Exists(_backupPath)) yield return ("settings.json.bak", "last", _backupPath);
        string[] files;
        try { files = Directory.Exists(_snapshotDir) ? Directory.GetFiles(_snapshotDir, "*.json") : Array.Empty<string>(); }
        catch { files = Array.Empty<string>(); }
        foreach (var file in files)
        {
            var fileName = Path.GetFileName(file);
            var kind = fileName.StartsWith("before-restore-", StringComparison.Ordinal) ? "before-restore"
                : fileName.StartsWith("settings-", StringComparison.Ordinal) ? "snapshot"
                : null;
            if (kind is not null) yield return ("backups/" + fileName, kind, file);
        }
    }

    /// <summary>
    /// Makes a listed backup the live settings. What is there now is kept first (backups/before-restore-*.json),
    /// so a restore can itself be undone. The caller restarts the app so every part of the host reloads.
    /// </summary>
    public bool RestoreBackup(string name, out string? error)
    {
        error = null;
        var match = EnumerateBackupFiles().FirstOrDefault(b => string.Equals(b.Name, name, StringComparison.Ordinal));
        if (match.Path is null) { error = "BACKUP NOT FOUND"; return false; }
        if (!TryReadDocument(match.Path, out var restored)) { error = "BACKUP UNREADABLE"; return false; }
        try
        {
            KeepBeforeRestoreCopy();
            lock (_lock) _document = restored;
            Flush();
            return true;
        }
        catch
        {
            error = "RESTORE FAILED";
            return false;
        }
    }

    /// <summary>
    /// Settings > System > Reset everything. The current settings are kept first (backups/before-restore-*.json, listed in
    /// Settings > Backups, so the reset can be undone), and so is the page's own storage (stats, leaderboards, layout) as
    /// backups/before-reset-web-*.json. Everything goes back to default except the logins: the Twitch connection and bot
    /// account, the OBS connection, the language and the window. The caller restarts the app so every part reloads.
    /// </summary>
    public bool ResetToDefaults(IReadOnlyDictionary<string, string>? webStorage, out string? error)
    {
        error = null;
        try
        {
            if (webStorage is { Count: > 0 })
            {
                Directory.CreateDirectory(_snapshotDir);
                File.WriteAllText(
                    Path.Combine(_snapshotDir, $"before-reset-web-{DateTime.Now:yyyyMMdd-HHmmss}.json"),
                    JsonSerializer.Serialize(webStorage, new JsonSerializerOptions { WriteIndented = true }),
                    new System.Text.UTF8Encoding(false));
            }
            KeepBeforeRestoreCopy();
            lock (_lock)
            {
                var old = _document;
                // Profiles and the Starter flag stay at default, so Starter is added again on the next start
                _document = NormalizeSettingsDocument(new SettingsDocument
                {
                    Twitch = old.Twitch,
                    Obs = old.Obs,
                    BotAccountEnabled = old.BotAccountEnabled,
                    PreferredChatSender = old.PreferredChatSender,
                    Language = old.Language,
                    Window = old.Window,
                    StartupEnabled = old.StartupEnabled,
                    CloseToTray = old.CloseToTray,
                });
            }
            Flush();
            return true;
        }
        catch
        {
            error = "RESET FAILED";
            return false;
        }
    }

    /// <summary>Keeps what is on disk now as backups/before-restore-*.json (last few kept) so a restore or import can be undone.</summary>
    private void KeepBeforeRestoreCopy()
    {
        Flush();
        if (!File.Exists(_filePath)) return;
        Directory.CreateDirectory(_snapshotDir);
        File.Copy(_filePath, Path.Combine(_snapshotDir, $"before-restore-{DateTime.Now:yyyyMMdd-HHmmss}.json"), overwrite: true);
        foreach (var old in Directory.GetFiles(_snapshotDir, "before-restore-*.json").OrderByDescending(f => f, StringComparer.Ordinal).Skip(MaxBeforeRestoreCopies))
        {
            try { File.Delete(old); } catch { }
        }
    }

    /// <summary>The commands and/or chat overlay looks, ready to be written to a share file.</summary>
    public ShareBundle BuildShareBundle(bool includeCommands, bool includeOverlays, string appVersion)
    {
        lock (_lock)
        {
            return ShareBundles.Build(_document.Counters, _document.AutoReplies, _document.Sequences, _document.ChatOverlays, includeCommands, includeOverlays, appVersion);
        }
    }

    /// <summary>
    /// Adds a shared bundle to the current settings without changing anything already there. The current file is kept first
    /// (backups/before-restore-*.json). The caller restarts the app so every part of the host reloads.
    /// </summary>
    public bool ImportShareBundle(ShareBundle bundle, out ShareMergeResult? result, out string? error)
    {
        result = null;
        error = null;
        try
        {
            lock (_lock)
            {
                result = ShareBundles.Merge(_document.Counters, _document.AutoReplies, _document.Sequences, _document.ChatOverlays, bundle);
            }
            KeepBeforeRestoreCopy();
            lock (_lock)
            {
                _document = _document with
                {
                    Counters = result.Counters,
                    AutoReplies = result.AutoReplies,
                    Sequences = result.Sequences,
                    ChatOverlays = result.ChatOverlays,
                };
            }
            Flush();
            return true;
        }
        catch
        {
            error = "IMPORT FAILED";
            return false;
        }
    }

    /// <summary>Newest first: a finished-but-not-renamed write, the last good copy, then periodic snapshots.</summary>
    private IEnumerable<string> RecoveryCandidates()
    {
        yield return _filePath + ".tmp";
        yield return _backupPath;
        string[] snapshots;
        try { snapshots = Directory.Exists(_snapshotDir) ? Directory.GetFiles(_snapshotDir, "settings-*.json") : Array.Empty<string>(); }
        catch { snapshots = Array.Empty<string>(); }
        foreach (var file in snapshots.OrderByDescending(f => f, StringComparer.Ordinal)) yield return file;
    }

    /// <summary>Moves an unreadable settings.json aside (kept for manual inspection) and returns its new name.</summary>
    private string? Quarantine()
    {
        try
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (string.IsNullOrEmpty(dir)) dir = ".";
            var name = $"settings.corrupt-{DateTime.Now:yyyyMMdd-HHmmss}.json";
            File.Move(_filePath, Path.Combine(dir, name), overwrite: true);
            foreach (var old in Directory.GetFiles(dir, "settings.corrupt-*.json").OrderByDescending(f => f, StringComparer.Ordinal).Skip(MaxCorruptCopies))
            {
                try { File.Delete(old); } catch { }
            }
            return name;
        }
        catch
        {
            return null;
        }
    }

    private static bool TryReadDocument(string path, out SettingsDocument document)
    {
        document = new SettingsDocument();
        try
        {
            if (!File.Exists(path)) return false;
            var json = File.ReadAllText(path);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return false;
            if (root.TryGetProperty("counters", out _))
            {
                document = NormalizeSettingsDocument(JsonSerializer.Deserialize<SettingsDocument>(json, Json.Options));
                return true;
            }
            if (root.TryGetProperty("death", out var death) ||
                (root.TryGetProperty("count", out _) && root.TryGetProperty("config", out _)))
            {
                var legacyJson = death.ValueKind == JsonValueKind.Object ? death.GetRawText() : json;
                var legacy = JsonSerializer.Deserialize<LegacyDeathState>(legacyJson, Json.Options);
                var commandName = legacy?.Config?.CommandName;
                if (string.IsNullOrWhiteSpace(commandName)) commandName = "deaths";
                var permission = legacy?.Config?.Permission;
                if (string.IsNullOrWhiteSpace(permission)) permission = "everyone";
                var cooldown = legacy?.Config?.CooldownSeconds ?? 10;
                var counter = new Counter
                {
                    Id = Guid.NewGuid().ToString(),
                    Name = "Deaths",
                    Count = legacy?.Count ?? 0,
                    Commands = new CounterConfig
                    {
                        Increase = new CounterCommandConfig { CommandName = commandName, Permission = permission, CooldownSeconds = cooldown },
                        Decrease = new CounterCommandConfig { CommandName = $"{commandName}down", Permission = permission, CooldownSeconds = cooldown },
                        Reset = new CounterCommandConfig { CommandName = $"{commandName}reset", Permission = permission, CooldownSeconds = 0 },
                    },
                    Obs = legacy?.Obs ?? new ObsOutputConfig { Enabled = false },
                };
                document = NormalizeSettingsDocument(new SettingsDocument { Counters = new List<Counter> { counter } });
                return true;
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    private static SettingsDocument NormalizeSettingsDocument(SettingsDocument? document)
    {
        var value = document ?? new SettingsDocument();
        var overlays = value.ChatOverlays != null && value.ChatOverlays.Count > 0
            ? value.ChatOverlays.ToList()
            : new List<ChatOverlayInstance>();

        var mainIdx = overlays.FindIndex(o => o.Id == "default" || o.IsMain);
        if (mainIdx >= 0)
        {
            var main = overlays[mainIdx];
            overlays[mainIdx] = main with
            {
                Id = "default",
                Name = string.IsNullOrWhiteSpace(main.Name) ? "Main Overlay" : main.Name,
                IsMain = true,
                Settings = main.Settings ?? value.ChatOverlay ?? new()
            };
        }
        else
        {
            overlays.Insert(0, new ChatOverlayInstance
            {
                Id = "default",
                Name = "Main Overlay",
                IsMain = true,
                Settings = value.ChatOverlay ?? new()
            });
        }

        var withProfiles = NormalizeProfiles(value);
        return withProfiles with
        {
            ChatOverlay = overlays.First(o => o.Id == "default").Settings,
            ChatOverlays = overlays,
            ObsChat = value.ObsChat ?? new(),
            Language = NormalizeLanguage(value.Language),
        };
    }

    /// <summary>
    /// Settings written before profiles existed hold their commands only in the top-level lists: those become the first profile,
    /// active. The live lists always win for the active profile, since that is what the rest of the host edits.
    /// </summary>
    private static SettingsDocument NormalizeProfiles(SettingsDocument value)
    {
        var profiles = (value.Profiles ?? new List<CommandProfile>())
            .Where(p => p is not null && !string.IsNullOrWhiteSpace(p.Id))
            .GroupBy(p => p.Id, StringComparer.Ordinal)
            .Select(g => g.First())
            .Select(p => p with
            {
                Name = CleanProfileName(p.Name) ?? "Profile",
                Counters = p.Counters ?? new(),
                AutoReplies = p.AutoReplies ?? new(),
                Sequences = p.Sequences ?? new(),
                Keybinds = p.Keybinds ?? new(),
            })
            .ToList();

        if (profiles.Count == 0)
        {
            profiles.Add(new CommandProfile
            {
                Id = Guid.NewGuid().ToString(),
                Name = NormalizeLanguage(value.Language) == "ar" ? "أوامري" : "My commands",
            });
            return WithActiveProfileSynced(value with { Profiles = profiles, ActiveProfileId = profiles[0].Id });
        }

        if (!profiles.Any(p => p.Id == value.ActiveProfileId))
        {
            // The active id points nowhere (hand-edited file): the first profile becomes live
            return MakeActive(value with { Profiles = profiles }, profiles[0]);
        }
        return WithActiveProfileSynced(value with { Profiles = profiles });
    }

    private static int Clamp(int value, int min, int max) => Math.Clamp(value, min, max);

    private static string NormalizeChoice(string? value, string fallback, params string[] allowed)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var trimmed = value.Trim();
        return allowed.Contains(trimmed, StringComparer.OrdinalIgnoreCase)
            ? allowed.First(candidate => string.Equals(candidate, trimmed, StringComparison.OrdinalIgnoreCase))
            : fallback;
    }

    private static string NormalizeLanguage(string? language) => string.Equals(language, "ar", StringComparison.OrdinalIgnoreCase) ? "ar" : "en";

    private sealed record LegacyDeathState
    {
        public int Count { get; init; }
        public LegacyConfig? Config { get; init; }
        public ObsOutputConfig? Obs { get; init; }
    }

    private sealed record LegacyConfig
    {
        public string CommandName { get; init; } = "deaths";
        public string Permission { get; init; } = "everyone";
        public int CooldownSeconds { get; init; } = 10;
    }

    public void Flush()
    {
        SettingsDocument snapshot;
        lock (_lock) snapshot = WithActiveProfileSynced(_document);
        try
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            var json = JsonSerializer.Serialize(snapshot, Json.Options);
            var tmp = _filePath + ".tmp";
            WriteDurably(tmp, json);

            // Keep the last good file before replacing it (never overwrite a good backup with a damaged file)
            if (File.Exists(_filePath) && TryReadDocument(_filePath, out _))
            {
                try { File.Copy(_filePath, _backupPath, overwrite: true); } catch { }
            }

            for (var i = 0; i < 5; i++)
            {
                try
                {
                    File.Move(tmp, _filePath, overwrite: true);
                    MaybeSnapshot(snapshot);
                    return;
                }
                catch (IOException) when (i < 4)
                {
                    Thread.Sleep(50);
                }
            }
            File.Copy(tmp, _filePath, overwrite: true);
            try { File.Delete(tmp); } catch { }
            MaybeSnapshot(snapshot);
        }
        catch
        {
        }
    }

    /// <summary>Writes and flushes to the disk (not just the OS cache) so a hard reset cannot leave a half-written file.</summary>
    private static void WriteDurably(string path, string content)
    {
        var bytes = new System.Text.UTF8Encoding(false).GetBytes(content);
        using var stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush(true);
    }

    /// <summary>A copy of settings.json every few hours (last 8 kept), only once there is real user data to protect.</summary>
    private void MaybeSnapshot(SettingsDocument snapshot)
    {
        try
        {
            if (!HasCommands(snapshot)) return;
            Directory.CreateDirectory(_snapshotDir);
            var existing = Directory.GetFiles(_snapshotDir, "settings-*.json").OrderByDescending(f => f, StringComparer.Ordinal).ToList();
            if (existing.Count > 0 && DateTime.UtcNow - File.GetLastWriteTimeUtc(existing[0]) < SnapshotEvery) return;
            File.Copy(_filePath, Path.Combine(_snapshotDir, $"settings-{DateTime.Now:yyyyMMdd-HHmmss}.json"), overwrite: true);
            foreach (var old in existing.Skip(MaxSnapshots - 1))
            {
                try { File.Delete(old); } catch { }
            }
        }
        catch
        {
            // backups are best effort
        }
    }

    public void Dispose()
    {
        AppDomain.CurrentDomain.ProcessExit -= OnProcessExit;
        _debounce.Dispose();
        Flush();
    }
}
