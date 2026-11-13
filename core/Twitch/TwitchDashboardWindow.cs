using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace StreamerHub.Core.Twitch;

/// <summary>
/// A small window on the streamer's own Twitch dashboard, logged in once by the streamer and kept in its own browser
/// profile. Twitch has no API to give the Lead Moderator role back after a timeout, so this ticks the "Lead Moderator"
/// box in Roles Manager the same way the streamer would. Unofficial: it breaks if Twitch changes that page, and then the
/// window is shown on the right page so the streamer can click it themself. The app never reads the password or the
/// session token; it only reads the "login" cookie to know which account is logged in.
/// </summary>
public sealed class TwitchDashboardWindow : IDisposable
{
    private readonly string _userDataFolder;
    private readonly Control _owner;
    private readonly Action<string> _log;
    private readonly SemaphoreSlim _busy = new(1, 1);
    private Form? _form;
    private WebView2? _web;
    private bool _disposed;

    public TwitchDashboardWindow(string userDataFolder, Control owner, Action<string> log)
    {
        _userDataFolder = userDataFolder;
        _owner = owner;
        _log = log;
    }

    /// <summary>The Twitch login the dashboard window is signed in as, or null.</summary>
    public Task<string?> GetLoggedInLoginAsync() => OnUi(async () =>
    {
        var web = await EnsureWebAsync().ConfigureAwait(true);
        var cookies = await web.CoreWebView2.CookieManager.GetCookiesAsync("https://www.twitch.tv").ConfigureAwait(true);
        var login = cookies.FirstOrDefault(c => c.Name == "login")?.Value;
        return string.IsNullOrWhiteSpace(login) ? null : Uri.UnescapeDataString(login).Trim().ToLowerInvariant();
    });

    /// <summary>Shows the window on Twitch's login page (or the dashboard if already logged in).</summary>
    public Task ShowLoginAsync() => OnUi(async () =>
    {
        var web = await EnsureWebAsync().ConfigureAwait(true);
        ShowOnScreen();
        web.CoreWebView2.Navigate("https://dashboard.twitch.tv/");
        return true;
    });

    /// <summary>Shows Roles Manager so the streamer can give Lead back by hand (used when the automatic way failed).</summary>
    public Task ShowRolesPageAsync(string channel) => OnUi(async () =>
    {
        var web = await EnsureWebAsync().ConfigureAwait(true);
        ShowOnScreen();
        web.CoreWebView2.Navigate(RolesUrl(channel));
        return true;
    });

    /// <summary>Signs the window out: forgets its cookies and site data.</summary>
    public Task LogOutAsync() => OnUi(async () =>
    {
        var web = await EnsureWebAsync().ConfigureAwait(true);
        await web.CoreWebView2.Profile.ClearBrowsingDataAsync().ConfigureAwait(true);
        _form?.Hide();
        return true;
    });

