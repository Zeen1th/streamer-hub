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
        public ChatOverlaySettings ChatOverlay { get; init; } = new();
        public WindowSettings Window { get; init; } = new();
        public string Language { get; init; } = string.Empty;
        public bool BotAccountEnabled { get; init; }
        public bool StartupEnabled { get; init; } = true;
        public bool? CloseToTray { get; init; }
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

    public ChatOverlaySettings ChatOverlay
    {
        get { lock (_lock) return _document.ChatOverlay; }
    }

    public void SetChatOverlay(ChatOverlaySettings settings)
    {
        lock (_lock) _document = _document with { ChatOverlay = NormalizeChatOverlay(settings) };
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

    public void SetLanguage(string language)
    {
        lock (_lock)
        {
            _document = _document with { Language = NormalizeLanguage(language) };
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
        return value with
        {
            ChatOverlay = NormalizeChatOverlay(value.ChatOverlay),
            Language = NormalizeLanguage(value.Language),
        };
    }

    private static ChatOverlaySettings NormalizeChatOverlay(ChatOverlaySettings? settings)
    {
        return new ChatOverlaySettings
        {
            Enabled = settings?.Enabled ?? false,
            MaxMessages = Clamp(settings?.MaxMessages ?? 8, 1, 24),
            DurationSeconds = Clamp(settings?.DurationSeconds ?? 20, 3, 120),
            DisplayMode = NormalizeChoice(settings?.DisplayMode, "stacked", "stacked", "latest"),
            FontSize = Clamp(settings?.FontSize ?? 24, 12, 48),
            AvatarSize = Clamp(settings?.AvatarSize ?? 32, 16, 64),
            Spacing = Clamp(settings?.Spacing ?? 12, 0, 32),
            ShowUsernames = settings?.ShowUsernames ?? true,
            ShowAvatars = settings?.ShowAvatars ?? true,
            Theme = NormalizeChoice(settings?.Theme, "dark", "light", "dark", "transparent", "neon", "ember"),
            MessageStyle = NormalizeChoice(settings?.MessageStyle, "rounded", "rounded", "square"),
            Animation = NormalizeChoice(settings?.Animation, "slide", "slide", "fade", "pop", "glow", "flip", "off"),
            BackgroundOpacity = Clamp(settings?.BackgroundOpacity ?? 85, 0, 100),
            TextShadow = settings?.TextShadow ?? true,
            FontFamily = NormalizeChoice(settings?.FontFamily, "barlow", "barlow", "cairo", "cinzel", "jetbrains-mono", "system"),
            AvatarShape = NormalizeChoice(settings?.AvatarShape, "circle", "circle", "rounded", "square", "squircle"),
            ShowBadges = settings?.ShowBadges ?? true,
            CompactMode = settings?.CompactMode ?? false,
            Alignment = NormalizeChoice(settings?.Alignment, "bottom-left", "bottom-left", "bottom-right", "top-left", "top-right"),
            AvatarPosition = NormalizeChoice(settings?.AvatarPosition, "left", "left", "right"),
            Scale = Clamp(settings?.Scale ?? 100, 50, 200),
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
