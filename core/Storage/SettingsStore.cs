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
        public AutoReplySettings AutoReplySettings { get; init; } = new();
        public TwitchSettings Twitch { get; init; } = new();
        public WindowSettings Window { get; init; } = new();
        public string Language { get; init; } = string.Empty;
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
    }

    public IReadOnlyList<Counter> Counters
    {
        get { lock (_lock) return _document.Counters; }
    }

    public IReadOnlyList<AutoReply> AutoReplies
    {
        get { lock (_lock) return _document.AutoReplies; }
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

    public WindowSettings Window
    {
        get { lock (_lock) return _document.Window; }
    }

    public string Language
    {
        get { lock (_lock) return _document.Language; }
    }

    public void SetLanguage(string language)
    {
        lock (_lock)
        {
            _document = _document with { Language = language == "ar" ? "ar" : "en" };
        }
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
                return JsonSerializer.Deserialize<SettingsDocument>(json, Json.Options) ?? new SettingsDocument();
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
                return new SettingsDocument { Counters = new List<Counter> { counter } };
            }
            return new SettingsDocument();
        }
        catch
        {
            return new SettingsDocument();
        }
    }

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
            var tmp = _filePath + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(snapshot, Json.Options));
            File.Move(tmp, _filePath, overwrite: true);
        }
        catch
        {
        }
    }

    public void Dispose()
    {
        _debounce.Dispose();
        Flush();
    }
}