    /// <summary>
    /// Opens Roles Manager out of sight and gives <paramref name="login"/> the Lead Moderator role. Tries a few times,
    /// because Roles Manager can take a moment to list someone who just got mod back.
    /// </summary>
    public async Task<(bool Ok, string? Error)> GiveLeadModeratorAsync(string channel, string login, CancellationToken ct)
    {
        await _busy.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            (bool Ok, string? Error) last = (false, "NOT_TRIED");
            for (var attempt = 1; attempt <= 3 && !ct.IsCancellationRequested; attempt++)
            {
                last = await OnUi(() => TryGiveLeadAsync(channel, login, ct)).ConfigureAwait(false);
                if (last.Ok || last.Error is not ("USER_NOT_IN_ROLES" or "PAGE_NOT_READY")) break;
                _log($"LEAD MOD · {login} not listed in Roles Manager yet (try {attempt} of 3)");
                await Task.Delay(TimeSpan.FromSeconds(4), ct).ConfigureAwait(false);
            }
            return last;
        }
        finally
        {
            _busy.Release();
        }
    }

    private async Task<(bool Ok, string? Error)> TryGiveLeadAsync(string channel, string login, CancellationToken ct)
    {
        var web = await EnsureWebAsync().ConfigureAwait(true);
        ShowOffScreen();
        if (!await NavigateAsync(web, RolesUrl(channel), ct).ConfigureAwait(true)) return (false, "PAGE_NOT_READY");
        if (web.CoreWebView2.Source.Contains("/login", StringComparison.OrdinalIgnoreCase)) return (false, "NOT_LOGGED_IN");

        await web.CoreWebView2.ExecuteScriptAsync(GiveLeadScript(login)).ConfigureAwait(true);
        var deadline = DateTime.UtcNow.AddSeconds(40);
        while (DateTime.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            await Task.Delay(400, ct).ConfigureAwait(true);
            var raw = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__streamerHubLead || null)").ConfigureAwait(true);
            var json = JsonSerializer.Deserialize<string?>(raw);
            if (string.IsNullOrEmpty(json) || json == "null") continue;
            using var doc = JsonDocument.Parse(json);
            var ok = doc.RootElement.TryGetProperty("ok", out var okEl) && okEl.GetBoolean();
            var error = doc.RootElement.TryGetProperty("error", out var errEl) ? errEl.GetString() : null;
            return (ok, ok ? null : error ?? "UNKNOWN");
        }
        return (false, "TIMED_OUT");
    }

    /// <summary>
    /// Runs inside Roles Manager. Finds the viewer's row, opens its "+" (Add Role) list, ticks "Lead Moderator",
    /// answers Yes to Twitch's "Add ... as a Lead Moderator?" question, then waits until the row shows the role.
    /// Leaves the result in window.__streamerHubLead. Matches the page as it was in November 2026 (tested on it).
    /// </summary>
    private static string GiveLeadScript(string login) => $$"""
        (async (login) => {
          window.__streamerHubLead = null;
          const done = (result) => { window.__streamerHubLead = result; };
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const norm = (s) => (s || '').trim().toLowerCase();
          const until = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(250); } return null; };
          const findRow = () => [...document.querySelectorAll('[role="row"]')].find((r) => norm(r.innerText.split('\n')[0]) === norm(login));
          try {
            const table = await until(() => document.querySelector('[role="row"]'), 15000);
            if (!table) return done({ ok: false, error: 'PAGE_NOT_READY' });
            let row = await until(findRow, 4000);
            for (let i = 0; i < 25 && !row; i++) {
              const last = [...document.querySelectorAll('[role="row"]')].pop();
              last?.scrollIntoView({ block: 'end' });
              await sleep(400);
              row = findRow();
            }
            if (!row) return done({ ok: false, error: 'USER_NOT_IN_ROLES' });
            if (/Lead Moderator/i.test(row.innerText)) return done({ ok: true, already: true });
            const add = row.querySelector('[aria-label="Add Role"]');
            if (!add) return done({ ok: false, error: 'ADD_ROLE_BUTTON_NOT_FOUND' });
            add.click();
            const dialog = await until(() => document.querySelector('[role="dialog"][aria-label="Add Role"]'), 5000);
            if (!dialog) return done({ ok: false, error: 'ROLE_LIST_NOT_FOUND' });
            const label = [...dialog.querySelectorAll('label')].find((l) => norm(l.innerText) === 'lead moderator');
            const box = label && (document.getElementById(label.htmlFor) || label.parentElement?.querySelector('input[type="checkbox"]'));
            if (!box) return done({ ok: false, error: 'LEAD_CHECKBOX_NOT_FOUND' });
            if (box.disabled) return done({ ok: false, error: 'LEAD_LIMIT_REACHED' });
            if (!box.checked) box.click();
            // Twitch asks "Add <name> as a Lead Moderator?" before it applies the role
            const ask = await until(() => [...document.querySelectorAll('[role="dialog"]')].find((d) => /as a Lead Moderator\?/i.test(d.innerText)), 5000);
            const yes = ask && [...ask.querySelectorAll('button')].find((b) => norm(b.textContent) === 'yes');
            if (ask && !yes) return done({ ok: false, error: 'CONFIRM_BUTTON_NOT_FOUND' });
            yes?.click();
            // The role list stays open; that is fine, the page is loaded fresh every time
            const confirmed = await until(() => { const r = findRow(); return r && /Lead Moderator/i.test(r.innerText); }, 8000);
            return done(confirmed ? { ok: true } : { ok: false, error: 'NOT_CONFIRMED' });
          } catch (e) {
            done({ ok: false, error: 'SCRIPT_ERROR: ' + (e && e.message ? e.message : String(e)) });
          }
        })({{JsonSerializer.Serialize(login)}});
        """;

    private static string RolesUrl(string channel) =>
        $"https://dashboard.twitch.tv/u/{Uri.EscapeDataString(channel.Trim().TrimStart('#').ToLowerInvariant())}/community/roles";

    private static async Task<bool> NavigateAsync(WebView2 web, string url, CancellationToken ct)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Handler(object? _, CoreWebView2NavigationCompletedEventArgs e) => tcs.TrySetResult(e.IsSuccess);
        web.CoreWebView2.NavigationCompleted += Handler;
        try
        {
            web.CoreWebView2.Navigate(url);
            var finished = await Task.WhenAny(tcs.Task, Task.Delay(TimeSpan.FromSeconds(30), ct)).ConfigureAwait(true);
            return finished == tcs.Task && tcs.Task.Result;
        }
        finally
        {
            web.CoreWebView2.NavigationCompleted -= Handler;
        }
    }

    private async Task<WebView2> EnsureWebAsync()
    {
        if (_web?.CoreWebView2 is not null) return _web;
        _form = new Form
        {
            Text = "Twitch dashboard · Streamer Hub",
            Width = 1100,
            Height = 760,
            StartPosition = FormStartPosition.Manual,
            ShowInTaskbar = false,
        };
        // Closing only hides it, so the login is kept for the next time
        _form.FormClosing += (_, e) =>
        {
            if (_disposed) return;
            e.Cancel = true;
            _form.Hide();
        };
        _web = new WebView2 { Dock = DockStyle.Fill };
        _form.Controls.Add(_web);
        ShowOffScreen();
        Directory.CreateDirectory(_userDataFolder);
        var environment = await CoreWebView2Environment.CreateAsync(null, _userDataFolder).ConfigureAwait(true);
        await _web.EnsureCoreWebView2Async(environment).ConfigureAwait(true);
        // Links that open a new window stay in this window
        _web.CoreWebView2.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            _web.CoreWebView2.Navigate(e.Uri);
        };
        return _web;
    }

    private void ShowOffScreen()
    {
        if (_form is null) return;
        _form.ShowInTaskbar = false;
        _form.Location = new Point(-32000, -32000);
        if (!_form.Visible) _form.Show();
    }

    private void ShowOnScreen()
    {
        if (_form is null) return;
        var area = Screen.FromControl(_owner).WorkingArea;
        _form.ShowInTaskbar = true;
        _form.Location = new Point(area.Left + (area.Width - _form.Width) / 2, area.Top + (area.Height - _form.Height) / 2);
        if (!_form.Visible) _form.Show();
        _form.Activate();
    }

    /// <summary>Runs on the UI thread (WebView2 needs it) and hands the result back to any thread.</summary>
    private Task<T> OnUi<T>(Func<Task<T>> work)
    {
        var tcs = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Run()
        {
            _ = RunAsync();
            async Task RunAsync()
            {
                try { tcs.TrySetResult(await work().ConfigureAwait(true)); }
                catch (Exception ex) { tcs.TrySetException(ex); }
            }
        }
        if (_owner.InvokeRequired) _owner.BeginInvoke((Action)Run);
        else Run();
        return tcs.Task;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            if (_form is not null && !_form.IsDisposed)
            {
                if (_form.InvokeRequired) _form.Invoke(_form.Dispose);
                else _form.Dispose();
            }
        }
        catch
        {
            // closing down anyway
        }
        _busy.Dispose();
    }
}
