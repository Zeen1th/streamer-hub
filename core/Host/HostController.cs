using System.Text.Json;
using System.Diagnostics;
using System.Net.Http.Headers;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using StreamerHub.Core.Audio;
using StreamerHub.Core.Media;
using StreamerHub.Core.Obs;
using StreamerHub.Core.AI;
using StreamerHub.Core.Overlay;
using StreamerHub.Core.Rpc;
using StreamerHub.Core.Storage;
using StreamerHub.Core.Twitch;

namespace StreamerHub.Core.Host;

public sealed class ChatOverlayHostBridge
{
    private readonly SettingsStore _settings;
    private readonly ChatOverlayServer _server;

    public ChatOverlayHostBridge(SettingsStore settings, ChatOverlayServer server)
    {
        _settings = settings;
        _server = server;
        _server.SetActivePoll(settings.ActivePoll);
    }

    public ChatOverlaySettings GetState() => _settings.ChatOverlay;

    public ChatOverlaySettings GetObsChatState() => _settings.ObsChat;

    public IReadOnlyList<ChatOverlayInstance> GetOverlays() => _settings.ChatOverlays;

    public ChatOverlayInstance? GetOverlay(string id) => _settings.GetChatOverlay(id);

    public string GetUrl(string? overlayId = null)
    {
        var baseUri = _server.OverlayUrl?.ToString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(baseUri)) return string.Empty;
        if (string.IsNullOrWhiteSpace(overlayId) || string.Equals(overlayId, "default", StringComparison.OrdinalIgnoreCase))
            return baseUri;
        return $"{baseUri}?id={Uri.EscapeDataString(overlayId)}";
    }

    public string GetDockUrl() => _server.DockUrl?.ToString() ?? string.Empty;

    public string GetVoteOverlayUrl() => _server.VoteOverlayUrl?.ToString() ?? string.Empty;

    public string GetImageOverlayUrl() => _server.ImageOverlayUrl?.ToString() ?? string.Empty;

    public int Port => _server.Port;

    public async Task PublishVoteStateAsync(PollState state, CancellationToken cancellationToken = default) =>
        await _server.PublishVoteStateAsync(state, cancellationToken).ConfigureAwait(false);

    public async Task PublishShowImageAsync(object payload, CancellationToken cancellationToken = default) =>
        await _server.PublishShowImageAsync(payload, cancellationToken).ConfigureAwait(false);

    public async Task PublishHideImageAsync(CancellationToken cancellationToken = default) =>
        await _server.PublishHideImageAsync(cancellationToken).ConfigureAwait(false);

    public async Task<bool> SaveOverlayAsync(ChatOverlayInstance overlay, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(overlay);
        _settings.SaveChatOverlay(overlay);
        await _server.UpdateOverlaySettingsAsync(overlay.Id, overlay.Settings, cancellationToken).ConfigureAwait(false);
        return true;
    }

    public bool DeleteOverlay(string id)
    {
        return _settings.DeleteChatOverlay(id);
    }

    public async Task<bool> SaveSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        _settings.SetChatOverlay(settings);
        await _server.UpdateSettingsAsync(_settings.ChatOverlay, "overlay", cancellationToken).ConfigureAwait(false);
        return true;
    }

    public async Task<bool> SaveObsChatSettingsAsync(ChatOverlaySettings settings, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);
        _settings.SetObsChat(settings);
        await _server.UpdateSettingsAsync(_settings.ObsChat, "obs-chat", cancellationToken).ConfigureAwait(false);
        return true;
    }

    public async Task<bool> PublishChatMessageAsync(ChatMessage message, CancellationToken cancellationToken = default) =>
        await _server.PublishChatMessageAsync(message, cancellationToken).ConfigureAwait(false);

    public async Task SetConnectedAsync(bool connected, CancellationToken cancellationToken = default) =>
        await _server.SetConnectedAsync(connected, cancellationToken).ConfigureAwait(false);

    public async Task PublishProfileAsync(string userId, string? avatarUrl, string? color, CancellationToken cancellationToken = default) =>
        await _server.PublishProfileAsync(userId, avatarUrl, color, cancellationToken).ConfigureAwait(false);

    public async Task PublishClearAsync(ChatClear clear, CancellationToken cancellationToken = default) =>
        await _server.PublishClearAsync(clear, cancellationToken).ConfigureAwait(false);

    public async Task PublishEmotesAsync(
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> providers,
        CancellationToken cancellationToken = default) =>
        await _server.PublishEmotesAsync(providers, cancellationToken).ConfigureAwait(false);

    public async Task ReloadAsync(string? overlayId = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(overlayId))
            await _server.ReloadAsync("overlay", cancellationToken).ConfigureAwait(false);
        else
            await _server.ReloadOverlayAsync(overlayId, cancellationToken).ConfigureAwait(false);
    }

    public async Task ReloadObsChatAsync(CancellationToken cancellationToken = default) =>
        await _server.ReloadAsync("obs-chat", cancellationToken).ConfigureAwait(false);

    public async Task SetPreviewAsync(bool enabled, IReadOnlyList<ChatMessage>? sampleMessages = null, string? overlayId = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(overlayId))
            await _server.SetPreviewAsync(enabled, sampleMessages, "overlay", cancellationToken).ConfigureAwait(false);
        else
            await _server.SetOverlayPreviewAsync(overlayId, enabled, sampleMessages, cancellationToken).ConfigureAwait(false);
    }

    public async Task SetObsChatPreviewAsync(bool enabled, IReadOnlyList<ChatMessage>? sampleMessages = null, CancellationToken cancellationToken = default) =>
        await _server.SetPreviewAsync(enabled, sampleMessages, "obs-chat", cancellationToken).ConfigureAwait(false);
}

public sealed class HostController : IDisposable
{
    private sealed record SetCountPayload(string CounterId, int Count, string Source);
    private sealed record SaveCounterPayload(Counter? Counter);
    private sealed record DeleteCounterPayload(string CounterId);
    private sealed record SaveKeybindsPayload(List<ActionKeybind>? Bindings);
    private sealed record ObsWritePayload(string FilePath, string Content);
    private sealed record SaveFilePayload(string DefaultName);
    private sealed record SaveSettingsPayload(TwitchSettings? Twitch, string? Language, bool? BotAccountEnabled = null, string? PreferredChatSender = null, bool? StartupEnabled = null, bool? CloseToTray = null);
    private sealed record SaveAutoReplyPayload(AutoReply? Rule);
    private sealed record SaveAutoReplySettingsPayload(AutoReplySettings? Settings);
    private sealed record DeleteAutoReplyPayload(string RuleId);
    private sealed record SendChatMessagePayload(string Message, string? SenderRole = null);
    private sealed record UpdateTitlePayload(string Title);
    private sealed record CheckAvatarPayload(string? Username, string? UserId);
    private sealed record SaveOpenRouterPayload(string Provider, string? ApiKey);
    private sealed record GenerateAutoReplyPayload(string RuleId, ChatMessage? Message, bool? Send = null, string? OverrideInstructions = null, string? SenderRole = null);
    private sealed record GenerateAutoReplyResponse(bool Ok, string? Message = null, bool UsedFallback = false, string? Error = null, string? SenderRole = null, string? SenderLogin = null);
    private sealed record UpdateCheckResponse(string CurrentVersion, string LatestVersion, bool UpdateAvailable, string ReleaseUrl, string? DownloadUrl = null, string? ReleaseNotes = null);
    private sealed record UpdateInstallPayload(string DownloadUrl);
    private sealed record BeginResizePayload(string Edge);
    private sealed record SaveSequencePayload(CommandSequence? Sequence);
    private sealed record DeleteSequencePayload(string SequenceId);
    private sealed record SaveVotesPayload(PollState? Poll);

    private readonly MainForm _form;
    private readonly WebView2 _webView;
    private readonly CancellationToken _shutdown;
    private readonly SettingsStore _settings;
    private readonly string _appData;
    private readonly ChatOverlayHostBridge _chatOverlay;
    private readonly ObsFileWriter _obs = new();
    private readonly ObsWebSocketClient _obsWs = new();
    private readonly TokenVault _tokens;
    private readonly TokenVault _botTokens;
    private readonly SecretVault _openRouterKey;
    private readonly SecretVault _groqKey;
    private readonly OpenRouterClient _openRouter = new();
    private static readonly HttpClient UpdateHttp = new();
    private const string UpdateRepository = "Zeen1th/streamer-hub";
    private readonly ITwitchClient _twitch = new TwitchIrcClient();
    private readonly ITwitchClient _botTwitch = new TwitchIrcClient();
    private readonly TwitchEventSubClient _eventSub = new();
    private readonly WindowsMicController _micController = new();
    private readonly SoundEffectPlayer _soundPlayer = new();
    private readonly WindowsTtsService _ttsService;
    private readonly Dictionary<string, DateTime> _seenRedemptions = new(StringComparer.Ordinal);
    private readonly object _seenRedemptionsLock = new();
    private readonly Dictionary<string, DateTime> _seenRaids = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _seenRaidsLock = new();
    private readonly TwitchUserProfileCache _twitchUserProfiles = new();
    private readonly List<string> _recentGamingQuestions = new();
    private readonly object _recentGamingQuestionsLock = new();

    private bool TryRecordRedemption(string id, string? rewardId, string? userId, string? userInput)
    {
        lock (_seenRedemptionsLock)
        {
            var now = DateTime.UtcNow;
            var staleKeys = _seenRedemptions.Where(kv => (now - kv.Value).TotalSeconds > 10).Select(kv => kv.Key).ToList();
            foreach (var k in staleKeys) _seenRedemptions.Remove(k);

            // Deduplicate by exact unique redemption ID (Twitch assigns a unique ID to every redemption)
            if (!string.IsNullOrWhiteSpace(id) && _seenRedemptions.ContainsKey(id)) return false;

            // Short semantic key window (2.5s) strictly to collapse near-simultaneous EventSub + IRC double-dispatches
            if (!string.IsNullOrWhiteSpace(rewardId) && !string.IsNullOrWhiteSpace(userId))
            {
                var semanticKey = $"sem:{rewardId}:{userId}:{userInput?.Trim()}";
                if (_seenRedemptions.TryGetValue(semanticKey, out var prevTime) && (now - prevTime).TotalSeconds < 2.5)
                {
                    return false;
                }
                _seenRedemptions[semanticKey] = now;
            }

            if (!string.IsNullOrWhiteSpace(id))
            {
                _seenRedemptions[id] = now;
            }
            return true;
        }
    }

