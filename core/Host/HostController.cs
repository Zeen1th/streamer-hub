using System.Text.Json;
using System.Diagnostics;
using System.Net.Http.Headers;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
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
    private sealed record SendChatMessagePayload(string Message);
    private sealed record UpdateTitlePayload(string Title);
    private sealed record CheckAvatarPayload(string? Username, string? UserId);
    private sealed record SaveOpenRouterPayload(string Provider, string? ApiKey);
    private sealed record GenerateAutoReplyPayload(string RuleId, ChatMessage? Message, bool? Send = null, string? OverrideInstructions = null);
    private sealed record GenerateAutoReplyResponse(bool Ok, string? Message = null, bool UsedFallback = false, string? Error = null, string? SenderRole = null, string? SenderLogin = null);
    private sealed record UpdateCheckResponse(string CurrentVersion, string LatestVersion, bool UpdateAvailable, string ReleaseUrl, string? DownloadUrl = null, string? ReleaseNotes = null);
    private sealed record UpdateInstallPayload(string DownloadUrl);
    private sealed record BeginResizePayload(string Edge);
    private sealed record SaveSequencePayload(CommandSequence? Sequence);
    private sealed record DeleteSequencePayload(string SequenceId);

    private readonly MainForm _form;
    private readonly WebView2 _webView;
    private readonly CancellationToken _shutdown;
    private readonly SettingsStore _settings;
    private readonly string _appData;
    private readonly ChatOverlayHostBridge _chatOverlay;
    private readonly ObsFileWriter _obs = new();
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
    private readonly HashSet<string> _seenRedemptionIds = new(StringComparer.Ordinal);
    private readonly object _seenRedemptionsLock = new();
    private readonly TwitchUserProfileCache _twitchUserProfiles = new();
    private readonly EmoteRegistry _emotes = new();
    private const int ProfileBatchSize = 100;
    private const int ProfileFlushDelayMs = 200;
    private readonly object _profileQueueLock = new();
    private readonly HashSet<string> _pendingProfileIds = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _pendingProfileNames = new(StringComparer.Ordinal);
    private System.Threading.Timer? _profileFlushTimer;
    private readonly RpcDispatcher _dispatcher = new();
    private readonly string _logPath;
    private IReadOnlyList<KeybindRegistration> _keybindRegistrations = Array.Empty<KeybindRegistration>();

    private volatile bool _authRequired;
    private int _authorizeInProgress;
    private int _botAuthorizeInProgress;
    private string _twitchChannel = string.Empty;
    private string _botLogin = string.Empty;
    private int _chatBurst;
    private DateTime _chatWindow = DateTime.UtcNow;
    private DateTime _lastChatSentAt = DateTime.MinValue;
    private readonly SemaphoreSlim _chatSendLock = new(1, 1);
    private readonly SemaphoreSlim _aiRequestLock = new(1, 1);
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
        _logPath = Path.Combine(appData, "logs", $"session-{DateTime.Now:yyyyMMdd}.log");
        Directory.CreateDirectory(Path.GetDirectoryName(_logPath)!);
        RegisterHandlers();
        WireTwitch();
        WireBotState();
        RefreshKeybinds();
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
            _botTokens.Delete();
            _botTwitch.Disconnect();
            _botLogin = string.Empty;
            EmitStatus();
            return Task.FromResult<object?>(new { ok = true });
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
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AutoRepliesSave, (payload, _) =>
        {
            var request = Json.Deserialize<SaveAutoReplyPayload>(payload ?? default);
            if (request?.Rule is null || string.IsNullOrWhiteSpace(request.Rule.Id))
                return Task.FromResult<object?>(new { ok = false });
            var aiInstructions = request.Rule.AiInstructions?.Trim() ?? string.Empty;
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
                AiInstructions = aiInstructions[..Math.Min(aiInstructions.Length, 2000)],
                AiModel = string.IsNullOrWhiteSpace(aiModel) ? (request.Rule.AiProvider == "openrouter" ? "meta-llama/llama-3.2-3b-instruct:free" : "llama-3.1-8b-instant") : aiModel[..Math.Min(aiModel.Length, 120)],
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
            });
            RefreshKeybinds();
            return Task.FromResult<object?>(new { ok = true });
        });
        _dispatcher.Register(Channels.AutoRepliesDelete, (payload, _) =>
        {
            var request = Json.Deserialize<DeleteAutoReplyPayload>(payload ?? default);
            if (request is null || string.IsNullOrWhiteSpace(request.RuleId))
                return Task.FromResult<object?>(new { ok = false });
            _settings.DeleteAutoReply(request.RuleId);
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
            var (_, senderRole, senderLogin) = ResolveActiveChatSender();
            var ok = await SendChatMessageCoreAsync(request.Message).ConfigureAwait(false);
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
            var target = request?.Username ?? request?.UserId;
            if (_twitch.State != TwitchState.Connected)
            {
                return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            }
            var result = await _twitch.CheckUserProfileAsync(target, ct).ConfigureAwait(false);
            if (result.Ok && !string.IsNullOrWhiteSpace(result.UserId) && !string.IsNullOrWhiteSpace(result.AvatarUrl))
            {
                _twitchUserProfiles.Set(result.UserId, result.AvatarUrl);
                PostEvent(Events.TwitchUserProfile, new { userId = result.UserId, avatarUrl = result.AvatarUrl });
                await _chatOverlay.PublishProfileAsync(result.UserId, result.AvatarUrl, null, ct).ConfigureAwait(false);
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
            var result = await _twitch.CheckIsModeratorAsync(request.Target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, isMod = result.IsMod, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationTimeout, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTimeoutPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var duration = request.DurationSeconds.GetValueOrDefault(60);
            var result = await _twitch.TimeoutUserAsync(request.Target, duration, request.Reason, ct).ConfigureAwait(false);
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
            var result = await _twitch.SmartModTimeoutAsync(request.Target, duration, request.Reason, ct).ConfigureAwait(false);
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
            var result = await _twitch.BanUserAsync(request.Target, request.Reason, ct).ConfigureAwait(false);
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
            var result = await _twitch.UnbanUserAsync(request.Target, ct).ConfigureAwait(false);
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
            var result = await _twitch.ModUserAsync(request.Target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationUnmod, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.UnmodUserAsync(request.Target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationVip, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.VipUserAsync(request.Target, ct).ConfigureAwait(false);
            return new { ok = result.Ok, error = result.Error };
        });
        _dispatcher.Register(Channels.TwitchModerationUnvip, async (payload, ct) =>
        {
            var request = Json.Deserialize<ModerationTargetPayload>(payload ?? default);
            if (string.IsNullOrWhiteSpace(request?.Target)) return new { ok = false, error = "EMPTY_TARGET" };
            if (_twitch.State != TwitchState.Connected) return new { ok = false, error = "TWITCH CHAT IS NOT CONNECTED" };
            var result = await _twitch.UnvipUserAsync(request.Target, ct).ConfigureAwait(false);
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
            var result = await _twitch.SendShoutoutAsync(request.Target, ct).ConfigureAwait(false);
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
        _dispatcher.Register(Channels.AutoRepliesGenerate, async (payload, ct) =>
        {
            var request = Json.Deserialize<GenerateAutoReplyPayload>(payload ?? default);
            if (request?.Message is null || string.IsNullOrWhiteSpace(request.RuleId))
                return new GenerateAutoReplyResponse(false, Error: "BAD PAYLOAD");
            var rule = _settings.AutoReplies.FirstOrDefault(item => item.Id == request.RuleId);
            if (rule is null) return new GenerateAutoReplyResponse(false, Error: "RULE NOT FOUND");
            if (rule.ResponseMode != "ai" && string.IsNullOrWhiteSpace(request.OverrideInstructions))
                return new GenerateAutoReplyResponse(false, Error: "AI RULE NOT FOUND");
            var shouldSend = request.Send != false;
            var provider = rule.AiProvider == "groq" ? "groq" : "openrouter";
            var key = provider == "groq" ? _groqKey.Load() : _openRouterKey.Load();
            if (string.IsNullOrWhiteSpace(key)) return new GenerateAutoReplyResponse(false, Error: $"{provider.ToUpperInvariant()} KEY IS NOT CONFIGURED");
            if (shouldSend && _twitch.State != TwitchState.Connected) return new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED");
            if (!await AllowAiRequestAsync().ConfigureAwait(false)) return new GenerateAutoReplyResponse(false, Error: "AI LIMIT REACHED");

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct, _shutdown);
            timeout.CancelAfter(TimeSpan.FromSeconds(25));
            var effectiveInstructions = !string.IsNullOrWhiteSpace(request.OverrideInstructions)
                ? request.OverrideInstructions
                : rule.AiInstructions;
            var model = string.IsNullOrWhiteSpace(rule.AiModel) ? "llama-3.1-8b-instant" : rule.AiModel;
            var maxTokens = rule.AiMaxTokens > 0 ? rule.AiMaxTokens : 120;
            var generated = await _openRouter.GenerateAsync(provider, key, model, effectiveInstructions, request.Message, maxTokens, timeout.Token).ConfigureAwait(false);
            var (_, senderRole, senderLogin) = ResolveActiveChatSender();
            if (!generated.Ok || string.IsNullOrWhiteSpace(generated.Message))
            {
                Log("system", $"AI reply failed ({provider}) · {generated.Error ?? "EMPTY RESPONSE"}");
                var fallback = rule.AiFallback.Trim();
                if (string.IsNullOrWhiteSpace(fallback))
                    return new GenerateAutoReplyResponse(false, Error: generated.Error ?? "AI DID NOT RETURN A MESSAGE", SenderRole: senderRole, SenderLogin: senderLogin);
                if (!shouldSend) return new GenerateAutoReplyResponse(true, fallback[..Math.Min(fallback.Length, 500)], true, generated.Error, SenderRole: senderRole, SenderLogin: senderLogin);
                var fallbackOk = await SendChatMessageCoreAsync(fallback).ConfigureAwait(false);
                return fallbackOk
                    ? new GenerateAutoReplyResponse(true, fallback[..Math.Min(fallback.Length, 500)], true, generated.Error, SenderRole: senderRole, SenderLogin: senderLogin)
                    : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED", SenderRole: senderRole, SenderLogin: senderLogin);
            }
            if (!shouldSend) return new GenerateAutoReplyResponse(true, generated.Message, SenderRole: senderRole, SenderLogin: senderLogin);
            var sent = await SendChatMessageCoreAsync(generated.Message).ConfigureAwait(false);
            return sent
                ? new GenerateAutoReplyResponse(true, generated.Message, SenderRole: senderRole, SenderLogin: senderLogin)
                : new GenerateAutoReplyResponse(false, Error: "TWITCH CHAT IS NOT CONNECTED", SenderRole: senderRole, SenderLogin: senderLogin);
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

            Log("system", CoreStrings.L(Lang, "chat-relayed") + $"{publishedMessage.Username}: {publishedMessage.Message}");
            PostEvent(Events.TwitchChatMessage, publishedMessage);
            _ = PublishChatOverlayMessageAsync(publishedMessage);
            if (!string.IsNullOrWhiteSpace(publishedMessage.CustomRewardId))
            {
                var redemptionId = $"irc-{publishedMessage.Id}";
                bool isNew;
                lock (_seenRedemptionsLock)
                {
                    isNew = _seenRedemptionIds.Add(redemptionId);
                }
                if (isNew)
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
                QueueTwitchUserProfile(message.UserId, message.Username);
            }
        };
        _twitch.ChatCleared += clear => _ = PublishChatClearAsync(clear);
        _eventSub.ChannelPointsRedeemed += redemption =>
        {
            bool isNew;
            lock (_seenRedemptionsLock)
            {
                isNew = _seenRedemptionIds.Add(redemption.Id);
            }
            if (isNew)
            {
                PostEvent(Events.TwitchChannelPointsRedeemed, redemption);
                Log("trigger", $"CHANNEL POINTS REDEEMED · {redemption.UserName} redeemed '{redemption.RewardTitle}'");
            }
        };
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

    private (ITwitchClient client, string senderRole, string senderLogin) ResolveActiveChatSender()
    {
        var preferBot = _settings.PreferredChatSender != "broadcaster";
        if (preferBot && _settings.BotAccountEnabled && _botTwitch.State == TwitchState.Connected)
        {
            return (_botTwitch, "bot", _botLogin);
        }
        return (_twitch, "broadcaster", _twitchChannel);
    }

    private async Task<bool> SendChatMessageCoreAsync(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        await _chatSendLock.WaitAsync().ConfigureAwait(false);
        try
        {
            var elapsed = DateTime.UtcNow - _lastChatSentAt;
            if (elapsed < TimeSpan.FromSeconds(1))
                await Task.Delay(TimeSpan.FromSeconds(1) - elapsed).ConfigureAwait(false);
            var (chatClient, senderRole, senderLogin) = ResolveActiveChatSender();
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
            BotConnected = _botTwitch.State == TwitchState.Connected,
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
        catch
        {
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
        }
        catch
        {
        }
        if (emitEvent) PostEvent(Events.CoreLog, new { message });
    }

    public void Dispose()
    {
        try
        {
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

