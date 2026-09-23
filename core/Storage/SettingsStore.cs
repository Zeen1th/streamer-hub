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
}

public sealed class SettingsStore : IDisposable
{
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
        public string Language { get; init; } = string.Empty;
        public bool BotAccountEnabled { get; init; }
        public string PreferredChatSender { get; init; } = "bot";
        public bool StartupEnabled { get; init; } = true;
        public bool? CloseToTray { get; init; }
        public PollState ActivePoll { get; init; } = new();
    }

    private readonly string _filePath;
    private readonly object _lock = new();
    private readonly System.Threading.Timer _debounce;
    private SettingsDocument _document;

    public SettingsStore(string filePath)
    {
        _filePath = filePath;
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

    private void ScheduleSave() => _debounce.Change(500, Timeout.Infinite);

    private SettingsDocument Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return new SettingsDocument();
            var json = File.ReadAllText(_filePath);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("counters", out _))
            {
                return NormalizeSettingsDocument(JsonSerializer.Deserialize<SettingsDocument>(json, Json.Options));
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
                return NormalizeSettingsDocument(new SettingsDocument { Counters = new List<Counter> { counter } });
            }
            return new SettingsDocument();
        }
        catch
        {
            return new SettingsDocument();
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

        return value with
        {
            ChatOverlay = overlays.First(o => o.Id == "default").Settings,
            ChatOverlays = overlays,
            ObsChat = value.ObsChat ?? new(),
            Language = NormalizeLanguage(value.Language),
        };
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
        lock (_lock) snapshot = _document;
        try
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            var json = JsonSerializer.Serialize(snapshot, Json.Options);
            var tmp = _filePath + ".tmp";
            File.WriteAllText(tmp, json);
            for (var i = 0; i < 5; i++)
            {
                try
                {
                    File.Move(tmp, _filePath, overwrite: true);
                    return;
                }
                catch (IOException) when (i < 4)
                {
                    Thread.Sleep(50);
                }
            }
            File.Copy(tmp, _filePath, overwrite: true);
            try { File.Delete(tmp); } catch { }
        }
        catch
        {
        }
    }

    public void Dispose()
    {
        AppDomain.CurrentDomain.ProcessExit -= OnProcessExit;
        _debounce.Dispose();
        Flush();
    }
}