    private void LoadRecentGamingQuestions()
    {
        try
        {
            var path = Path.Combine(_appData, "recent_trivia.json");
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var items = JsonSerializer.Deserialize<List<string>>(json);
                if (items != null)
                {
                    lock (_recentGamingQuestionsLock)
                    {
                        _recentGamingQuestions.Clear();
                        _recentGamingQuestions.AddRange(items);
                    }
                }
            }
        }
        catch { }
    }

    private void SaveRecentGamingQuestions()
    {
        try
        {
            var path = Path.Combine(_appData, "recent_trivia.json");
            List<string> snapshot;
            lock (_recentGamingQuestionsLock)
            {
                snapshot = new List<string>(_recentGamingQuestions);
            }
            File.WriteAllText(path, JsonSerializer.Serialize(snapshot));
        }
        catch { }
    }

    private void RecordRecentGamingQuestion(string question, string? answer = null)
    {
        if (string.IsNullOrWhiteSpace(question)) return;
        lock (_recentGamingQuestionsLock)
        {
            _recentGamingQuestions.RemoveAll(q => string.Equals(q, question, StringComparison.OrdinalIgnoreCase));
            _recentGamingQuestions.Add(question.Trim());
            if (!string.IsNullOrWhiteSpace(answer))
            {
                _recentGamingQuestions.RemoveAll(q => string.Equals(q, answer, StringComparison.OrdinalIgnoreCase));
                _recentGamingQuestions.Add(answer.Trim());
            }
            while (_recentGamingQuestions.Count > 50)
            {
                _recentGamingQuestions.RemoveAt(0);
            }
        }
        SaveRecentGamingQuestions();
    }

    private List<string> GetRecentGamingQuestions()
    {
        lock (_recentGamingQuestionsLock)
        {
            return new List<string>(_recentGamingQuestions);
        }
    }
    private readonly HostMessageEchoTracker _echoTracker = new();
    private readonly EmoteRegistry _emotes = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string UserId, string Login, string DisplayName, string? AvatarUrl)> _knownChatters = new(StringComparer.OrdinalIgnoreCase);
    private const int ProfileBatchSize = 100;
    private const int ProfileFlushDelayMs = 200;
    private readonly object _profileQueueLock = new();
    private readonly HashSet<string> _pendingProfileIds = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _pendingProfileNames = new(StringComparer.Ordinal);
    private System.Threading.Timer? _profileFlushTimer;
    private readonly RpcDispatcher _dispatcher = new();
    private readonly AlertCompressorService _alertCompressor;
    private readonly string _logPath;
    private IReadOnlyList<KeybindRegistration> _keybindRegistrations = Array.Empty<KeybindRegistration>();

    private volatile bool _authRequired;
    private int _authorizeInProgress;
    private int _botAuthorizeInProgress;
    private string _twitchChannel = string.Empty;
    private string _botLogin = string.Empty;
    private bool _botSimulated;
    private int _chatBurst;
    private DateTime _chatWindow = DateTime.UtcNow;
    private DateTime _lastChatSentAt = DateTime.MinValue;
    private readonly SemaphoreSlim _chatSendLock = new(1, 1);
    private readonly SemaphoreSlim _aiRequestLock = new(1, 1);
    private readonly SemaphoreSlim _aiGenerateLock = new(1, 1);
    private readonly HashSet<string> _recentAiMessageIds = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _recentAiLock = new();
    private DateTime _lastAiReplySentAt = DateTime.MinValue;
    private DateTime _aiWindow = DateTime.UtcNow;
    private int _aiRequestsInWindow;

    public HostController(MainForm form, WebView2 webView, SettingsStore settings, ChatOverlayServer chatOverlayServer, string appData, CancellationToken shutdown)
    {
        _form = form;
        _webView = webView;
        _shutdown = shutdown;
        _settings = settings;
        _appData = appData;
        _chatOverlay = new ChatOverlayHostBridge(settings, chatOverlayServer);
        _tokens = new TokenVault(Path.Combine(appData, "token.bin"));
        _botTokens = new TokenVault(Path.Combine(appData, "bot-token.bin"));
        _openRouterKey = new SecretVault(Path.Combine(appData, "openrouter-key.bin"));
        _groqKey = new SecretVault(Path.Combine(appData, "groq-key.bin"));
        _alertCompressor = new AlertCompressorService(appData);
        _ttsService = new WindowsTtsService(_soundPlayer);
        _ttsService.LogMessage += msg => Log("audio", msg);
        _logPath = Path.Combine(appData, "logs", $"session-{DateTime.Now:yyyyMMdd}.log");
        Directory.CreateDirectory(Path.GetDirectoryName(_logPath)!);
        RegisterHandlers();
        WireTwitch();
        WireBotState();
        RefreshKeybinds();
        LoadRecentGamingQuestions();
        chatOverlayServer.ChatSendRequested += async msg => await SendChatMessageCoreAsync(msg).ConfigureAwait(false);
        chatOverlayServer.ChatTimeoutRequested += async (u, d) => await _twitch.TimeoutUserAsync(u, d).ConfigureAwait(false);
        chatOverlayServer.ChatBanRequested += async u => await _twitch.BanUserAsync(u).ConfigureAwait(false);
        chatOverlayServer.ChatDeleteMessageRequested += async id => await _twitch.DeleteChatMessageAsync(id).ConfigureAwait(false);
    }

    private string Lang => _settings.Language == "ar" ? "ar" : "en";

    public async Task InitializeAsync()
    {
        Log("system", CoreStrings.L(Lang, "core-started"));
        var tokens = _tokens.Load();
        if (tokens is null)
        {
            _authRequired = true;
            EmitStatus();
            if (!_tokens.HasStoredToken())
                await TriggerAuthorizeAsync().ConfigureAwait(false);
            return;
        }
        await ConnectWithTokensAsync(tokens, TwitchConstants.ClientId).ConfigureAwait(false);
    }

    public async Task<object?> DispatchAsync(string channel, JsonElement? payload, CancellationToken ct) =>
        await _dispatcher.DispatchAsync(channel, payload, ct).ConfigureAwait(false);

    public void PostEvent(string channel, object payload)
    {
        if (_form.IsDisposed || _form.Disposing) return;
        if (_form.InvokeRequired)
        {
            try
            {
                _form.BeginInvoke(() => PostEvent(channel, payload));
            }
            catch
            {
            }
            return;
        }
        var envelope = new { v = 1, id = Guid.NewGuid().ToString(), kind = "event", channel, payload };
        try
        {
            _webView.CoreWebView2.PostWebMessageAsJson(Json.Serialize(envelope));
        }
        catch
        {
        }
    }

    private string ResolveKnownTarget(string? target)
    {
        if (string.IsNullOrWhiteSpace(target)) return string.Empty;
        var clean = target.Trim().TrimStart('@');
        if (clean.All(char.IsDigit)) return clean;
        if (_knownChatters.TryGetValue(clean, out var known))
        {
            return known.UserId;
        }
        var norm = TwitchPrivmsgParser.NormalizeArabic(clean);
        if (!string.IsNullOrWhiteSpace(norm) && _knownChatters.TryGetValue(norm, out known))
        {
            return known.UserId;
        }
        return clean;
    }

    private void RegisterHandlers()
    {
        _dispatcher.Register(Channels.WindowMinimize, (_, _) =>
        {
            Ui(() => _form.WindowState = FormWindowState.Minimized);
            return Task.FromResult<object?>(null);
        });
        _dispatcher.Register(Channels.WindowMaximizeToggle, (_, _) =>
        {
            var maximized = Ui(() =>
            {
                _form.WindowState = _form.WindowState == FormWindowState.Maximized
                    ? FormWindowState.Normal
                    : FormWindowState.Maximized;
                return _form.WindowState == FormWindowState.Maximized;
            });
            return Task.FromResult<object?>(new { isMaximized = maximized });
        });
        _dispatcher.Register(Channels.WindowClose, (_, _) =>
        {
            Ui(_form.Close);
            return Task.FromResult<object?>(null);
        });
        _dispatcher.Register(Channels.WindowIsMaximized, (_, _) =>
            Task.FromResult<object?>(new { isMaximized = Ui(() => _form.WindowState == FormWindowState.Maximized) }));
        _dispatcher.Register(Channels.WindowBeginDrag, (_, _) =>
        {
            Ui(_form.StartWindowDrag);
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.WindowBeginResize, (payload, _) =>
        {
            var request = Json.Deserialize<BeginResizePayload>(payload ?? default);
            var started = Ui(() => _form.StartWindowResize(request?.Edge ?? string.Empty));
            return Task.FromResult<object?>(new { ok = started });
        });
        _dispatcher.Register(Channels.CoreGetStatus, (_, _) => Task.FromResult<object?>(BuildStatus()));
        _dispatcher.Register(Channels.UpdateCheck, async (_, ct) => await CheckForUpdateAsync(ct).ConfigureAwait(false));
        _dispatcher.Register(Channels.UpdateInstall, async (payload, ct) => await InstallUpdateAsync(payload, ct).ConfigureAwait(false));
        _dispatcher.Register(Channels.CountersGetState, (_, _) => Task.FromResult<object?>(_settings.Counters));
        _dispatcher.Register(Channels.KeybindsGetState, (_, _) => Task.FromResult<object?>(new KeybindState(_settings.Keybinds, _keybindRegistrations)));
        _dispatcher.Register(Channels.KeybindsSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveKeybindsPayload>(payload ?? default);
            var bindings = (request?.Bindings ?? new List<ActionKeybind>())
                .Where(binding => !string.IsNullOrWhiteSpace(binding.Id))
                .GroupBy(binding => binding.Id, StringComparer.Ordinal)
                .Select(group => group.First())
                .Take(100)
                .ToList();
            _settings.SetKeybinds(bindings);
            RefreshKeybinds();
            return Task.FromResult<object?>(new KeybindState(_settings.Keybinds, _keybindRegistrations));
        });
        _dispatcher.Register(Channels.CountersSetCount, (payload, _) =>
        {
            var request = Json.Deserialize<SetCountPayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.CounterId))
                return Task.FromResult<object?>(new { ok = false, count = 0 });
            _settings.SetCount(request.CounterId, request.Count);
            var current = _settings.Counters.FirstOrDefault(c => c.Id == request.CounterId)?.Count ?? 0;
            return Task.FromResult<object?>(new { ok = true, count = current });
        });
        _dispatcher.Register(Channels.CountersSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveCounterPayload>(payload ?? default);
            if (request?.Counter is null) return Task.FromResult<object?>(new { ok = false });
            _settings.SaveCounter(request.Counter);
            RefreshKeybinds();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.CountersDelete, (payload, _) =>
        {
            var request = Json.Deserialize<DeleteCounterPayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.CounterId))
                return Task.FromResult<object?>(new { ok = false });
            _settings.DeleteCounter(request.CounterId);
            RefreshKeybinds();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.ObsWrite, async (payload, ct) =>
        {
            var request = Json.Deserialize<ObsWritePayload>(payload ?? default);
            if (request is null) return new { ok = false, error = "BAD PAYLOAD" };
            var (ok, error) = await _obs.WriteAsync(request.FilePath, request.Content, ct).ConfigureAwait(false);
            return new { ok, error };
        });
        _dispatcher.Register(Channels.DialogSaveFile, (payload, _) =>
        {
            var request = Json.Deserialize<SaveFilePayload>(payload ?? default);
            return Task.FromResult<object?>(new { path = ShowSaveDialog(request?.DefaultName ?? "deaths.txt") });
        });
        _dispatcher.Register(Channels.DialogOpenFile, (payload, _) =>
        {
            var request = Json.Deserialize<OpenFilePayload>(payload ?? default);
            return Task.FromResult<object?>(new { path = ShowOpenDialog(request?.Filter ?? "Audio files (*.mp3;*.wav;*.ogg)|*.mp3;*.wav;*.ogg|All files (*.*)|*.*", request?.Title ?? "Select Audio File") });
        });
        _dispatcher.Register(Channels.AudioPlaySound, async (payload, ct) =>
        {
            var request = Json.Deserialize<AudioPlaySoundPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.SoundPath)) return new { ok = false, error = "MISSING_SOUND_PATH" };
            var success = await _soundPlayer.PlayAsync(request.SoundPath, request.Volume, ct).ConfigureAwait(false);
            return new { ok = success };
        });
        _dispatcher.Register(Channels.AudioMuteMic, async (payload, ct) =>
        {
            var request = Json.Deserialize<AudioMuteMicPayload>(payload ?? default);
            var duration = request?.DurationSeconds ?? 5;
            var success = await _micController.MuteForDurationAsync(duration, ct).ConfigureAwait(false);
            return new { ok = success };
        });
        _dispatcher.Register(Channels.ObsWebsocketGetStatus, (_, _) =>
        {
            var obsSettings = _settings.GetObsSettings();
            return Task.FromResult<object?>(new
            {
                connected = _obsWs.IsConnected,
                host = _obsWs.Host,
                port = _obsWs.Port,
                hasPassword = _obsWs.HasPassword,
                password = _obsWs.Password,
                autoConnect = obsSettings.AutoConnect,
                error = _obsWs.LastError
            });
        });
        _dispatcher.Register(Channels.ObsWebsocketConnect, async (payload, ct) =>
        {
            var req = Json.Deserialize<ObsConnectPayload>(payload ?? default);
            var host = !string.IsNullOrWhiteSpace(req?.Host) ? req.Host.Trim() : _obsWs.Host;
            var port = req?.Port is > 0 ? req.Port.Value : _obsWs.Port;
            var password = req?.Password ?? _obsWs.Password;
            var autoConnect = req?.AutoConnect ?? true;

            _obsWs.Configure(host, port, password);
            _settings.SaveObsSettings(new ObsSettings
            {
                Host = host,
                Port = port,
                Password = password,
                AutoConnect = autoConnect
            });

            var connected = await _obsWs.ConnectAsync(ct).ConfigureAwait(false);
            return new { ok = connected, error = _obsWs.LastError };
        });
        _dispatcher.Register(Channels.ObsWebsocketDisconnect, (_, _) =>
        {
            _obsWs.Disconnect();
            var obsSettings = _settings.GetObsSettings();
            _settings.SaveObsSettings(obsSettings with { AutoConnect = false });
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.ObsWebsocketAutoDetect, (_, _) =>
        {
            var auto = ObsWebSocketClient.TryAutoDetectLocalConfig();
            return Task.FromResult<object?>(new
            {
                found = auto.Found,
                host = auto.Host,
                port = auto.Port,
                password = auto.Password,
                authRequired = auto.AuthRequired,
                configPath = auto.ConfigPath
            });
        });
        _dispatcher.Register(Channels.ObsGetAudioSources, async (_, ct) =>
        {
            if (!_obsWs.IsConnected)
            {
                await _obsWs.ConnectAsync(ct).ConfigureAwait(false);
            }
            var sources = await _obsWs.GetAudioSourcesAsync(ct).ConfigureAwait(false);
            return new { ok = true, sources, connected = _obsWs.IsConnected, error = _obsWs.LastError };
        });
        _dispatcher.Register(Channels.ObsMuteSource, async (payload, ct) =>
        {
            var req = Json.Deserialize<ObsMuteSourcePayload>(payload ?? default);
            if (req is null)
            {
                return new { ok = false, error = "INVALID_PAYLOAD" };
            }
            if (string.IsNullOrWhiteSpace(req.SourceName))
            {
                var winSuccess = await _micController.MuteForDurationAsync(req.DurationSeconds, ct).ConfigureAwait(false);
                return new { ok = winSuccess, fallback = true };
            }
            if (!_obsWs.IsConnected)
            {
                await _obsWs.ConnectAsync(ct).ConfigureAwait(false);
            }
            if (_obsWs.IsConnected)
            {
                var success = await _obsWs.MuteInputForDurationAsync(req.SourceName, req.DurationSeconds, ct).ConfigureAwait(false);
                if (success)
                {
                    return new { ok = true };
                }
            }
            var fallbackSuccess = await _micController.MuteForDurationAsync(req.DurationSeconds, ct).ConfigureAwait(false);
            return new { ok = fallbackSuccess, fallback = true };
        });
        _dispatcher.Register(Channels.AudioSpeakTts, async (payload, ct) =>
        {
            var request = Json.Deserialize<AudioSpeakTtsPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Text)) return new { ok = false, error = "MISSING_TEXT" };
            var result = await _ttsService.SpeakAsync(request.Text, request.VoiceName, request.Rate, request.Pitch, request.Volume, ct).ConfigureAwait(false);
            return new { ok = result.Ok, playedOnHost = result.PlayedOnHost, audioBase64 = result.AudioBase64 };
        });
        _dispatcher.Register(Channels.LogAppend, (payload, _) =>
        {
            var entry = Json.Deserialize<LogPayload>(payload ?? default);
            if (entry is not null) Log(entry.Kind, entry.Message, emitEvent: false);
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchAuthorize, (_, _) =>
        {
            _ = Task.Run(async () => await TriggerAuthorizeAsync().ConfigureAwait(false));
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchForget, (_, _) =>
        {
            _tokens.Delete();
            _eventSub.Disconnect();
            _twitch.Disconnect();
            _botTwitch.Disconnect();
            _botLogin = string.Empty;
            _twitchChannel = string.Empty;
            _authRequired = true;
            Log("system", CoreStrings.L(Lang, "login-forgotten"));
            EmitStatus();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchBotAuthorize, (_, _) =>
        {
            _ = Task.Run(async () => await TriggerBotAuthorizeAsync().ConfigureAwait(false));
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchBotForget, (_, _) =>
        {
            _botSimulated = false;
            _botTokens.Delete();
            _botTwitch.Disconnect();
            _botLogin = string.Empty;
            EmitStatus();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchBotSimulate, (payload, _) =>
        {
            bool? enable = null;
            string? login = null;
            if (payload.HasValue && payload.Value.ValueKind == JsonValueKind.Object)
            {
                if (payload.Value.TryGetProperty("enabled", out var enabledProp))
                    enable = enabledProp.GetBoolean();
                if (payload.Value.TryGetProperty("login", out var loginProp))
                    login = loginProp.GetString();
            }

            _botSimulated = enable ?? !_botSimulated;
            if (_botSimulated)
            {
                _botLogin = !string.IsNullOrWhiteSpace(login) ? login : "ExampleBot";
                _settings.SetBotAccountEnabled(true);
            }
            else
            {
                if (_botTwitch.State != TwitchState.Connected)
                {
                    _botLogin = string.Empty;
                }
            }
            _settings.Flush();
            EmitStatus();
            return Task.FromResult<object?>(new { ok = true, simulated = _botSimulated, botLogin = _botLogin });
        });
        _dispatcher.Register(Channels.SettingsGetState, (_, _) =>
            Task.FromResult<object?>(new { twitch = _settings.Twitch, language = _settings.Language, botAccountEnabled = _settings.BotAccountEnabled, preferredChatSender = _settings.PreferredChatSender, startupEnabled = _settings.StartupEnabled, closeToTray = _settings.CloseToTray ?? true }));
        _dispatcher.Register(Channels.ChatOverlayGetState, (_, _) =>
            Task.FromResult<object?>(_chatOverlay.GetState()));
        _dispatcher.Register(Channels.ChatOverlaySaveSettings, async (payload, ct) =>
        {
            var settings = Json.Deserialize<ChatOverlaySettings>(payload ?? default);
            if (settings is null) return new { ok = false };
            var ok = await _chatOverlay.SaveSettingsAsync(settings, ct).ConfigureAwait(false);
            if (ok) _settings.Flush();
            return new { ok };
        });
        _dispatcher.Register(Channels.ChatOverlayGetUrl, (payload, _) =>
        {
            string? overlayId = null;
            if (payload.HasValue && payload.Value.ValueKind == JsonValueKind.Object && payload.Value.TryGetProperty("overlayId", out var idProp))
            {
                overlayId = idProp.GetString();
            }
            return Task.FromResult<object?>(new { url = _chatOverlay.GetUrl(overlayId), dockUrl = _chatOverlay.GetDockUrl() });
        });
        _dispatcher.Register(Channels.ChatOverlaysList, (_, _) =>
            Task.FromResult<object?>(new { overlays = _chatOverlay.GetOverlays() }));
        _dispatcher.Register(Channels.ChatOverlaysSave, async (payload, ct) =>
        {
            var request = Json.Deserialize<ChatOverlaysSavePayload>(payload ?? default);
            if (request?.Overlay is null) return new { ok = false, error = "Invalid overlay payload" };
            var ok = await _chatOverlay.SaveOverlayAsync(request.Overlay, ct).ConfigureAwait(false);
            if (ok) _settings.Flush();
            return new { ok };
        });
        _dispatcher.Register(Channels.ChatOverlaysDelete, (payload, _) =>
        {
            var request = Json.Deserialize<ChatOverlaysDeletePayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Id)) return Task.FromResult<object?>(new { ok = false, error = "Invalid ID" });
            var ok = _chatOverlay.DeleteOverlay(request.Id);
            if (ok) _settings.Flush();
            return Task.FromResult<object?>(new { ok });
        });
        _dispatcher.Register(Channels.ObsChatGetState, (_, _) =>
            Task.FromResult<object?>(_chatOverlay.GetObsChatState()));
        _dispatcher.Register(Channels.ObsChatSaveSettings, async (payload, ct) =>
        {
            var settings = Json.Deserialize<ChatOverlaySettings>(payload ?? default);
            if (settings is null) return new { ok = false };
            var ok = await _chatOverlay.SaveObsChatSettingsAsync(settings, ct).ConfigureAwait(false);
            if (ok) _settings.Flush();
            return new { ok };
        });
        _dispatcher.Register(Channels.ObsChatGetUrl, (_, _) =>
            Task.FromResult<object?>(new { url = _chatOverlay.GetDockUrl() }));
        _dispatcher.Register(Channels.SystemListFonts, (_, _) =>
            Task.FromResult<object?>(new { fonts = InstalledFontCatalog.GetFamilies() }));
        _dispatcher.Register(Channels.SettingsSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveSettingsPayload>(payload ?? default);
            if (request?.Twitch is null) return Task.FromResult<object?>(new { ok = false });
            _settings.SetTwitch(request.Twitch);
            if (request.Language is not null) _settings.SetLanguage(request.Language);
            if (request.StartupEnabled.HasValue)
            {
                _settings.SetStartupEnabled(request.StartupEnabled.Value);
                _form.SetStartupEnabled(request.StartupEnabled.Value);
            }
            if (request.CloseToTray.HasValue)
            {
                _settings.SetCloseToTray(request.CloseToTray.Value);
            }
            if (!string.IsNullOrWhiteSpace(request.PreferredChatSender))
            {
                _settings.SetPreferredChatSender(request.PreferredChatSender);
            }
            if (request.BotAccountEnabled.HasValue)
            {
                _settings.SetBotAccountEnabled(request.BotAccountEnabled.Value);
                if (request.BotAccountEnabled.Value)
                {
                    var botTokens = _botTokens.Load();
                    if (botTokens is not null && !string.IsNullOrWhiteSpace(_twitchChannel)) Task.Run(() => ConnectBotWithTokensAsync(botTokens));
                }
                else _botTwitch.Disconnect();
            }
            EmitStatus();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.OpenRouterGetState, (_, _) =>
            Task.FromResult<object?>(new OpenRouterSettingsState
            {
                Configured = !string.IsNullOrWhiteSpace(_openRouterKey.Load()),
                GroqConfigured = !string.IsNullOrWhiteSpace(_groqKey.Load()),
            }));
        _dispatcher.Register(Channels.OpenRouterSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveOpenRouterPayload>(payload ?? default);
            var key = request?.ApiKey?.Trim() ?? string.Empty;
            var vault = request?.Provider == "groq" ? _groqKey : _openRouterKey;
            if (key.Length > 300) return Task.FromResult<object?>(new { ok = false, configured = !string.IsNullOrWhiteSpace(vault.Load()) });
            if (key.Length == 0) vault.Delete();
            else vault.Save(key);
            return Task.FromResult<object?>(new { ok = true, configured = key.Length > 0 });
        });
        _dispatcher.Register(Channels.AutoRepliesGetState, (_, _) =>
            Task.FromResult<object?>(_settings.AutoReplies));
        _dispatcher.Register(Channels.AutoRepliesSettingsGet, (_, _) =>
            Task.FromResult<object?>(_settings.AutoReplySettings));
        _dispatcher.Register(Channels.AutoRepliesSettingsSave, (payload, _) =>
        {
            var settings = Json.Deserialize<AutoReplySettings>(payload ?? default);
            if (settings is null) return Task.FromResult<object?>(new { ok = false });
            _settings.SetAutoReplySettings(settings with
            {
                GlobalAiCooldownSeconds = Math.Clamp(settings.GlobalAiCooldownSeconds, 0, 3600),
                GlobalAiUserCooldownSeconds = Math.Clamp(settings.GlobalAiUserCooldownSeconds, 0, 3600),
            });
            _settings.Flush();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AutoRepliesSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveAutoReplyPayload>(payload ?? default);
            if (request?.Rule is null || string.IsNullOrWhiteSpace(request.Rule.Id))
                return Task.FromResult<object?>(new { ok = false });
            var aiInstructions = request.Rule.AiInstructions?.Trim() ?? string.Empty;
            var agentName = request.Rule.AgentName?.Trim() ?? string.Empty;
            var agentRole = request.Rule.AgentRole?.Trim() ?? string.Empty;
            var agentContext = request.Rule.AgentContext?.Trim() ?? string.Empty;
            var aiModel = request.Rule.AiModel?.Trim() ?? string.Empty;
            var aiFallback = request.Rule.AiFallback?.Trim() ?? string.Empty;
            var titleIncreaseCommand = request.Rule.TitleIncreaseCommand?.Trim() ?? string.Empty;
            var titleDecreaseCommand = request.Rule.TitleDecreaseCommand?.Trim() ?? string.Empty;
            _settings.SaveAutoReply(request.Rule with
            {
                Triggers = request.Rule.Triggers.Count > 0
                    ? request.Rule.Triggers.Select(trigger => trigger.Trim()).Where(trigger => trigger.Length > 0).Distinct().ToList()
                    : string.IsNullOrWhiteSpace(request.Rule.Trigger) ? new List<string>() : new List<string> { request.Rule.Trigger.Trim() },
                Trigger = string.Empty,
                Response = request.Rule.Response.Trim(),
                CooldownSeconds = Math.Clamp(request.Rule.CooldownSeconds, 0, 3600),
                UserCooldownSeconds = Math.Clamp(request.Rule.UserCooldownSeconds, 0, 3600),
                TitleIncreaseCommand = titleIncreaseCommand[..Math.Min(titleIncreaseCommand.Length, 200)],
                TitleDecreaseCommand = titleDecreaseCommand[..Math.Min(titleDecreaseCommand.Length, 200)],
                ThemeActionMode = request.Rule.ThemeActionMode == "light" ? "light" : "dark",
                MinimumRank = request.Rule.MinimumRank is "subscriber" or "vip" or "mod" or "broadcaster" ? request.Rule.MinimumRank : "everyone",
                AiUserCooldownSeconds = Math.Clamp(request.Rule.AiUserCooldownSeconds, 0, 3600),
                ResponseMode = request.Rule.ResponseMode == "ai" ? "ai" : "static",
                AiInstructions = aiInstructions[..Math.Min(aiInstructions.Length, 8000)],
                AgentName = agentName[..Math.Min(agentName.Length, 80)],
                AgentRole = agentRole[..Math.Min(agentRole.Length, 300)],
                AgentContext = agentContext[..Math.Min(agentContext.Length, 4000)],
                AiModel = string.IsNullOrWhiteSpace(aiModel) ? (request.Rule.AiProvider == "openrouter" ? "qwen/qwen3.8-27b:free" : "llama-3.1-8b-instant") : aiModel[..Math.Min(aiModel.Length, 120)],
                AiProvider = request.Rule.AiProvider == "openrouter" ? "openrouter" : "groq",
                AiMaxTokens = Math.Clamp(request.Rule.AiMaxTokens, 40, 240),
                AiFallback = aiFallback[..Math.Min(aiFallback.Length, 500)],
                AiUserRestriction = request.Rule.AiUserRestriction is "allowlist" or "blocklist" ? request.Rule.AiUserRestriction : "none",
                AiTargetUsers = request.Rule.AiTargetUsers?.Select(u => u.Trim().TrimStart('@')).Where(u => u.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList() ?? new(),
                AiConditions = request.Rule.AiConditions?.Select(c => c with
                {
                    Id = string.IsNullOrWhiteSpace(c.Id) ? Guid.NewGuid().ToString() : c.Id,
                    IfType = c.IfType is "username" or "role" or "message_contains" ? c.IfType : "username",
                    IfValue = c.IfValue?.Trim() ?? string.Empty,
                    ThenType = c.ThenType is "instructions" or "static_reply" or "ignore" ? c.ThenType : "instructions",
                    ThenValue = c.ThenValue?.Trim() ?? string.Empty,
                }).ToList() ?? new(),
                SenderRole = request.Rule.SenderRole is "bot" or "broadcaster" ? request.Rule.SenderRole : "default",
                ChannelPointsRewardId = request.Rule.ChannelPointsRewardId?.Trim() ?? string.Empty,
                ChannelPointsRewardTitle = request.Rule.ChannelPointsRewardTitle?.Trim() ?? string.Empty,
            });
            _settings.Flush();
            RefreshKeybinds();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AutoRepliesDelete, (payload, _) =>
        {
            var request = Json.Deserialize<DeleteAutoReplyPayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.RuleId))
                return Task.FromResult<object?>(new { ok = false });
            _settings.DeleteAutoReply(request.RuleId);
            _settings.Flush();
            RefreshKeybinds();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.SequencesGetState, (_, _) => Task.FromResult<object?>(_settings.Sequences));
        _dispatcher.Register(Channels.SequencesSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveSequencePayload>(payload ?? default);
            if (request?.Sequence is null || string.IsNullOrWhiteSpace(request.Sequence.Id))
                return Task.FromResult<object?>(new { ok = false });
            _settings.SaveSequence(request.Sequence);
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.SequencesDelete, (payload, _) =>
        {
            var request = Json.Deserialize<DeleteSequencePayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.SequenceId))
                return Task.FromResult<object?>(new { ok = false });
            _settings.DeleteSequence(request.SequenceId);
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.TwitchChannelPointsGetRewards, async (_, ct) =>
        {
            if (_twitch.State != TwitchState.Connected)
                return new { ok = false, rewards = Array.Empty<TwitchRewardInfo>(), error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.GetCustomRewardsAsync(ct).ConfigureAwait(false);
            return new { ok = result.Ok, rewards = result.Rewards, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchSendChatMessage, async (payload, _) =>
        {
            var request = Json.Deserialize<SendChatMessagePayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.Message))
                return new { ok = false, error = "EMPTY MESSAGE" };
            var (_, senderRole, senderLogin) = ResolveActiveChatSender(request.SenderRole);
            var ok = await SendChatMessageCoreAsync(request.Message, request.SenderRole).ConfigureAwait(false);
            return new { ok, senderRole, senderLogin, error = ok ? null : "TWITCH CHAT IS NOT CONNECTED" };
        });
        _dispatcher.Register(Channels.TwitchGetTitle, async (_, _) =>
        {
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.GetChannelTitleAsync().ConfigureAwait(false);
            if (result.Ok && !string.IsNullOrWhiteSpace(result.Title))
            {
                await WriteTitleFileAsync(result.Title).ConfigureAwait(false);
            }
            return new { ok = result.Ok, title = result.Title, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchUpdateTitle, async (payload, _) =>
        {
            var request = Json.Deserialize<UpdateTitlePayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.Title)) return new { ok = false, error = "EMPTY TITLE" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.UpdateChannelTitleAsync(request.Title).ConfigureAwait(false);
            if (result.Ok)
            {
                await WriteTitleFileAsync(request.Title).ConfigureAwait(false);
                PostEvent(Events.TwitchTitleChanged, new { title = request.Title });
            }
            else
            {
                Log("system", $"TWITCH TITLE UPDATE FAILED · {result.Error ?? "UNKNOWN ERROR"} · RECONNECT TWITCH IF THE TOKEN PREDATES TITLE PERMISSION");
            }
            return new { ok = result.Ok, error = result.Ok ? null : result.Error };
        });
        _dispatcher.Register(Channels.TwitchGetTitleFilePath, (_, _) =>
        {
            var titlePath = Path.Combine(_appData, "title.txt");
            return Task.FromResult<object?>(new { path = titlePath });
        });
        _dispatcher.Register(Channels.TwitchCheckAvatar, async (payload, ct) =>
        {
            var request = Json.Deserialize<CheckAvatarPayload>(payload ?? default);
            var target = (request?.Username ?? request?.UserId)?.Trim().TrimStart('@');
            if (string.IsNullOrWhiteSpace(target))
            {
                return new { ok = false, error = "NO TARGET SPECIFIED" };
            }

            // 1. Check known chatters cache first
            if (_knownChatters.TryGetValue(target, out var known))
            {
                var av = known.AvatarUrl ?? (_twitchUserProfiles.TryGet(known.UserId, out var cachedAv) ? cachedAv : null);
                return new
                {
                    ok = true,
                    userId = known.UserId,
                    username = known.Login,
                    displayName = known.DisplayName,
                    avatarUrl = av,
                };
            }

            if (_twitch.State != TwitchState.Connected)
            {
                return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            }
            var result = await _twitch.CheckUserProfileAsync(target, ct).ConfigureAwait(false);
            if (result.Ok && !string.IsNullOrWhiteSpace(result.UserId))
            {
                if (!string.IsNullOrWhiteSpace(result.AvatarUrl))
                {
                    _twitchUserProfiles.Set(result.UserId, result.AvatarUrl);
                    PostEvent(Events.TwitchUserProfile, new { userId = result.UserId, avatarUrl = result.AvatarUrl });
                    await _chatOverlay.PublishProfileAsync(result.UserId, result.AvatarUrl, null, ct).ConfigureAwait(false);
                }
                var info = (result.UserId, result.Login ?? target, result.DisplayName ?? target, result.AvatarUrl);
                _knownChatters[result.UserId] = info;
                if (!string.IsNullOrWhiteSpace(result.Login)) _knownChatters[result.Login] = info;
                if (!string.IsNullOrWhiteSpace(result.DisplayName)) _knownChatters[result.DisplayName] = info;
            }
            return new
            {
                ok = result.Ok,
                userId = result.UserId,
                username = result.Login,
                displayName = result.DisplayName,
                avatarUrl = result.AvatarUrl,
                error = result.Error,
            };
        });
        _dispatcher.Register(Channels.TwitchModerationCheckMod, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, isMod = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, isMod = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.CheckIsModeratorAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, isMod = result.IsMod, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationTimeout, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTimeoutPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var duration = request.DurationSeconds.GetValueOrDefault(60);
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.TimeoutUserAsync(target, duration, request.Reason, ct).ConfigureAwait(false);
            if (!result.Ok)
            {
                Log("moderation", $"Timeout failed for @{request.Target}: {result.Error}");
            }
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationSmartTimeout, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationSmartTimeoutPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, wasMod = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, wasMod = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var duration = request.DurationSeconds.GetValueOrDefault(60);
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.SmartModTimeoutAsync(target, duration, request.Reason, ct).ConfigureAwait(false);
            if (!result.Ok)
            {
                Log("moderation", $"Smart timeout failed for @{request.Target}: {result.Error}");
            }
            return new { ok = result.Ok, wasMod = result.WasMod, target = result.TargetUser, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationBan, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationBanPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.BanUserAsync(target, request.Reason, ct).ConfigureAwait(false);
            if (!result.Ok)
            {
                Log("moderation", $"Ban failed for @{request.Target}: {result.Error}");
            }
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationUnban, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.UnbanUserAsync(target, ct).ConfigureAwait(false);
            if (!result.Ok)
            {
                Log("moderation", $"Unban failed for @{request.Target}: {result.Error}");
            }
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationMod, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.ModUserAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationUnmod, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.UnmodUserAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationVip, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.VipUserAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationUnvip, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.UnvipUserAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationClear, async (_, ct) =>
        {
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.ClearChatAsync(ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationDeleteMessage, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationDeleteMessagePayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.MessageId)) return new { ok = false, error = "EMPTY_MESSAGE_ID" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.DeleteChatMessageAsync(request.MessageId, ct).ConfigureAwait(false);
            if (!result.Ok)
            {
                Log("moderation", $"Delete message failed ({request.MessageId}): {result.Error}");
            }
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationShoutout, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var target = ResolveKnownTarget(request.Target);
            var result = await _twitch.SendShoutoutAsync(target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.ChatOverlayTestMessage, async (payload, ct) =>
        {
            var message = Json.Deserialize<ChatMessage>(payload ?? default);
            if (message is null) return new { ok = false, error = "EMPTY_MESSAGE" };
            var msg = message with
            {
                Id = string.IsNullOrWhiteSpace(message.Id) ? $"test-{Guid.NewGuid():N}" : message.Id,
                Timestamp = string.IsNullOrWhiteSpace(message.Timestamp) ? DateTime.UtcNow.ToString("O") : message.Timestamp,
            };
            await PublishChatOverlayMessageAsync(msg).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.ChatOverlayReload, async (payload, ct) =>
        {
            var request = Json.Deserialize<ChatOverlayReloadPayload>(payload ?? default);
            await _chatOverlay.ReloadAsync(request?.OverlayId, ct).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.ChatOverlaySetPreview, async (payload, ct) =>
        {
            var request = Json.Deserialize<ChatOverlaySetPreviewPayload>(payload ?? default);
            var enabled = request?.Enabled ?? false;
            await _chatOverlay.SetPreviewAsync(enabled, request?.Messages, request?.OverlayId, ct).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.ObsChatReload, async (_, ct) =>
        {
            await _chatOverlay.ReloadObsChatAsync(ct).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.ObsChatSetPreview, async (payload, ct) =>
        {
            var request = Json.Deserialize<ChatOverlaySetPreviewPayload>(payload ?? default);
            var enabled = request?.Enabled ?? false;
            await _chatOverlay.SetObsChatPreviewAsync(enabled, request?.Messages, ct).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.VotesGetState, (_, _) =>
            Task.FromResult<object?>(new { poll = _settings.ActivePoll, url = _chatOverlay.GetVoteOverlayUrl() }));
        _dispatcher.Register(Channels.VotesSave, async (payload, ct) =>
        {
            var request = Json.Deserialize<SaveVotesPayload>(payload ?? default);
            if (request?.Poll is null) return new { ok = false };
            _settings.SetActivePoll(request.Poll);
            _settings.Flush();
            await _chatOverlay.PublishVoteStateAsync(request.Poll, ct).ConfigureAwait(false);
            PostEvent(Events.VotesChanged, request.Poll);
            return new { ok = true, poll = request.Poll };
        });
        _dispatcher.Register(Channels.VotesReset, async (_, ct) =>
        {
            var current = _settings.ActivePoll;
            var resetOptions = current.Options.Select(o => o with { Votes = 0 }).ToList();
            var resetPoll = current with { Options = resetOptions, TotalVotes = 0, Voters = new Dictionary<string, string>() };
            _settings.SetActivePoll(resetPoll);
            _settings.Flush();
            await _chatOverlay.PublishVoteStateAsync(resetPoll, ct).ConfigureAwait(false);
            PostEvent(Events.VotesChanged, resetPoll);
            return new { ok = true, poll = resetPoll };
        });
        _dispatcher.Register(Channels.VotesGenerateAi, async (payload, ct) =>
        {
            var request = Json.Deserialize<GenerateAiPollPayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.Topic))
                return new GenerateAiPollResponse(false, Error: "TOPIC_REQUIRED");

            return await GenerateAiPollAsync(request, ct).ConfigureAwait(false);
        });
        _dispatcher.Register(Channels.AutoRepliesGenerate, async (payload, ct) =>
        {
            var request = Json.Deserialize<GenerateAutoReplyPayload>(payload ?? default);
            if (request?.Message is null || string.IsNullOrWhiteSpace(request.RuleId))
                return new GenerateAutoReplyResponse(false, Error: "BAD PAYLOAD");

            // 1. Message ID Deduplication
            if (!string.IsNullOrWhiteSpace(request.Message.Id))
            {
                lock (_recentAiLock)
                {
                    if (!_recentAiMessageIds.Add(request.Message.Id))
                    {
                        Log("system", $"AI reply rejected: duplicate message ID {request.Message.Id}");
                        return new GenerateAutoReplyResponse(false, Error: "DUPLICATE MESSAGE ALREADY PROCESSED");
                    }
                    if (_recentAiMessageIds.Count > 500)
                    {
                        _recentAiMessageIds.Clear();
                        _recentAiMessageIds.Add(request.Message.Id);
                    }
                }
            }

            var rule = _settings.AutoReplies.FirstOrDefault(item => item.Id == request.RuleId);
            if (rule is null) return new GenerateAutoReplyResponse(false, Error: "RULE NOT FOUND");
            if (rule.ResponseMode != "ai" && string.IsNullOrWhiteSpace(request.OverrideInstructions))
                return new GenerateAutoReplyResponse(false, Error: "AI RULE NOT FOUND");
            var shouldSend = request.Send != false;

            // 2. Minimum cooldown between sent AI chat messages
            if (shouldSend)
            {
                var elapsedSinceLastSend = DateTime.UtcNow - _lastAiReplySentAt;
                if (elapsedSinceLastSend < TimeSpan.FromSeconds(2))
                {
                    Log("system", "AI reply rejected: minimum AI cooldown active");
                    return new GenerateAutoReplyResponse(false, Error: "AI COOLDOWN ACTIVE");
                }
            }

            // 3. In-flight concurrency lock: ensure only one AI generation runs at a time
            if (!_aiGenerateLock.Wait(0))
            {
                Log("system", "AI reply rejected: another AI generation is currently in progress");
                return new GenerateAutoReplyResponse(false, Error: "AI GENERATION ALREADY IN PROGRESS");
            }

            try
            {
                var provider = rule.AiProvider == "groq" ? "groq" : "openrouter";
                var key = provider == "groq" ? _groqKey.Load() : _openRouterKey.Load();
                if (string.IsNullOrWhiteSpace(key)) return new GenerateAutoReplyResponse(false, Error: $"{provider.ToUpperInvariant()} KEY IS NOT CONFIGURED");
                if (shouldSend && _twitch.State != TwitchState.Connected) return new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED");
                if (!await AllowAiRequestAsync().ConfigureAwait(false)) return new GenerateAutoReplyResponse(false, Error: "AI LIMIT REACHED");

                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, _shutdown);
                timeout.CancelAfter(TimeSpan.FromSeconds(45));
                var effectiveInstructions = !string.IsNullOrWhiteSpace(request.OverrideInstructions)
                    ? request.OverrideInstructions
                    : rule.AiInstructions;
                var model = string.IsNullOrWhiteSpace(rule.AiModel) ? "llama-3.1-8b-instant" : rule.AiModel;
                var maxTokens = rule.AiMaxTokens > 0 ? rule.AiMaxTokens : 120;
                var targetSender = !string.IsNullOrWhiteSpace(request.SenderRole) && request.SenderRole is "bot" or "broadcaster"
                    ? request.SenderRole
                    : (!string.IsNullOrWhiteSpace(rule.SenderRole) && rule.SenderRole is "bot" or "broadcaster" ? rule.SenderRole : null);
                var (_, senderRole, senderLogin) = ResolveActiveChatSender(targetSender);
                var effectiveAgentName = !string.IsNullOrWhiteSpace(rule.AgentName)
                    ? rule.AgentName
                    : (senderRole == "bot" && !string.IsNullOrWhiteSpace(senderLogin) ? senderLogin : string.Empty);
                var generated = await _openRouter.GenerateAsync(
                    provider,
                    key,
                    model,
                    effectiveInstructions,
                    request.Message,
                    maxTokens,
                    timeout.Token,
                    effectiveAgentName,
                    rule.AgentRole,
                    rule.AgentContext,
                    _twitchChannel,
                    rule.AiWebSearch).ConfigureAwait(false);
                if (!generated.Ok || string.IsNullOrWhiteSpace(generated.Message))
                {
                    Log("system", $"AI reply failed ({provider}) · {generated.Error ?? "EMPTY RESPONSE"}");
                    var fallback = rule.AiFallback.Trim();
                    if (string.IsNullOrWhiteSpace(fallback))
                        return new GenerateAutoReplyResponse(false, Error: generated.Error ?? "AI DID NOT RETURN A MESSAGE", SenderRole: senderRole, SenderLogin: senderLogin);
                    if (!shouldSend) return new GenerateAutoReplyResponse(true, fallback[..Math.Min(fallback.Length, 500)], true, generated.Error, SenderRole: senderRole, SenderLogin: senderLogin);
                    var fallbackOk = await SendChatMessageCoreAsync(fallback, targetSender).ConfigureAwait(false);
                    if (fallbackOk)
                    {
                        _lastAiReplySentAt = DateTime.UtcNow;
                    }
                    return fallbackOk
                        ? new GenerateAutoReplyResponse(true, fallback[..Math.Min(fallback.Length, 500)], true, generated.Error, SenderRole: senderRole, SenderLogin: senderLogin)
                        : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED", SenderRole: senderRole, SenderLogin: senderLogin);
                }
                if (!shouldSend) return new GenerateAutoReplyResponse(true, generated.Message, SenderRole: senderRole, SenderLogin: senderLogin);
                var sent = await SendChatMessageCoreAsync(generated.Message, targetSender).ConfigureAwait(false);
                if (sent)
                {
                    _lastAiReplySentAt = DateTime.UtcNow;
                }
                return sent
                    ? new GenerateAutoReplyResponse(true, generated.Message, SenderRole: senderRole, SenderLogin: senderLogin)
                    : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED", SenderRole: senderRole, SenderLogin: senderLogin);
            }
            finally
            {
                _aiGenerateLock.Release();
            }
        });
        _dispatcher.Register(Channels.AlertsGetFfmpegStatus, (_, _) =>
            Task.FromResult<object?>(_alertCompressor.CheckFfmpegStatus()));
        _dispatcher.Register(Channels.AlertsDownloadFfmpeg, async (_, ct) =>
        {
            var success = await _alertCompressor.DownloadFfmpegAsync(percent =>
            {
                PostEvent(Events.AlertsDownloadProgress, new { percent });
            }, ct).ConfigureAwait(false);
            return new { ok = success, status = _alertCompressor.CheckFfmpegStatus() };
        });
        _dispatcher.Register(Channels.AlertsInspect, async (payload, ct) =>
        {
            var req = Json.Deserialize<InspectAlertPayload>(payload ?? default);
            if (req is null || string.IsNullOrWhiteSpace(req.InputPath))
                return new { ok = false, error = "MISSING_INPUT_PATH" };

            try
            {
                var info = await _alertCompressor.InspectVideoAsync(req.InputPath, ct).ConfigureAwait(false);
                return new { ok = true, info };
            }
            catch (Exception ex)
            {
                return new { ok = false, error = ex.Message };
            }
        });
        _dispatcher.Register(Channels.AlertsCompress, (payload, ct) =>
        {
            var req = Json.Deserialize<CompressAlertPayload>(payload ?? default);
            if (req is null || string.IsNullOrWhiteSpace(req.InputPath))
                return Task.FromResult<object?>(new { ok = false, error = "MISSING_INPUT_PATH" });

            _ = Task.Run(async () =>
            {
                var result = await _alertCompressor.CompressAsync(
                    req.InputPath,
                    req.OutputPath,
                    req.TargetSizeMb,
                    req.CustomCrf,
                    req.CustomMaxBitrateK,
                    progress => PostEvent(Events.AlertsProgress, progress),
                    ct
                ).ConfigureAwait(false);

                PostEvent(Events.AlertsCompleted, result);
            }, ct);

            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AlertsCancel, (_, _) =>
        {
            _alertCompressor.CancelActiveProcess();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AlertsOpenFolder, (payload, _) =>
        {
            var req = Json.Deserialize<OpenFolderPayload>(payload ?? default);
            if (req is not null && !string.IsNullOrWhiteSpace(req.Path))
            {
                try
                {
                    if (File.Exists(req.Path))
                        Process.Start("explorer.exe", $"/select,\"{req.Path}\"");
                    else if (Directory.Exists(req.Path))
                        Process.Start("explorer.exe", $"\"{req.Path}\"");
                }
                catch { }
            }
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AlertsSaveDroppedFile, async (payload, ct) =>
        {
            var req = Json.Deserialize<SaveDroppedFilePayload>(payload ?? default);
            if (req is null || string.IsNullOrWhiteSpace(req.FileBase64))
                return new { ok = false, error = "MISSING_DATA" };

            try
            {
                var fileName = string.IsNullOrWhiteSpace(req.FileName) ? "dropped_alert.webm" : Path.GetFileName(req.FileName);
                var tempDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamerHub", "TempAlerts");
                Directory.CreateDirectory(tempDir);
                var targetPath = Path.Combine(tempDir, $"{Guid.NewGuid():N}_{fileName}");

                var bytes = Convert.FromBase64String(req.FileBase64);
                await File.WriteAllBytesAsync(targetPath, bytes, ct).ConfigureAwait(false);
                return new { ok = true, filePath = targetPath };
            }
            catch (Exception ex)
            {
                return new { ok = false, error = ex.Message };
            }
        });
        _dispatcher.Register(Channels.ChatOverlayShowImage, async (payload, ct) =>
        {
            var req = Json.Deserialize<ShowOverlayImagePayload>(payload ?? default);
            if (req is null) return new { ok = false, error = "MISSING_PAYLOAD" };

            var imagePath = req.ImagePath?.Trim();
            var imageUrl = req.ImageUrl?.Trim();

            var destPath = !string.IsNullOrWhiteSpace(req.ObsImageDestinationPath) ? req.ObsImageDestinationPath : req.DestinationPath;
            // 1. If an OBS native destination path is specified, copy file to destination
            if (!string.IsNullOrWhiteSpace(destPath) && !string.IsNullOrWhiteSpace(imagePath) && File.Exists(imagePath))
            {
                try
                {
                    var dest = Path.GetFullPath(destPath);
                    var destDir = Path.GetDirectoryName(dest);
                    if (!string.IsNullOrEmpty(destDir)) Directory.CreateDirectory(destDir);
                    File.Copy(imagePath, dest, overwrite: true);
                }
                catch (Exception ex)
                {
                    Log("obs-error", $"Failed copying OBS image to destination: {ex.Message}");
                }
            }

            // 2. Resolve image URL for web / overlay
            string finalUrl;
            if (!string.IsNullOrWhiteSpace(imageUrl) && (imageUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || imageUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || imageUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase)))
            {
                finalUrl = imageUrl;
            }
            else if (!string.IsNullOrWhiteSpace(imagePath))
            {
                if (imagePath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || imagePath.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || imagePath.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    finalUrl = imagePath;
                }
                else if (File.Exists(imagePath))
                {
                    var full = Path.GetFullPath(imagePath);
                    finalUrl = $"http://127.0.0.1:{_chatOverlay.Port}/media?path={Uri.EscapeDataString(full)}";
                }
                else
                {
                    return new { ok = false, error = "FILE_NOT_FOUND" };
                }
            }
            else
            {
                return new { ok = false, error = "NO_IMAGE_SPECIFIED" };
            }

            var broadcastPayload = new
            {
                imageUrl = finalUrl,
                durationSeconds = req.DurationSeconds > 0 ? req.DurationSeconds : 5.0,
                position = string.IsNullOrWhiteSpace(req.Position) ? "center" : req.Position,
                animation = string.IsNullOrWhiteSpace(req.Animation) ? "bounce" : req.Animation,
                scale = req.ImageScale ?? req.Scale ?? 1.0,
            };

            await _chatOverlay.PublishShowImageAsync(broadcastPayload, ct).ConfigureAwait(false);
            return new { ok = true, payload = broadcastPayload };
        });
        _dispatcher.Register(Channels.ChatOverlayHideImage, async (_, ct) =>
        {
            await _chatOverlay.PublishHideImageAsync(ct).ConfigureAwait(false);
            return new { ok = true };
        });
        _dispatcher.Register(Channels.ChatOverlayGetImageUrl, (_, _) =>
        {
            var url = _chatOverlay.GetImageOverlayUrl();
            if (string.IsNullOrWhiteSpace(url))
                url = $"http://127.0.0.1:{_chatOverlay.Port}/image-overlay.html";
            return Task.FromResult<object?>(new { url });
        });
        _dispatcher.Register(Channels.AiGenerateTrivia, async (payload, ct) =>
        {
            var req = Json.Deserialize<GenerateGamingQuestionPayload>(payload ?? default);
            return await GenerateGamingQuestionAsync(req ?? new(), ct).ConfigureAwait(false);
        });
    }

    /// <summary>
    /// Queues a profile lookup instead of issuing one request per chatter.
    ///
    /// The cache batches up to 100 ids per Helix call, but resolving one user at
    /// a time threw that away - during a raid every new chatter produced its own
    /// HTTP request. Ids accumulate here and flush on a short debounce, or
    /// immediately once a full batch is waiting.
    /// </summary>
    private void QueueTwitchUserProfile(string userId, string username)
    {
        lock (_profileQueueLock)
        {
            if (!_pendingProfileIds.Add(userId)) return;
            _pendingProfileNames[userId] = username;

            if (_pendingProfileIds.Count >= ProfileBatchSize)
            {
                _profileFlushTimer?.Change(Timeout.Infinite, Timeout.Infinite);
                _ = FlushTwitchUserProfilesAsync();
                return;
            }

            _profileFlushTimer ??= new System.Threading.Timer(
                _ => _ = FlushTwitchUserProfilesAsync(), null, Timeout.Infinite, Timeout.Infinite);
            _profileFlushTimer.Change(ProfileFlushDelayMs, Timeout.Infinite);
        }
    }

    private async Task FlushTwitchUserProfilesAsync()
    {
        string[] batch;
        Dictionary<string, string> names;
        lock (_profileQueueLock)
        {
            if (_pendingProfileIds.Count == 0) return;
            batch = _pendingProfileIds.Take(ProfileBatchSize).ToArray();
            names = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var id in batch)
            {
                _pendingProfileIds.Remove(id);
                if (_pendingProfileNames.Remove(id, out var name)) names[id] = name;
            }
        }

        try
        {
            var results = await _twitchUserProfiles
                .ResolveAsync(batch, _twitch.GetUserProfileImagesAsync, _shutdown)
                .ConfigureAwait(false);

            foreach (var result in results)
            {
                if (result.ShouldLogFailure)
                {
                    var name = names.TryGetValue(result.UserId, out var value) ? value : result.UserId;
                    Log("system", $"TWITCH AVATAR LOOKUP FAILED · {name}");
                }
                if (string.IsNullOrWhiteSpace(result.AvatarUrl)) continue;

                // Patch the avatar onto messages that were already published
                // without one, in the app and on the overlay alike.
                PostEvent(Events.TwitchUserProfile, new { userId = result.UserId, avatarUrl = result.AvatarUrl });
                await _chatOverlay.PublishProfileAsync(result.UserId, result.AvatarUrl, null, _shutdown).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch
        {
        }

        // More arrived while this batch was in flight.
        bool more;
        lock (_profileQueueLock) more = _pendingProfileIds.Count > 0;
        if (more) _profileFlushTimer?.Change(ProfileFlushDelayMs, Timeout.Infinite);
    }

    /// <summary>
    /// Loads third-party emote sets and pushes them to the overlay.
    ///
    /// Best effort by design: if every provider is unreachable the overlay keeps
    /// whatever map it already had and those emotes simply render as text.
    /// </summary>
    private async Task RefreshEmotesAsync(string broadcasterUserId)
    {
        try
        {
            var providers = await _emotes.RefreshAsync(broadcasterUserId, _shutdown).ConfigureAwait(false);
            if (providers.Count == 0) return;
            await _chatOverlay.PublishEmotesAsync(providers, _shutdown).ConfigureAwait(false);
            Log("system", $"EMOTES LOADED · {string.Join(", ", providers.Select(p => $"{p.Key} {p.Value.Count}"))}");
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch
        {
        }
    }

    private async Task PublishChatClearAsync(ChatClear clear)
    {
        try
        {
            PostEvent(Events.TwitchChatCleared, new { scope = clear.Scope.ToString().ToLowerInvariant(), id = clear.Id });
            await _chatOverlay.PublishClearAsync(clear, _shutdown).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch
        {
        }
    }

    private async Task PublishChatOverlayMessageAsync(ChatMessage message)
    {
        try
        {
            await _chatOverlay.PublishChatMessageAsync(message, _shutdown).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch
        {
        }
    }

    private async Task SetChatOverlayConnectedAsync(bool connected)
    {
        try
        {
            await _chatOverlay.SetConnectedAsync(connected, _shutdown).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch
        {
        }
    }

    private void WireTwitch()
    {
        _twitch.ChatMessageReceived += message =>
        {
            if (!AllowChatRelay()) return;
            var publishedMessage = message;
            if (!string.IsNullOrWhiteSpace(message.UserId) && _twitchUserProfiles.TryGet(message.UserId, out var avatarUrl))
            {
                publishedMessage = message with { AvatarUrl = avatarUrl };
            }

            var senderLogin = (message.UserLogin ?? message.Username ?? string.Empty).ToLowerInvariant();
            var isHostCandidate = message.IsBroadcaster ||
                string.Equals(senderLogin, _twitchChannel?.ToLowerInvariant(), StringComparison.OrdinalIgnoreCase) ||
                (!string.IsNullOrWhiteSpace(_botLogin) && string.Equals(senderLogin, _botLogin.ToLowerInvariant(), StringComparison.OrdinalIgnoreCase));

            if (isHostCandidate && _echoTracker.IsEchoAndConsume(senderLogin, message.Message ?? string.Empty, _twitchChannel, _botLogin))
            {
                if (!string.IsNullOrWhiteSpace(publishedMessage.UserId))
                {
                    var login = publishedMessage.UserLogin ?? publishedMessage.Username.ToLowerInvariant();
                    var displayName = publishedMessage.DisplayName ?? publishedMessage.Username;
                    var info = (publishedMessage.UserId, login, displayName, publishedMessage.AvatarUrl);
                    _knownChatters[publishedMessage.UserId] = info;
                    _knownChatters[login] = info;
                    _knownChatters[displayName] = info;
                    var norm = TwitchPrivmsgParser.NormalizeArabic(displayName);
                    if (!string.IsNullOrWhiteSpace(norm))
                    {
                        _knownChatters[norm] = info;
                    }
                }

                if (!string.IsNullOrWhiteSpace(message.UserId) && !_twitchUserProfiles.TryGet(message.UserId, out _))
                {
                    QueueTwitchUserProfile(message.UserId, message.Username ?? senderLogin);
                }

                return;
            }

            Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{publishedMessage.Username}: {publishedMessage.Message}");
            if (!string.IsNullOrWhiteSpace(publishedMessage.UserId))
            {
                var login = publishedMessage.UserLogin ?? publishedMessage.Username.ToLowerInvariant();
                var displayName = publishedMessage.DisplayName ?? publishedMessage.Username;
                var info = (publishedMessage.UserId, login, displayName, publishedMessage.AvatarUrl);
                _knownChatters[publishedMessage.UserId] = info;
                _knownChatters[login] = info;
                _knownChatters[displayName] = info;
                var norm = TwitchPrivmsgParser.NormalizeArabic(displayName);
                if (!string.IsNullOrWhiteSpace(norm))
                {
                    _knownChatters[norm] = info;
                }
            }

            PostEvent(Events.TwitchChatMessage, publishedMessage);
            _ = PublishChatOverlayMessageAsync(publishedMessage);
            if (!string.IsNullOrWhiteSpace(publishedMessage.CustomRewardId))
            {
                var redemptionId = $"irc-{publishedMessage.Id}";
                // Skip IRC redemption if EventSub is actively connected or if already recorded
                if (!_eventSub.IsConnected && TryRecordRedemption(redemptionId, publishedMessage.CustomRewardId, publishedMessage.UserId, publishedMessage.Message))
                {
                    var redemption = new ChannelPointsRedemption
                    {
                        Id = redemptionId,
                        RewardId = publishedMessage.CustomRewardId,
                        RewardTitle = string.Empty,
                        UserId = publishedMessage.UserId ?? string.Empty,
                        UserName = publishedMessage.Username,
                        UserLogin = publishedMessage.Username.ToLowerInvariant(),
                        UserInput = publishedMessage.Message,
                        RedeemedAt = publishedMessage.Timestamp,
                    };
                    PostEvent(Events.TwitchChannelPointsRedeemed, redemption);
                    Log("trigger", $"CHANNEL POINTS REDEEMED (CHAT) · {publishedMessage.Username} (Reward ID: {publishedMessage.CustomRewardId})");
                }
            }
            if (!string.IsNullOrWhiteSpace(message.UserId) && !_twitchUserProfiles.TryGet(message.UserId, out _))
            {
                QueueTwitchUserProfile(message.UserId, message.Username ?? senderLogin);
            }
        };
        _twitch.ChatCleared += clear => _ = PublishChatClearAsync(clear);
        _twitch.RaidReceived += HandleRaid;
        _eventSub.RaidReceived += HandleRaid;
        _eventSub.ChannelPointsRedeemed += redemption =>
        {
            if (TryRecordRedemption(redemption.Id, redemption.RewardId, redemption.UserId, redemption.UserInput))
            {
                PostEvent(Events.TwitchChannelPointsRedeemed, redemption);
                var title = !string.IsNullOrWhiteSpace(redemption.RewardTitle) ? redemption.RewardTitle : (!string.IsNullOrWhiteSpace(redemption.RewardId) ? $"Reward {redemption.RewardId}" : "Custom Reward");
                Log("trigger", $"CHANNEL POINTS REDEEMED · {redemption.UserName} redeemed '{title}'");
            }
        };
        _eventSub.FollowReceived += follow =>
        {
            PostEvent(Events.TwitchFollow, follow);
            Log("trigger", $"TWITCH FOLLOW · {follow.UserName} just followed!");
        };
        _twitch.WatchStreakReceived += streak =>
        {
            PostEvent(Events.TwitchWatchStreak, streak);
            Log("trigger", $"WATCH STREAK · {streak.UserName} shared a {streak.Streak}-stream watch streak!");
        };
        var obsInit = _settings.GetObsSettings();
        if (string.IsNullOrWhiteSpace(obsInit.Password))
        {
            var detected = ObsWebSocketClient.TryAutoDetectLocalConfig();
            if (detected.Found)
            {
                obsInit = obsInit with
                {
                    Host = detected.Host,
                    Port = detected.Port,
                    Password = detected.Password,
                    AutoConnect = true
                };
                _settings.SaveObsSettings(obsInit);
                Log("system", $"[OBS] Auto-detected local OBS Studio WebSocket settings on port {detected.Port}");
            }
        }

        _obsWs.Configure(obsInit.Host, obsInit.Port, obsInit.Password);
        _obsWs.ConnectionChanged += connected =>
        {
            PostEvent(Events.ObsWebsocketStatusChanged, new { connected });
        };
        _obsWs.LogMessage += msg => Log("system", msg);
        if (obsInit.AutoConnect)
        {
            _ = Task.Run(async () =>
            {
                try { await _obsWs.ConnectAsync().ConfigureAwait(false); } catch { }
            });
        }
        _eventSub.ChannelTitleUpdated += updatedTitle =>
        {
            if (string.IsNullOrWhiteSpace(updatedTitle)) return;
            _twitch.SetLastKnownTitle(updatedTitle);
            _ = WriteTitleFileAsync(updatedTitle);
            PostEvent(Events.TwitchTitleChanged, new { title = updatedTitle });
        };
        _eventSub.LogMessage += msg => Log("system", msg);
        _twitch.Info += info =>
        {
            var message = info.Key switch
            {
                "chat-joined" => CoreStrings.LF(Lang, "chat-joined", $"#{info.Arg}"),
                "notice" => CoreStrings.L(Lang, "notice") + ": " + info.Arg,
                "connect-failed" => CoreStrings.L(Lang, "connect-failed") + ": " + info.Arg,
                _ => CoreStrings.L(Lang, info.Key),
            };
            Log("system", message);
        };
        _twitch.StateChanged += state =>
        {
            Log("system", CoreStrings.L(Lang, "state-prefix") + CoreStrings.StateName(Lang, state));
            if (state == TwitchState.AuthFailed)
            {
                _authRequired = true;
                Log("system", CoreStrings.L(Lang, "auth-failed"));
            }
            else if (state == TwitchState.Connected)
            {
                _authRequired = false;
            }
            _ = SetChatOverlayConnectedAsync(state == TwitchState.Connected);
            EmitStatus();
        };
        _twitch.TokenRefreshRequested = async () =>
        {
            var tokens = _tokens.Load();
            if (tokens is null || string.IsNullOrWhiteSpace(tokens.RefreshToken)) return null;
            var refreshed = await TwitchAuth.RefreshAsync(TwitchConstants.ClientId, string.Empty, tokens.RefreshToken).ConfigureAwait(false);
            if (refreshed is null)
            {
                Log("system", "Automatic Twitch token refresh on HTTP 401 failed.");
                return null;
            }
            var updatedTokens = refreshed with { Login = tokens.Login };
            _tokens.Save(updatedTokens);
            Log("system", "Automatic Twitch token refresh on HTTP 401 succeeded.");
            return updatedTokens.AccessToken;
        };
        _botTwitch.TokenRefreshRequested = async () =>
        {
            var tokens = _botTokens.Load();
            if (tokens is null || string.IsNullOrWhiteSpace(tokens.RefreshToken)) return null;
            var refreshed = await TwitchAuth.RefreshAsync(TwitchConstants.ClientId, string.Empty, tokens.RefreshToken).ConfigureAwait(false);
            if (refreshed is null)
            {
                Log("system", "Automatic Bot token refresh on HTTP 401 failed.");
                return null;
            }
            var updatedTokens = refreshed with { Login = tokens.Login };
            _botTokens.Save(updatedTokens);
            Log("system", "Automatic Bot token refresh on HTTP 401 succeeded.");
            return updatedTokens.AccessToken;
        };
    }

    private void HandleRaid(TwitchRaidEvent raid)
    {
        var key = $"{raid.FromUserId}:{raid.FromUserLogin}:{raid.Viewers}".ToLowerInvariant();
        var now = DateTime.UtcNow;
        lock (_seenRaidsLock)
        {
            var expired = _seenRaids.Where(kv => (now - kv.Value).TotalSeconds > 60).Select(kv => kv.Key).ToList();
            foreach (var k in expired) _seenRaids.Remove(k);

            if (_seenRaids.TryGetValue(key, out var lastTime) && (now - lastTime).TotalSeconds < 30)
            {
                return;
            }
            _seenRaids[key] = now;
        }

        PostEvent(Events.TwitchRaid, raid);
        Log("trigger", $"RAID RECEIVED · @{raid.FromUserName} raided with {raid.Viewers} viewers!");
    }

    private async Task WriteTitleFileAsync(string title)
    {
        try
        {
            var titlePath = Path.Combine(_appData, "title.txt");
            await _obs.WriteAsync(titlePath, title, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log("system", $"FAILED TO WRITE TITLE FILE: {ex.Message}");
        }
    }

    private void WireBotState()
    {
        _botTwitch.StateChanged += state =>
        {
            if (state == TwitchState.AuthFailed) Log("system", "BOT ACCOUNT AUTHENTICATION FAILED");
            EmitStatus();
        };
    }

    private bool AllowChatRelay()
    {
        var now = DateTime.UtcNow;
        if ((now - _chatWindow).TotalSeconds >= 1)
        {
            _chatWindow = now;
            _chatBurst = 0;
        }
        return _chatBurst++ < 20;
    }

    private async Task<bool> AllowAiRequestAsync()
    {
        await _aiRequestLock.WaitAsync().ConfigureAwait(false);
        try
        {
            var now = DateTime.UtcNow;
            if ((now - _aiWindow).TotalMinutes >= 1)
            {
                _aiWindow = now;
                _aiRequestsInWindow = 0;
            }
            if (_aiRequestsInWindow >= 10) return false;
            _aiRequestsInWindow++;
            return true;
        }
        finally
        {
            _aiRequestLock.Release();
        }
    }

    private (ITwitchClient client, string senderRole, string senderLogin) ResolveActiveChatSender(string? overrideRole = null)
    {
        var targetRole = !string.IsNullOrWhiteSpace(overrideRole) && overrideRole is "bot" or "broadcaster"
            ? overrideRole
            : _settings.PreferredChatSender;
        var preferBot = targetRole != "broadcaster";
        if (preferBot && _settings.BotAccountEnabled && (_botTwitch.State == TwitchState.Connected || _botSimulated))
        {
            return (_botSimulated ? _twitch : _botTwitch, "bot", !string.IsNullOrWhiteSpace(_botLogin) ? _botLogin : "ExampleBot");
        }
        return (_twitch, "broadcaster", _twitchChannel);
    }

    private async Task<bool> SendChatMessageCoreAsync(string message, string? overrideRole = null)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        await _chatSendLock.WaitAsync().ConfigureAwait(false);
        try
        {
            var elapsed = DateTime.UtcNow - _lastChatSentAt;
            if (elapsed < TimeSpan.FromSeconds(1))
                await Task.Delay(TimeSpan.FromSeconds(1) - elapsed).ConfigureAwait(false);
            var (chatClient, senderRole, senderLogin) = ResolveActiveChatSender(overrideRole);
            var trimmed = message.Trim();
            var ok = await chatClient.SendChatMessageAsync(trimmed).ConfigureAwait(false);
            if (ok)
            {
                _lastChatSentAt = DateTime.UtcNow;
                PublishSelfChatMessage(trimmed, senderRole, senderLogin);
            }
            return ok;
        }
        finally
        {
            _chatSendLock.Release();
        }
    }

    private void PublishSelfChatMessage(string text, string senderRole, string senderLogin)
    {
        try
        {
            var username = !string.IsNullOrWhiteSpace(senderLogin) ? senderLogin : (!string.IsNullOrWhiteSpace(_twitchChannel) ? _twitchChannel : "Streamer");
            _echoTracker.TrackSent(username, text);
            var isBroadcaster = senderRole == "broadcaster" || string.Equals(username, _twitchChannel, StringComparison.OrdinalIgnoreCase);
            var isMod = !isBroadcaster;
            string? avatarUrl = null;
            if (_twitchUserProfiles.TryGet(username, out var avatar))
            {
                avatarUrl = avatar;
            }

            var chatMessage = new ChatMessage
            {
                Id = $"self-{Guid.NewGuid():N}",
                Username = username,
                UserId = username.ToLowerInvariant(),
                AvatarUrl = avatarUrl,
                IsBroadcaster = isBroadcaster,
                IsMod = isMod,
                IsVip = false,
                IsSubscriber = isBroadcaster,
                Message = text,
                Timestamp = DateTime.UtcNow.ToString("o"),
                Color = isBroadcaster ? "#e91916" : "#00ad03",
                IsSelf = true,
            };

            Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{chatMessage.Username}: {chatMessage.Message}");
            PostEvent(Events.TwitchChatMessage, chatMessage);
            _ = PublishChatOverlayMessageAsync(chatMessage);
        }
        catch (Exception ex)
        {
            Log("error", $"Failed to publish self chat message: {ex.Message}");
        }
    }

    private object BuildStatus()
    {
        var (_, activeRole, activeLogin) = ResolveActiveChatSender();
        return new ConnectionStatus
        {
            CoreConnected = true,
            CoreVersion = typeof(HostController).Assembly.GetName().Version?.ToString(3) ?? "0.1.0",
            TwitchConnected = _twitch.State == TwitchState.Connected,
            TwitchChannel = _twitchChannel,
            AuthRequired = _authRequired,
            BotAccountEnabled = _settings.BotAccountEnabled,
            BotConnected = _botTwitch.State == TwitchState.Connected || _botSimulated,
            BotLogin = _botLogin,
            PreferredChatSender = _settings.PreferredChatSender,
            ActiveChatSender = activeRole,
            ActiveChatSenderLogin = activeLogin,
        };
    }

    private async Task<UpdateCheckResponse> CheckForUpdateAsync(CancellationToken ct)
    {
        var current = typeof(HostController).Assembly.GetName().Version?.ToString(3) ?? "0.1.0";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.github.com/repos/{UpdateRepository}/releases/latest");
            request.Headers.UserAgent.Add(new ProductInfoHeaderValue("StreamerHub", current));
            using var response = await UpdateHttp.SendAsync(request, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return new UpdateCheckResponse(current, current, false, $"https://github.com/{UpdateRepository}/releases/latest");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false));
            var root = document.RootElement;
            var tag = root.TryGetProperty("tag_name", out var tagValue) ? tagValue.GetString() ?? current : current;
            var latest = tag.Trim().TrimStart('v', 'V');
            var releaseUrl = root.TryGetProperty("html_url", out var urlValue) ? urlValue.GetString() ?? $"https://github.com/{UpdateRepository}/releases/latest" : $"https://github.com/{UpdateRepository}/releases/latest";
            string? downloadUrl = null;
            downloadUrl = UpdateSupport.SelectInstallerDownloadUrl(root);
            var releaseNotes = root.TryGetProperty("body", out var bodyValue) ? bodyValue.GetString() : null;
            if (string.IsNullOrWhiteSpace(releaseNotes)) releaseNotes = null;
            else if (releaseNotes.Length > 4000) releaseNotes = releaseNotes[..4000];
            return new UpdateCheckResponse(current, latest, IsNewerVersion(latest, current), releaseUrl, downloadUrl, releaseNotes);
        }
        catch
        {
            return new UpdateCheckResponse(current, current, false, $"https://github.com/{UpdateRepository}/releases/latest");
        }
    }

    private async Task<object> InstallUpdateAsync(JsonElement? payload, CancellationToken ct)
    {
        var request = Json.Deserialize<UpdateInstallPayload>(payload ?? default);
        if (request is null || !Uri.TryCreate(request.DownloadUrl, UriKind.Absolute, out var downloadUri) || downloadUri.Host != "github.com" && downloadUri.Host != "objects.githubusercontent.com" && downloadUri.Host != "release-assets.githubusercontent.com")
            return new { ok = false, error = "INVALID UPDATE DOWNLOAD" };
        try
        {
            using var response = await UpdateHttp.GetAsync(downloadUri, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return new { ok = false, error = "UPDATE DOWNLOAD FAILED" };
            var installerPath = Path.Combine(Path.GetTempPath(), $"StreamerHub-update-{Guid.NewGuid():N}.exe");
            await using (var output = File.Create(installerPath))
                await response.Content.CopyToAsync(output, ct).ConfigureAwait(false);
            var updaterPath = Path.Combine(Path.GetTempPath(), $"StreamerHub-updater-{Guid.NewGuid():N}.ps1");
            var appPath = Process.GetCurrentProcess().MainModule?.FileName ?? Path.Combine(AppContext.BaseDirectory, "StreamerHub.exe");
            var currentPid = Environment.ProcessId;
            var appDirectory = Path.GetDirectoryName(appPath) ?? AppContext.BaseDirectory;
            var installerArguments = UpdateSupport.BuildInstallerArguments(appDirectory);
            static string PsQuote(string value) => "'" + value.Replace("'", "''") + "'";
            var script = string.Join(Environment.NewLine, new[]
            {
                "$ErrorActionPreference = 'Stop'",
                // Bounded wait. An unbounded loop meant that any failure to exit
                // hung the update forever and left this script running with it.
                // If the app somehow outlives the deadline, carry on anyway -
                // /CLOSEAPPLICATIONS lets the installer deal with it.
                "$deadline = (Get-Date).AddSeconds(60)",
                $"while ((Get-Process -Id {currentPid} -ErrorAction SilentlyContinue) -and ((Get-Date) -lt $deadline)) {{ Start-Sleep -Milliseconds 250 }}",
                "try {",
                $"  Start-Process -FilePath {PsQuote(installerPath)} -ArgumentList {PsQuote(installerArguments)} -Wait",
                "} catch {",
                "} finally {",
                // The app is restarted whether the installer succeeded or not,
                // so a failed update never leaves the user with nothing running.
                $"  Start-Process -FilePath {PsQuote(appPath)}",
                "}",
                $"Remove-Item -LiteralPath {PsQuote(installerPath)} -Force -ErrorAction SilentlyContinue",
                "Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue",
            });
            await File.WriteAllTextAsync(updaterPath, script, ct).ConfigureAwait(false);
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{updaterPath}\"",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                UseShellExecute = true,
            });
            if (process is null) return new { ok = false, error = "UPDATE HANDOFF COULD NOT START" };
            Ui(() =>
            {
                var closeTimer = new System.Windows.Forms.Timer { Interval = 500 };
                closeTimer.Tick += (_, _) =>
                {
                    closeTimer.Stop();
                    closeTimer.Dispose();
                    // Not Close(): with close-to-tray enabled that is cancelled
                    // in favour of hiding, the process stays alive, and the
                    // updater waits forever for it to exit.
                    _form.ExitForUpdate();
                };
                closeTimer.Start();
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            Log("system", $"UPDATE INSTALL FAILED: {ex.Message}");
            return new { ok = false, error = "UPDATE INSTALL FAILED" };
        }
    }
    private static bool IsNewerVersion(string latest, string current) =>
        Version.TryParse(latest, out var latestVersion) && Version.TryParse(current, out var currentVersion) && latestVersion > currentVersion;

    private void EmitStatus() => PostEvent(Events.CoreStatusChanged, BuildStatus());

    private async Task ConnectWithTokensAsync(TwitchTokens tokens, string clientId)
    {
        if (tokens.ExpiresAtUtc <= DateTime.UtcNow.AddMinutes(5))
        {
            var refreshed = await TwitchAuth.RefreshAsync(clientId, string.Empty, tokens.RefreshToken).ConfigureAwait(false);
            if (refreshed is null)
            {
                _authRequired = true;
                Log("system", CoreStrings.L(Lang, "refresh-failed"));
                EmitStatus();
                return;
            }
            tokens = refreshed with { Login = tokens.Login };
            _tokens.Save(tokens);
        }

        var login = tokens.Login;
        var (validatedLogin, broadcasterUserId) = await TwitchAuth.ValidateAsync(tokens.AccessToken).ConfigureAwait(false);
        if (string.IsNullOrEmpty(login))
        {
            login = validatedLogin;
            if (login is null)
            {
                _authRequired = true;
                Log("system", CoreStrings.L(Lang, "token-invalid"));
                EmitStatus();
                return;
            }
            _tokens.Save(tokens with { Login = login });
        }

        _twitchChannel = login;
        _authRequired = false;
        EmitStatus();
        _twitch.Connect(tokens.AccessToken, login);
        if (!string.IsNullOrWhiteSpace(broadcasterUserId))
        {
            _ = RefreshEmotesAsync(broadcasterUserId);
            _eventSub.Connect(tokens.AccessToken, broadcasterUserId);
        }
        if (_settings.BotAccountEnabled)
        {
            var botTokens = _botTokens.Load();
            if (botTokens is not null) _ = ConnectBotWithTokensAsync(botTokens);
        }
    }

    private async Task ConnectBotWithTokensAsync(TwitchTokens tokens)
    {
        if (tokens.ExpiresAtUtc <= DateTime.UtcNow.AddMinutes(5))
        {
            var refreshed = await TwitchAuth.RefreshAsync(TwitchConstants.ClientId, string.Empty, tokens.RefreshToken).ConfigureAwait(false);
            if (refreshed is null) { Log("system", "BOT ACCOUNT TOKEN REFRESH FAILED"); return; }
            tokens = refreshed with { Login = tokens.Login };
        }
        var login = tokens.Login ?? await TwitchAuth.ValidateLoginAsync(tokens.AccessToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(login)) { Log("system", "BOT ACCOUNT TOKEN IS INVALID"); return; }
        if (string.IsNullOrWhiteSpace(_twitchChannel)) { Log("system", "CONNECT THE BROADCASTER ACCOUNT BEFORE THE BOT ACCOUNT"); return; }
        tokens = tokens with { Login = login };
        _botTokens.Save(tokens);
        _botLogin = login;
        _botTwitch.Connect(tokens.AccessToken, login, _twitchChannel);
        EmitStatus();
    }

    public async Task TriggerAuthorizeAsync()
    {
        if (Interlocked.Exchange(ref _authorizeInProgress, 1) == 1)
        {
            Log("system", CoreStrings.L(Lang, "login-in-progress"));
            return;
        }
        try
        {
            await TriggerAuthorizeCoreAsync().ConfigureAwait(false);
        }
        finally
        {
            Interlocked.Exchange(ref _authorizeInProgress, 0);
        }
    }

    private async Task TriggerBotAuthorizeAsync()
    {
        if (Interlocked.Exchange(ref _botAuthorizeInProgress, 1) == 1) return;
        try
        {
            var (device, deviceError) = await TwitchAuth.RequestDeviceCodeAsync(TwitchConstants.ClientId, _shutdown).ConfigureAwait(false);
            if (device is null) { Log("system", "BOT DEVICE LOGIN FAILED · " + (deviceError ?? "UNKNOWN ERROR")); return; }
            Log("system", $"BOT LOGIN · ENTER CODE {device.UserCode} IN YOUR BROWSER");
            TwitchAuth.OpenBrowser(device.VerificationUri);
            var (tokens, exchangeError) = await TwitchAuth.PollDeviceCodeAsync(TwitchConstants.ClientId, device, _shutdown).ConfigureAwait(false);
            if (tokens is null) { Log("system", "BOT LOGIN FAILED · " + (exchangeError ?? "UNKNOWN ERROR")); return; }
            _botTokens.Save(tokens);
            await ConnectBotWithTokensAsync(tokens).ConfigureAwait(false);
        }
        finally { Interlocked.Exchange(ref _botAuthorizeInProgress, 0); }
    }

    private async Task TriggerAuthorizeCoreAsync()
    {
        var (device, deviceError) = await TwitchAuth.RequestDeviceCodeAsync(TwitchConstants.ClientId, _shutdown).ConfigureAwait(false);
        if (device is null)
        {
            _authRequired = true;
            if (!_shutdown.IsCancellationRequested) Log("system", "TWITCH DEVICE LOGIN FAILED · " + (deviceError ?? "UNKNOWN ERROR"));
            EmitStatus();
            return;
        }

        Log("system", $"TWITCH LOGIN · ENTER CODE {device.UserCode} IN YOUR BROWSER");
        TwitchAuth.OpenBrowser(device.VerificationUri);
        var (tokens, exchangeError) = await TwitchAuth.PollDeviceCodeAsync(TwitchConstants.ClientId, device, _shutdown).ConfigureAwait(false);
        if (tokens is null)
        {
            _authRequired = true;
            Log("system", CoreStrings.L(Lang, "exchange-failed") + (exchangeError ?? "UNKNOWN ERROR"));
            EmitStatus();
            return;
        }
        _tokens.Save(tokens);
        Log("system", CoreStrings.L(Lang, "linked"));
        await ConnectWithTokensAsync(tokens, TwitchConstants.ClientId).ConfigureAwait(false);
    }

    private string? ShowSaveDialog(string defaultName)
    {
        string? path = null;
        Ui(() =>
        {
            using var dialog = new SaveFileDialog
            {
                FileName = defaultName,
                Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*",
                Title = "Choose the OBS text file",
            };
            if (dialog.ShowDialog(_form) == DialogResult.OK) path = dialog.FileName;
        });
        return path;
    }

    private string? ShowOpenDialog(string filter, string title)
    {
        string? path = null;
        Ui(() =>
        {
            using var dialog = new OpenFileDialog
            {
                Filter = filter,
                Title = title,
            };
            if (dialog.ShowDialog(_form) == DialogResult.OK) path = dialog.FileName;
        });
        return path;
    }

    private void RefreshKeybinds()
    {
        var valid = new List<ActionKeybind>();
        var orphaned = new Dictionary<string, KeybindRegistration>(StringComparer.Ordinal);
        foreach (var binding in _settings.Keybinds)
        {
            var actionValid = binding.TargetType switch
            {
                "counter" => binding.Action is "increase" or "decrease" or "reset",
                "title" => binding.Action is "increase" or "decrease" or "reset" or "apply",
                _ => false,
            };
            var targetExists = binding.TargetType switch
            {
                "counter" => _settings.Counters.Any(counter => counter.Id == binding.TargetId),
                "title" => _settings.AutoReplies.Any(rule => rule.Id == binding.TargetId && rule.TitleActionEnabled),
                _ => false,
            };
            if (!targetExists || !actionValid)
            {
                orphaned[binding.Id] = new(binding.Id, "orphaned", "The selected action no longer exists.");
                continue;
            }
            valid.Add(binding);
        }

        var registered = Ui(() => _form.ReplaceGlobalHotkeys(valid)) ?? Array.Empty<KeybindRegistration>();
        var byId = registered.ToDictionary(item => item.BindingId, StringComparer.Ordinal);
        _keybindRegistrations = _settings.Keybinds
            .Select(binding => orphaned.GetValueOrDefault(binding.Id)
                ?? byId.GetValueOrDefault(binding.Id)
                ?? new KeybindRegistration(binding.Id, "unsupported", "Could not register this shortcut."))
            .ToList();
    }

    private void Ui(Action action)
    {
        if (_form.InvokeRequired) _form.Invoke(action);
        else action();
    }

    private T? Ui<T>(Func<T> action)
    {
        if (_form.InvokeRequired) return (T?)_form.Invoke(action);
        return action();
    }

    private void Log(string kind, string message, bool emitEvent = true)
    {
        try
        {
            File.AppendAllText(_logPath, $"[{DateTime.Now:HH:mm:ss}] [{kind.ToUpperInvariant()}] {message}{Environment.NewLine}");
            if (emitEvent)
            {
                PostEvent(Events.CoreLog, new { message = $"[{kind.ToUpperInvariant()}] {message}" });
            }
        }
        catch
        {
        }
    }

    private async Task<GenerateAiPollResponse> GenerateAiPollAsync(GenerateAiPollPayload request, CancellationToken ct)
    {
        var topic = request.Topic.Trim();
        var instructions = request.Instructions?.Trim() ?? string.Empty;
        var count = Math.Clamp(request.OptionCount, 2, 6);
        var isArabic = string.Equals(request.Language, "ar", StringComparison.OrdinalIgnoreCase) ||
                       (topic + " " + instructions).Any(c => c >= '\u0600' && c <= '\u06FF');

        string title = string.Empty;
        var candidateLabels = new List<string>();

        // 1. Try LLM generation if OpenRouter / Groq key is configured
        var groqKey = _groqKey.Load();
        var openRouterKey = _openRouterKey.Load();
        var hasKey = !string.IsNullOrWhiteSpace(groqKey) || !string.IsNullOrWhiteSpace(openRouterKey);

        if (hasKey)
        {
            try
            {
                var provider = !string.IsNullOrWhiteSpace(groqKey) ? "groq" : "openrouter";
                var key = provider == "groq" ? groqKey : openRouterKey;
                var model = provider == "groq" ? "openai/gpt-oss-20b" : "qwen/qwen3.8-27b:free";

                var sysPrompt = isArabic
                    ? $"أنت مساعد بث ذكي للمذيع المباشر على تويتش. مهمتك هي إنشاء استطلاع رأي جذاب وممتع للمشاهدين.\n" +
                      $"يجب أن ترجع استجابتك بتنسيق JSON حصراً بدون أي نصوص إضافية:\n" +
                      $"{{\n  \"title\": \"سؤال الاستطلاع هنا\",\n  \"options\": [\"الخيار الأول\", \"الخيار الثاني\", ...]\n}}\n" +
                      $"عدد الخيارات المطلوب: {count} خيارات. يجب أن تكون الخيارات أسماء دقيقة للألعاب أو المواضيع المطلوبة."
                    : $"You are an AI stream assistant helping a Twitch streamer create an engaging live poll.\n" +
                      $"Return ONLY a valid JSON object matching this exact format with NO markdown fences, no thinking, and no surrounding text:\n" +
                      $"{{\n  \"title\": \"A concise, engaging poll question\",\n  \"options\": [\"Option 1\", \"Option 2\", ...]\n}}\n" +
                      $"Required number of options: exactly {count}. Each option must be the exact specific name of the game/topic.";

                var userPrompt = $"Streamer topic/question: {topic}\n" +
                                 (!string.IsNullOrWhiteSpace(instructions) ? $"Additional instructions: {instructions}\n" : "") +
                                 $"Generate the poll title and {count} options now in JSON.";

                var genResult = await _openRouter.GenerateAsync(
                    provider,
                    key!,
                    model,
                    sysPrompt,
                    new ChatMessage { Message = userPrompt, Username = "Streamer" },
                    400,
                    ct
                ).ConfigureAwait(false);

                if (genResult.Ok && !string.IsNullOrWhiteSpace(genResult.Message))
                {
                    var raw = genResult.Message.Trim();
                    if (raw.StartsWith("```"))
                    {
                        var firstNewline = raw.IndexOf('\n');
                        if (firstNewline > 0) raw = raw[(firstNewline + 1)..];
                        if (raw.EndsWith("```")) raw = raw[..^3].Trim();
                    }

                    using var doc = JsonDocument.Parse(raw);
                    if (doc.RootElement.TryGetProperty("title", out var titleElem))
                    {
                        title = titleElem.GetString() ?? string.Empty;
                    }
                    if (doc.RootElement.TryGetProperty("options", out var optionsElem) && optionsElem.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var opt in optionsElem.EnumerateArray())
                        {
                            var s = opt.GetString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(s) && !candidateLabels.Contains(s))
                            {
                                candidateLabels.Add(s);
                                if (candidateLabels.Count >= count) break;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log("system", $"AI Poll generation fallback triggered: {ex.Message}");
            }
        }

        // 2. Intelligent Curated Catalog Fallback if LLM was skipped or returned incomplete options
        if (candidateLabels.Count < 2)
        {
            var fallback = ResolveCuratedPoll(topic, count, isArabic);
            title = fallback.Title;
            candidateLabels = fallback.Options.Take(count).ToList();
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            title = isArabic ? $"استطلاع: {topic}" : $"Poll: {topic}";
        }

        // 3. Resolve images for each option (via Steam Store Search or high-res artwork)
        var defaultColors = new[]
        {
            "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"
        };

        var finalOptions = new List<AiPollOptionDto>();
        for (int i = 0; i < candidateLabels.Count; i++)
        {
            var label = candidateLabels[i];
            var color = defaultColors[i % defaultColors.Length];
            var imgUrl = await SearchGameOrTopicImageAsync(label, ct).ConfigureAwait(false);
            finalOptions.Add(new AiPollOptionDto(label, imgUrl, color));
        }

        return new GenerateAiPollResponse(true, title, finalOptions);
    }

    private static (string Title, List<string> Options) ResolveCuratedPoll(string topic, int count, bool isArabic)
    {
        var lower = topic.ToLowerInvariant();

        if (lower.Contains("open world") || lower.Contains("عالم مفتوح"))
        {
            return (
                isArabic ? "ما هي أفضل لعبة عالم مفتوح؟" : "What is the best open-world game?",
                new List<string> { "The Witcher 3: Wild Hunt", "Elden Ring", "Cyberpunk 2077", "Red Dead Redemption 2", "Grand Theft Auto V", "The Legend of Zelda: Tears of the Kingdom" }
            );
        }

        if (lower.Contains("horror") || lower.Contains("رعب"))
        {
            return (
                isArabic ? "أي لعبة رعب نلعبها في البث؟" : "Which horror game should we stream?",
                new List<string> { "Resident Evil 4", "Silent Hill 2", "Dead Space", "Alan Wake 2", "Outlast", "Amnesia: The Dark Descent" }
            );
        }

        if (lower.Contains("fps") || lower.Contains("shooter") || lower.Contains("تصويب"))
        {
            return (
                isArabic ? "ما هي أفضل لعبة تصويب؟" : "Best competitive FPS shooter?",
                new List<string> { "Valorant", "Counter-Strike 2", "Overwatch 2", "Apex Legends", "Call of Duty: Warzone", "Rainbow Six Siege" }
            );
        }

        if (lower.Contains("souls") || lower.Contains("سولز") || lower.Contains("fromsoft"))
        {
            return (
                isArabic ? "أفضل لعبة سولز بالنسبة لك؟" : "Best Souls-like challenge?",
                new List<string> { "Elden Ring", "Dark Souls III", "Bloodborne", "Sekiro: Shadows Die Twice", "Lies of P", "Demon's Souls" }
            );
        }

        if (lower.Contains("cozy") || lower.Contains("chill") || lower.Contains("مريحة") || lower.Contains("استرخاء"))
        {
            return (
                isArabic ? "أفضل لعبة استرخاء للبث؟" : "Best cozy game for stream?",
                new List<string> { "Stardew Valley", "Minecraft", "Animal Crossing: New Horizons", "Terraria", "Slime Rancher", "Dave the Diver" }
            );
        }

        if (lower.Contains("battle royale") || lower.Contains("باتل رويال"))
        {
            return (
                isArabic ? "أي لعبة باتل رويال نلعب اليوم؟" : "Which Battle Royale today?",
                new List<string> { "Fortnite", "Apex Legends", "Call of Duty: Warzone", "PUBG: Battlegrounds" }
            );
        }

        if (lower.Contains("anime") || lower.Contains("أنمي"))
        {
            return (
                isArabic ? "ما هو أفضل أنمي؟" : "Best Anime of All Time?",
                new List<string> { "Attack on Titan", "One Piece", "Fullmetal Alchemist: Brotherhood", "Jujutsu Kaisen", "Demon Slayer", "Death Note" }
            );
        }

        // Generic intelligent fallback
        var genericTitle = isArabic ? $"استطلاع: {topic}" : $"Poll: {topic}";
        var genericOptions = isArabic
            ? new List<string> { "الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع" }
            : new List<string> { "Option A", "Option B", "Option C", "Option D" };

        return (genericTitle, genericOptions);
    }

    private static async Task<string?> SearchGameOrTopicImageAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;

        try
        {
            var steamUrl = $"https://steamcommunity.com/actions/SearchApps/{Uri.EscapeDataString(query.Trim())}";
            using var req = new HttpRequestMessage(HttpMethod.Get, steamUrl);
            req.Headers.Add("User-Agent", "StreamerHub/0.3.8");
            using var resp = await UpdateHttp.SendAsync(req, ct).ConfigureAwait(false);
            if (resp.IsSuccessStatusCode)
            {
                var json = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                {
                    var first = doc.RootElement[0];
                    if (first.TryGetProperty("appid", out var appidElem))
                    {
                        var appid = appidElem.GetString();
                        if (!string.IsNullOrWhiteSpace(appid))
                        {
                            return $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg";
                        }
                    }
                    if (first.TryGetProperty("logo", out var logoElem))
                    {
                        var logo = logoElem.GetString();
                        if (!string.IsNullOrWhiteSpace(logo)) return logo;
                    }
                }
            }
        }
        catch
        {
        }

        return null;
    }

    private async Task<GenerateGamingQuestionResponse> GenerateGamingQuestionAsync(GenerateGamingQuestionPayload request, CancellationToken ct)
    {
        var isArabic = string.Equals(request.Language, "ar", StringComparison.OrdinalIgnoreCase) ||
                       (request.Category?.Any(c => c >= '\u0600' && c <= '\u06FF') ?? false) ||
                       (request.CustomInstructions?.Any(c => c >= '\u0600' && c <= '\u06FF') ?? false);

        var recentList = GetRecentGamingQuestions();
        if (request.RecentQuestions != null)
        {
            foreach (var rq in request.RecentQuestions)
            {
                if (!string.IsNullOrWhiteSpace(rq) && !recentList.Contains(rq.Trim(), StringComparer.OrdinalIgnoreCase))
                {
                    recentList.Add(rq.Trim());
                }
            }
        }

        var groqKey = _groqKey.Load();
        var openRouterKey = _openRouterKey.Load();
        var hasKey = !string.IsNullOrWhiteSpace(groqKey) || !string.IsNullOrWhiteSpace(openRouterKey);

        if (hasKey)
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                try
                {
                    var provider = !string.IsNullOrWhiteSpace(groqKey) ? "groq" : "openrouter";
                    var key = provider == "groq" ? groqKey : openRouterKey;
                    var model = provider == "groq" ? "openai/gpt-oss-20b" : "qwen/qwen3.8-27b:free";

                    var sysPrompt = isArabic
                        ? "أنت محرك أسئلة مسابقات ألعاب فيديو لبث مباشر على تويتش.\n" +
                          "القواعد الصارمة والواجب اتباعها:\n" +
                          "1. أنشئ سؤالاً عاماً واحداً وممتعاً وموجزاً عن ألعاب الفيديو الشهيرة.\n" +
                          "2. يجب أن تكون الإجابة حقيقية ومؤكدة وصحيحة 100% في عالم ألعاب الفيديو من كلمة إلى 3 كلمات فقط. لا تخترع أو تخمّن إجابة خاطئة إطلاقاً.\n" +
                          "3. حقل acceptableAnswers يجب أن يشمل الإجابة باللغتين العربية والإنجليزية (مثال: إذا كان السؤال عن بطل زيلدا، تكون الإجابة 'لينك' ومصفوفة acceptableAnswers تحتوي على [\"لينك\", \"Link\"]).\n" +
                          "4. التنوع والتجديد إجباري: يُمنع تكرار نفس السؤال أو نفس اللعبة المطروحة مؤخراً. نوّع بين مختلف الألعاب والاستوديوهات والشخصيات والأدوات والعوالم.\n" +
                          "5. أرجع النتيجة بتنسيق JSON حصراً بدون أي كتل كود أو نصوص إضافية:\n" +
                          "{\n  \"question\": \"السؤال هنا؟\",\n  \"answer\": \"الإجابة\",\n  \"acceptableAnswers\": [\"الإجابة بالعربي\", \"EnglishAnswer\"]\n}"
                        : "You are a gaming trivia engine for a live Twitch stream showdown.\n" +
                          "Strict factual rules:\n" +
                          "1. Generate exactly 1 concise, fun trivia question about famous video games.\n" +
                          "2. The answer MUST be 100% factually correct, real, and well-known (1 to 3 words max). Never hallucinate or guess.\n" +
                          "3. The acceptableAnswers array MUST include both English and Arabic transliterations (e.g. for Link: [\"Link\", \"لينك\"]).\n" +
                          "4. Variety is mandatory: NEVER repeat recent questions or the same game/character. Vary across different franchises, worlds, items, and protagonists.\n" +
                          "5. Return ONLY a valid JSON object with NO markdown fences and no extra text:\n" +
                          "{\n  \"question\": \"Question here?\",\n  \"answer\": \"Primary Answer\",\n  \"acceptableAnswers\": [\"Primary Answer\", \"alias1\", \"ArabicOrEnglishVariant\"]\n}";

                    var category = string.IsNullOrWhiteSpace(request.Category) ? (isArabic ? "ألعاب فيديو عامة" : "general gaming") : request.Category.Trim();
                    var userPrompt = isArabic
                        ? $"أنشئ سؤال مسابقة ألعاب فيديو واحد بصيغة JSON الآن. التصنيف أو اللعبة: {category}."
                        : $"Generate 1 video game trivia question now in JSON. Category or game: {category}.";

                    if (!string.IsNullOrWhiteSpace(request.CustomInstructions))
                    {
                        userPrompt += isArabic
                            ? $"\nتعليمات وقواعد مخصصة:\n{request.CustomInstructions.Trim()}"
                            : $"\nCustom rules and instructions:\n{request.CustomInstructions.Trim()}";
                    }

                    if (recentList.Count > 0)
                    {
                        var recentItems = recentList.TakeLast(15).Select(q => $"- {q}");
                        userPrompt += isArabic
                            ? $"\n\nملاحظة هامة جداً لمنع التكرار - هذه الأسئلة والألعاب والإجابات طُرحت مؤخراً في الجولات السابقة (يُمنع منعاً باتاً تكرار أي منها أو طرح سؤال عن نفس اللعبة أو البطل، اختر لعبة وموضوعاً مختلفاً تماماً):\n{string.Join("\n", recentItems)}"
                            : $"\n\nCRITICAL - Prevent repetition - These questions/games/answers were recently asked (do NOT repeat them or ask about the same franchise/hero, pick a completely different game):\n{string.Join("\n", recentItems)}";
                    }

                    if (attempt > 0)
                    {
                        userPrompt += isArabic
                            ? "\n\nتنبيه إضافي: المحاولة السابقة أنتجت موضوعاً مكرراً. اختر فوراً لعبة مختلفة كلياً لم تُذكر سابقاً."
                            : "\n\nNOTE: The previous attempt generated a duplicate. Choose a completely different game franchise not mentioned above.";
                    }

                    var temp = attempt == 0 ? 0.75 : 0.9;
                    var genResult = await _openRouter.GenerateRawCompletionAsync(
                        provider,
                        key!,
                        model,
                        sysPrompt,
                        userPrompt,
                        300,
                        temp,
                        ct
                    ).ConfigureAwait(false);

                    if (genResult.Ok && !string.IsNullOrWhiteSpace(genResult.Message))
                    {
                        var raw = genResult.Message.Trim();
                        var startIdx = raw.IndexOf('{');
                        var endIdx = raw.LastIndexOf('}');
                        if (startIdx >= 0 && endIdx > startIdx)
                        {
                            raw = raw.Substring(startIdx, endIdx - startIdx + 1);
                        }

                        using var doc = JsonDocument.Parse(raw);
                        var q = doc.RootElement.TryGetProperty("question", out var qElem) ? qElem.GetString()?.Trim() : null;
                        var a = doc.RootElement.TryGetProperty("answer", out var aElem) ? aElem.GetString()?.Trim() : null;
                        var aliases = new List<string>();
                        if (doc.RootElement.TryGetProperty("acceptableAnswers", out var acc) && acc.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in acc.EnumerateArray())
                            {
                                var s = item.GetString()?.Trim();
                                if (!string.IsNullOrWhiteSpace(s)) aliases.Add(s);
                            }
                        }

                        if (!string.IsNullOrWhiteSpace(q) && !string.IsNullOrWhiteSpace(a))
                        {
                            var isDuplicate = IsGamingQuestionDuplicate(q, a, recentList);

                            if (!isDuplicate)
                            {
                                if (!aliases.Contains(a, StringComparer.OrdinalIgnoreCase)) aliases.Insert(0, a);
                                RecordRecentGamingQuestion(q, a);
                                return new GenerateGamingQuestionResponse(true, q, a, aliases);
                            }

                            Log("system", $"AI generated a duplicate/recent trivia question ('{q}' / '{a}'), retrying or falling back to diverse catalog.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log("system", $"AI Gaming trivia generation attempt {attempt + 1} fallback triggered: {ex.Message}");
                }
            }
        }

        // Curated bilingual gaming trivia catalog with topical tags
        var catalog = new (string Question, string Answer, string[] Aliases, bool Arabic, string[] Tags)[]
        {
            // English questions
            ("Who is the main protagonist of God of War?", "Kratos", new[] { "kratos", "كرايتوس", "كريتوس" }, false, new[] { "general", "playstation", "action" }),
            ("In Minecraft, what tool is required to mine obsidian?", "Diamond Pickaxe", new[] { "diamond pickaxe", "netherite pickaxe", "pickaxe" }, false, new[] { "general", "survival", "minecraft" }),
            ("What is the name of Mario's green-clad brother?", "Luigi", new[] { "luigi", "لويجي" }, false, new[] { "general", "nintendo", "mario" }),
            ("Which studio developed Elden Ring, Bloodborne, and Dark Souls?", "FromSoftware", new[] { "fromsoftware", "fromsoft", "فروم سوفتوير" }, false, new[] { "souls", "fromsoftware", "rpg" }),
            ("What game franchise features the phrase 'Praise the Sun'?", "Dark Souls", new[] { "dark souls", "دارك سولز" }, false, new[] { "souls", "dark souls" }),
            ("What is the name of the final boss in Elden Ring before the Elden Beast?", "Radagon", new[] { "radagon", "radagon of the golden order", "راداغون" }, false, new[] { "souls", "elden ring" }),
            ("In Bloodborne, what is the currency/experience gained from defeating enemies?", "Blood Echoes", new[] { "blood echoes", "echoes", "بلود ايكوز" }, false, new[] { "souls", "bloodborne" }),
            ("In Sekiro: Shadows Die Twice, what is Wolf's primary katana named?", "Kusabimaru", new[] { "kusabimaru", "katana", "sword", "كوسابيمارو" }, false, new[] { "souls", "sekiro" }),
            ("What is the flagship flying wyvern monster in Monster Hunter known as the King of the Skies?", "Rathalos", new[] { "rathalos", "راثالوس" }, false, new[] { "monster hunter", "capcom" }),
            ("In Monster Hunter, what are the feline companion hunters called?", "Palico", new[] { "palico", "palicoes", "felyne", "باليكو" }, false, new[] { "monster hunter" }),
            ("Which heavy weapon in Monster Hunter features a built-in explosive Wyvern's Fire attack?", "Gunlance", new[] { "gunlance", "غانلانس" }, false, new[] { "monster hunter" }),
            ("Which Japanese company created Resident Evil and Monster Hunter?", "Capcom", new[] { "capcom", "كابكوم" }, false, new[] { "monster hunter", "capcom" }),
            ("Who is the main protagonist of The Legend of Zelda series?", "Link", new[] { "link", "لينك", "لنك" }, false, new[] { "zelda", "nintendo", "general" }),
            ("What kingdom does Princess Zelda rule over?", "Hyrule", new[] { "hyrule", "هايرول" }, false, new[] { "zelda", "nintendo" }),
            ("What sacred triangular artifact in Zelda represents Power, Wisdom, and Courage?", "Triforce", new[] { "triforce", "ترايفورس" }, false, new[] { "zelda", "nintendo" }),
            ("What legendary blade sleeps in the Lost Woods in The Legend of Zelda?", "Master Sword", new[] { "master sword", "سيف الماستر", "ماستر سورد" }, false, new[] { "zelda", "nintendo" }),
            ("In Breath of the Wild, what are the tiny hidden forest spirits with leaf masks called?", "Koroks", new[] { "korok", "koroks", "كوروكس" }, false, new[] { "zelda", "nintendo" }),
            ("What is the name of the protagonist in The Witcher series?", "Geralt", new[] { "geralt", "geralt of rivia", "جيرالت" }, false, new[] { "rpg", "witcher" }),
            ("In Skyrim, what is the Dragonborn known as in the dragon language?", "Dovahkiin", new[] { "dovahkiin", "دوفاكين" }, false, new[] { "rpg", "skyrim" }),
            ("What is the name of Master Chief's AI companion in Halo?", "Cortana", new[] { "cortana", "كورتانا" }, false, new[] { "fps", "halo" }),
            ("Who is the main protagonist of Red Dead Redemption 2?", "Arthur Morgan", new[] { "arthur", "arthur morgan", "آرثر" }, false, new[] { "rpg", "rockstar" }),
            ("In Grand Theft Auto V, which character is a retired bank robber living in Rockford Hills?", "Michael", new[] { "michael", "michael de santa", "مايكل" }, false, new[] { "rpg", "gta" }),
            ("What puzzle game popularised the phrase 'The Cake is a Lie'?", "Portal", new[] { "portal", "بورتال" }, false, new[] { "general", "valve" }),
            ("What is the name of the underwater city in BioShock?", "Rapture" , new[] { "rapture", "رابتشر" }, false, new[] { "general", "fps" }),
            ("Who is the protagonist of the Tomb Raider series?", "Lara Croft", new[] { "lara", "lara croft", "لارا كروفت" }, false, new[] { "general", "action" }),
            ("In Overwatch, which hero says 'Cheers, love! The cavalry's here!'?", "Tracer", new[] { "tracer", "تريسر" }, false, new[] { "esports", "overwatch" }),
            ("In Valorant, what is the name of the explosive device attackers plant?", "Spike", new[] { "spike", "سبايك" }, false, new[] { "esports", "fps", "valorant" }),
            ("In Counter-Strike, what is the 7-digit bomb plant code?", "7355608", new[] { "7355608" }, false, new[] { "esports", "fps", "cs" }),
            ("What battle royale game features the Battle Bus and tilted towers?", "Fortnite", new[] { "fortnite", "فورتنايت" }, false, new[] { "esports", "fortnite" }),
            ("What weapon does Cloud Strife wield in Final Fantasy VII?", "Buster Sword", new[] { "buster sword", "sword", "باستر سورد" }, false, new[] { "rpg", "square" }),
            ("What is the fire starter Pokémon in Kanto (Gen 1)?", "Charmander", new[] { "charmander", "تشارمندر" }, false, new[] { "nintendo", "pokemon" }),
            ("In Cyberpunk 2077, what is the main city where the game is set?", "Night City", new[] { "night city", "نايت سيتي" }, false, new[] { "rpg", "cyberpunk" }),
            ("In Hollow Knight, what currency is used to buy charms and items?", "Geo", new[] { "geo", "جيو" }, false, new[] { "general", "indie" }),
            ("Who is the silent, crowbar-wielding physicist protagonist of Half-Life?", "Gordon Freeman", new[] { "gordon", "gordon freeman", "غوردون" }, false, new[] { "general", "fps" }),
            ("What is the speed-boosting mushroom item called in Mario Kart?", "Mushroom", new[] { "mushroom", "super mushroom", "golden mushroom", "مشروم" }, false, new[] { "nintendo", "mario" }),
            ("What is the name of Sonic the Hedgehog's two-tailed flying fox sidekick?", "Tails", new[] { "tails", "تيلز" }, false, new[] { "general", "sega" }),

            // Arabic questions
            ("من هو بطل سلسلة ألعاب God of War؟", "كريتوس", new[] { "كريتوس", "كرايتوس", "kratos" }, true, new[] { "general", "action" }),
            ("من هو بطل سلسلة ألعاب The Legend of Zelda؟", "لينك", new[] { "لينك", "لنك", "link" }, true, new[] { "zelda", "زيلدا", "nintendo" }),
            ("ما هو اسم بطل سلسلة ألعاب The Witcher؟", "جيرالت", new[] { "جيرالت", "قيرالت", "geralt", "geralt of rivia" }, true, new[] { "rpg", "witcher" }),
            ("ما هو الاستديو المطور للعبة Elden Ring و Dark Souls؟", "فروم سوفتوير", new[] { "فروم سوفتوير", "فروم سوفت", "fromsoftware", "fromsoft" }, true, new[] { "souls", "fromsoftware", "سولز" }),
            ("في لعبة Dark Souls، ما هي العبارة الشهيرة التي يرددها سولير لتمجيد الشمس؟", "Praise the Sun", new[] { "praise the sun", "برايز ذا سن", "مجد الشمس" }, true, new[] { "souls", "dark souls", "سولز" }),
            ("ما هو اسم الزعيم الأخير في إلدن رينغ قبل وحش الإلدن (Elden Beast)؟", "راداغون", new[] { "راداغون", "radagon" }, true, new[] { "souls", "elden ring", "سولز" }),
            ("في لعبة بلودبورن (Bloodborne)، ما هو اسم العملة ونقاط الخبرة الأساسية؟", "Blood Echoes", new[] { "blood echoes", "بلود ايكوز", "ايكوز" }, true, new[] { "souls", "bloodborne", "سولز" }),
            ("في سيكيرو (Sekiro)، ما هو اسم سيف البطل الرئيسي الذئب؟", "كوسابيمارو", new[] { "كوسابيمارو", "kusabimaru", "كاتانا" }, true, new[] { "souls", "sekiro", "سولز" }),
            ("في لعبة مونستر هنتر (Monster Hunter)، ما هو اسم التنين الطائر الأيقوني الملقب بملك السماء؟", "راثالوس", new[] { "راثالوس", "راثالوس", "rathalos" }, true, new[] { "monster hunter", "مونستر هنتر" }),
            ("في سلسلة Monster Hunter، ما اسم القطط المحاربة المرافقة للصياد؟", "باليكو", new[] { "باليكو", "palico", "فيلاين" }, true, new[] { "monster hunter", "مونستر هنتر" }),
            ("ما هي الشركة اليابانية المطورة لسلسلة ألعاب Monster Hunter و Resident Evil؟", "كابكوم", new[] { "كابكوم", "capcom" }, true, new[] { "monster hunter", "capcom" }),
            ("ما هي المملكة الشهيرة التي تدور فيها أحداث ألعاب The Legend of Zelda؟", "هايرول", new[] { "هايرول", "هيرول", "hyrule" }, true, new[] { "zelda", "زيلدا", "nintendo" }),
            ("ما هو السيف الأسطوري الشهير الخاص بلينك في سلسلة زيلدا؟", "ماستر سورد", new[] { "ماستر سورد", "سيف الماستر", "master sword" }, true, new[] { "zelda", "زيلدا", "nintendo" }),
            ("في سلسلة زيلدا، ما هو اسم القطعة الذهبية الثلاثية المقدسة التي ترمز للقوة والحكمة والشجاعة؟", "ترايفورس", new[] { "ترايفورس", "الترايفورس", "triforce" }, true, new[] { "zelda", "زيلدا", "nintendo" }),
            ("في لعبة Breath of the Wild، ما اسم الكائنات النباتية الصغيرة المخفية في أرجاء هايرول؟", "كوروغ", new[] { "كوروغ", "كوروكس", "korok", "koroks" }, true, new[] { "zelda", "زيلدا" }),
            ("في لعبة فالورانت (Valorant)، ما هو اسم القنبلة أو الجهاز المتفجر الذي يزرعه المهاجمون؟", "سبايك", new[] { "سبايك", "السبايك", "spike" }, true, new[] { "esports", "fps", "valorant" }),
            ("في لعبة كاونتر سترايك (CS:GO / CS2)، ما هو كود زرع القنبلة الشهير المكون من 7 أرقام؟", "7355608", new[] { "7355608" }, true, new[] { "esports", "fps", "cs" }),
            ("في لعبة ماينكرافت، ما هي الأداة الضرورية لتكسير حجر الأوبسيديان (Obsidian)؟", "بيكاكس ألماس", new[] { "بيكاكس الماس", "بيكاكس دايموند", "دايموند بيكاكس", "diamond pickaxe" }, true, new[] { "general", "minecraft" }),
            ("ما هو اسم شقيق ماريو ذو القبعة واللباس الأخضر؟", "لويجي", new[] { "لويجي", "luigi" }, true, new[] { "nintendo", "mario" }),
            ("ما اسم الشخصية الرئيسية في لعبة Red Dead Redemption 2؟", "آرثر مورغان", new[] { "آرثر", "ارثر", "آرثر مورغان", "arthur", "arthur morgan" }, true, new[] { "rpg", "rockstar" }),
            ("في سلسلة Halo، ما هو اسم الذكاء الاصطناعي المرافق للماستر تشيف؟", "كورتانا", new[] { "كورتانا", "cortana" }, true, new[] { "fps", "halo" }),
            ("ما هو اسم المدينة المستقبلية التي تدور فيها أحداث Cyberpunk 2077؟", "نايت سيتي", new[] { "نايت سيتي", "night city" }, true, new[] { "rpg", "cyberpunk" }),
            ("من هي بطلة سلسلة ألعاب تومب رايدر (Tomb Raider)؟", "لارا كروفت", new[] { "لارا", "لارا كروفت", "lara", "lara croft" }, true, new[] { "general", "action" }),
            ("ما هي الشركة المطورة لسلسلة ألعاب Assassin's Creed؟", "يوبي سوفت", new[] { "يوبي سوفت", "يوبيسوفت", "ubisoft" }, true, new[] { "general", "action" }),
            ("ما اسم بطل سلسلة Half-Life الصامت الذي يستخدم العتلة؟", "غوردون فريمان", new[] { "غوردون", "غوردن", "gordon", "gordon freeman" }, true, new[] { "general", "fps" }),
            ("في ألعاب بوكيمون الجيل الأول، ما هو اسم بوكيمون النار المبدئي؟", "تشارمندر", new[] { "تشارمندر", "شارمندر", "charmander" }, true, new[] { "nintendo", "pokemon" }),
            ("في لعبة GTA V، ما اسم الشخصية الذي كان سارق بنوك متقاعد ويعيش مع عائلته؟", "مايكل", new[] { "مايكل", "michael" }, true, new[] { "rpg", "gta" }),
            ("ما اسم الثعلب الطيار ذو الذيلين صديق سونيك القنفذ؟", "تيلز", new[] { "تيلز", "tails" }, true, new[] { "general", "sega" }),
            ("في لعبة League of Legends، ما هو اسم البطل الملقب بملك القردة؟", "ووكونغ", new[] { "ووكونغ", "وكونغ", "wukong" }, true, new[] { "esports", "lol" }),
            ("ما هي العملة المستخدمة في لعبة Hollow Knight؟", "جيو", new[] { "جيو", "geo" }, true, new[] { "general", "indie" }),
            ("ما هو اسم المدينة الغارقة تحت الماء في لعبة BioShock؟", "رابتشر", new[] { "رابتشر", "rapture" }, true, new[] { "general", "fps" }),
            ("من هو المطور الشهير مبتكر سلسلة Metal Gear Solid و Death Stranding؟", "كوجيما", new[] { "كوجيما", "هيديو كوجيما", "kojima" }, true, new[] { "general", "metal gear" }),
            ("في لعبة Apex Legends، من هي الشخصية الآلية التي تطلق حبل الانزلاق (Zipline)؟", "باثفايندر", new[] { "باثفايندر", "pathfinder" }, true, new[] { "esports", "fps", "apex" }),
            ("ما هي اللعبة الشهيرة التي تجمع البناء السريع مع الباتل رويال وباص المعركة؟", "فورتنايت", new[] { "فورتنايت", "fortnite" }, true, new[] { "esports", "fortnite" }),
        };

        var matching = catalog.Where(item => item.Arabic == isArabic).ToArray();
        if (matching.Length == 0) matching = catalog;

        var requestedCategory = (request.Category ?? "").Trim().ToLowerInvariant();
        var customInstructions = (request.CustomInstructions ?? "").Trim().ToLowerInvariant();

        if (!string.IsNullOrWhiteSpace(requestedCategory) || !string.IsNullOrWhiteSpace(customInstructions))
        {
            var categoryMatches = matching.Where(item =>
                item.Tags.Any(tag =>
                    (!string.IsNullOrEmpty(requestedCategory) && (requestedCategory.Contains(tag) || tag.Contains(requestedCategory))) ||
                    (!string.IsNullOrEmpty(customInstructions) && customInstructions.Contains(tag))
                )
            ).ToArray();

            if (categoryMatches.Length > 0)
            {
                matching = categoryMatches;
            }
        }

        if (recentList.Count > 0)
        {
            var freshMatching = matching.Where(item =>
                !IsGamingQuestionDuplicate(item.Question, item.Answer, recentList)
            ).ToArray();

            if (freshMatching.Length > 0)
            {
                matching = freshMatching;
            }
            else
            {
                // If all category questions were recently asked, pick from any unasked question across the broader catalog
                var allFresh = catalog.Where(item => item.Arabic == isArabic && !IsGamingQuestionDuplicate(item.Question, item.Answer, recentList)).ToArray();
                if (allFresh.Length > 0)
                {
                    matching = allFresh;
                }
            }
        }

        var selected = matching[Random.Shared.Next(matching.Length)];
        RecordRecentGamingQuestion(selected.Question, selected.Answer);
        return new GenerateGamingQuestionResponse(true, selected.Question, selected.Answer, selected.Aliases);
    }

    private static bool IsGamingQuestionDuplicate(string candidateQ, string candidateA, IEnumerable<string> recentItems)
    {
        if (string.IsNullOrWhiteSpace(candidateQ) || string.IsNullOrWhiteSpace(candidateA)) return true;
        var normQ = candidateQ.Trim().ToLowerInvariant();
        var normA = candidateA.Trim().ToLowerInvariant();

        foreach (var rq in recentItems)
        {
            if (string.IsNullOrWhiteSpace(rq)) continue;
            var normRq = rq.Trim().ToLowerInvariant();

            // Direct equality with question or answer
            if (normQ == normRq || normA == normRq) return true;

            // Answer is contained in recent or vice versa
            if (normA.Length >= 3 && (normRq.Contains(normA) || (normRq.Length <= 12 && normA.Contains(normRq)))) return true;

            // Substantial question substring / overlap
            if (normQ.Length >= 8 && normRq.Length >= 8)
            {
                if (normQ.Contains(normRq) || normRq.Contains(normQ)) return true;

                // Check common gaming keywords to prevent asking about the same game franchise consecutively
                var keyWords = new[] { "zelda", "زيلدا", "link", "لينك", "kratos", "كريتوس", "كرايتوس", "mario", "ماريو", "elden ring", "إلدن رينغ", "الدن رينغ", "bloodborne", "بلودبورن", "sekiro", "سيكيرو", "monster hunter", "مونستر هنتر", "rathalos", "راثالوس", "geralt", "جيرالت", "minecraft", "ماينكرافت", "halo", "master chief", "ماستر تشيف", "gta", "rockstar", "arthur morgan", "آرثر", "witcher" };
                foreach (var kw in keyWords)
                {
                    if (normQ.Contains(kw) && normRq.Contains(kw)) return true;
                }
            }
        }

        return false;
    }

    public void Dispose()
    {
        try
        {
            _micController.Dispose();
            _ttsService.Dispose();
            _soundPlayer.Dispose();
            _obsWs.DisposeAsync().AsTask().GetAwaiter().GetResult();
            _eventSub.DisposeAsync().AsTask().GetAwaiter().GetResult();
            _twitch.DisposeAsync().AsTask().GetAwaiter().GetResult();
            _botTwitch.DisposeAsync().AsTask().GetAwaiter().GetResult();
        }
        catch
        {
        }
        _settings.Dispose();
    }
}

