using System.Runtime.InteropServices;
using Microsoft.Win32;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using StreamerHub.Core.Host;
using StreamerHub.Core.Rpc;
using StreamerHub.Core.Storage;

namespace StreamerHub.Core;

internal static class Native
{
    [DllImport("user32.dll")]
    internal static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    internal static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
}

public sealed class MainForm : Form
{
    private const int EdgeZone = 6;
    private const int WmNcHitTest = 0x84;
    private const int WmNcCalcSize = 0x0083;
    private const int WmSetCursor = 0x0020;
    private const int WmGetMinMaxInfo = 0x0024;
    private const int WmNclButtonDown = 0x00A1;
    private const int WsThickFrame = 0x00040000;
    private const int HtCaption = 0x2;

    [StructLayout(LayoutKind.Sequential)]
    private struct MinMaxInfo
    {
        public Point Reserved;
        public Point MaxSize;
        public Point MaxPosition;
        public Point MinTrackSize;
        public Point MaxTrackSize;
    }
    private const int ZoneLeft = 1;
    private const int ZoneRight = 2;
    private const int ZoneTop = 4;
    private const int ZoneBottom = 8;

    private readonly WebView2 _webView = new();
    private readonly CancellationTokenSource _shutdown = new();
    private SettingsStore? _settings;
    private HostController? _host;
    private bool _lastMaximized;
    private bool _webViewRefreshPending;
    private int _initialized;

    public MainForm()
    {
        Text = "Streamer Hub";
        var iconPath = Path.Combine(AppContext.BaseDirectory, "streamer-hub-icon.ico");
        if (File.Exists(iconPath)) Icon = new Icon(iconPath);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1280, 800);
        MinimumSize = new Size(960, 640);
        BackColor = Color.FromArgb(0xE8, 0xE2, 0xD2);
        Padding = new Padding(EdgeZone);
        _webView.DefaultBackgroundColor = Color.FromArgb(0xE8, 0xE2, 0xD2);
        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        try
        {
            // Give Windows time to finish the logon session and initialize
            // WebView2 before a background launch begins.
            if (Program.StartedWithWindows)
            {
                await Task.Delay(TimeSpan.FromSeconds(4), _shutdown.Token);
            }

            await InitializeAsync();
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            var details = ex.ToString();
            WriteStartupError(details);

            MessageBox.Show(this,
                Program.StartedWithWindows
                    ? "Streamer Hub could not start automatically. Open it once from the Start menu and try again."
                    : ex.Message,
                "Streamer Hub failed to start",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task InitializeAsync()
    {
        var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "StreamerHub");
        var localData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamerHub");
        Directory.CreateDirectory(appData);
        Directory.CreateDirectory(localData);

        _settings = new SettingsStore(Path.Combine(appData, "settings.json"));
        SetStartupEnabled(_settings.StartupEnabled);
        ApplyWindowSettings();

        var environmentOptions = new CoreWebView2EnvironmentOptions();
        var debugPort = Environment.GetEnvironmentVariable("STREAMERHUB_DEBUG_PORT");
        if (!string.IsNullOrEmpty(debugPort))
        {
            environmentOptions.AdditionalBrowserArguments = $"--remote-debugging-port={debugPort}";
        }
        var environment = await CoreWebView2Environment.CreateAsync(
            null, Path.Combine(localData, "WebView2"), environmentOptions);
        await _webView.EnsureCoreWebView2Async(environment);
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        _webView.CoreWebView2.Settings.IsZoomControlEnabled = false;

        var wwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "app.streamerhub", wwwroot, CoreWebView2HostResourceAccessKind.Allow);

        _host = new HostController(this, _webView, _settings, appData, _shutdown.Token);
        await _host.InitializeAsync();

        _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        _webView.CoreWebView2.Navigate("https://app.streamerhub/index.html");
    }

    private static void WriteStartupError(string details)
    {
        try
        {
            var logDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "StreamerHub",
                "logs");
            Directory.CreateDirectory(logDirectory);
            var path = Path.Combine(logDirectory, "startup-error.log");
            File.AppendAllText(path,
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {details}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
            // Startup diagnostics must never prevent the fallback message.
        }
    }

    private void ApplyWindowSettings()
    {
        var window = _settings!.Window;
        if (window.X == int.MinValue || window.Y == int.MinValue) return;
        var probe = new Point(window.X + Math.Max(40, window.Width / 2), window.Y + 24);
        if (!Screen.AllScreens.Any(s => s.Bounds.Contains(probe))) return;
        StartPosition = FormStartPosition.Manual;
        Bounds = new Rectangle(
            window.X, window.Y,
            Math.Max(MinimumSize.Width, window.Width),
            Math.Max(MinimumSize.Height, window.Height));
        if (window.Maximized) WindowState = FormWindowState.Maximized;
    }

    private void SaveWindowSettings()
    {
        if (_settings is null) return;
        var maximized = WindowState == FormWindowState.Maximized;
        var bounds = maximized ? RestoreBounds : Bounds;
        _settings.SetWindow(new WindowSettings
        {
            X = bounds.X,
            Y = bounds.Y,
            Width = bounds.Width,
            Height = bounds.Height,
            Maximized = maximized,
        });
    }

    internal void SetStartupEnabled(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
            if (key is null) return;
            if (enabled) key.SetValue("StreamerHub", $"\"{Application.ExecutablePath}\" --startup");
            else key.DeleteValue("StreamerHub", false);
        }
        catch
        {
        }
    }

    internal void StartWindowDrag()
    {
        Native.ReleaseCapture();
        Native.SendMessage(Handle, WmNclButtonDown, (IntPtr)HtCaption, IntPtr.Zero);
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.Style |= WsThickFrame;
            return cp;
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        RpcEnvelope? request = null;
        try
        {
            request = JsonSerializer.Deserialize<RpcEnvelope>(e.WebMessageAsJson, Json.Options);
        }
        catch
        {
        }
        if (request is null || request.Kind != "request" || _host is null) return;
        _ = Task.Run(() => HandleRequestAsync(request), _shutdown.Token);
    }

    private async Task HandleRequestAsync(RpcEnvelope request)
    {
        object? payload = null;
        string? error = null;
        try
        {
            payload = await _host!.DispatchAsync(request.Channel, request.Payload, _shutdown.Token)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            error = ex.Message;
        }
        var response = new { v = 1, id = request.Id, kind = "response", channel = request.Channel, payload, error };
        var json = Json.Serialize(response);
        if (IsDisposed || !IsHandleCreated) return;
        if (InvokeRequired) BeginInvoke(() => Post(json));
        else Post(json);
    }

    private void Post(string json)
    {
        try
        {
            _webView.CoreWebView2.PostWebMessageAsJson(json);
        }
        catch
        {
        }
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmNcCalcSize && m.WParam != IntPtr.Zero)
        {
            m.Result = IntPtr.Zero;
            return;
        }
        if (m.Msg == WmGetMinMaxInfo)
        {
            base.WndProc(ref m);
            var mmi = Marshal.PtrToStructure<MinMaxInfo>(m.LParam);
            var monitor = Screen.FromHandle(Handle);
            var workArea = monitor.WorkingArea;

            // WM_GETMINMAXINFO expects MaxPosition relative to the monitor,
            // not the desktop's absolute coordinates. Using workArea.Location
            // directly moves maximized windows off-screen on secondary monitors.
            mmi.MaxPosition = new Point(
                workArea.Left - monitor.Bounds.Left,
                workArea.Top - monitor.Bounds.Top);
            mmi.MaxSize = new Point(workArea.Width, workArea.Height);
            Marshal.StructureToPtr(mmi, m.LParam, false);
            return;
        }
        if (m.Msg == WmNcHitTest)
        {
            var hit = GetResizeHit(PointToClient(Cursor.Position));
            if (hit != 0)
            {
                m.Result = (IntPtr)hit;
                return;
            }
        }
        else if (m.Msg == WmSetCursor)
        {
            var zone = GetResizeZone(PointToClient(Cursor.Position));
            if (zone != 0)
            {
                Cursor.Current = CursorForZone(zone);
                m.Result = (IntPtr)1;
                return;
            }
        }
        base.WndProc(ref m);
    }

    private int GetResizeZone(Point pt)
    {
        if (WindowState == FormWindowState.Maximized) return 0;
        var zone = 0;
        if (pt.X <= EdgeZone) zone |= ZoneLeft;
        else if (pt.X >= ClientSize.Width - EdgeZone) zone |= ZoneRight;
        if (pt.Y <= EdgeZone) zone |= ZoneTop;
        else if (pt.Y >= ClientSize.Height - EdgeZone) zone |= ZoneBottom;
        return zone;
    }

    private int GetResizeHit(Point pt) => GetResizeZone(pt) switch
    {
        ZoneTop | ZoneLeft => 13,
        ZoneTop | ZoneRight => 14,
        ZoneBottom | ZoneLeft => 16,
        ZoneBottom | ZoneRight => 17,
        ZoneLeft => 10,
        ZoneRight => 11,
        ZoneTop => 12,
        ZoneBottom => 15,
        _ => 0,
    };

    private static Cursor CursorForZone(int zone) => zone switch
    {
        ZoneTop | ZoneLeft => Cursors.SizeNWSE,
        ZoneTop | ZoneRight => Cursors.SizeNESW,
        ZoneBottom | ZoneLeft => Cursors.SizeNESW,
        ZoneBottom | ZoneRight => Cursors.SizeNWSE,
        ZoneLeft or ZoneRight => Cursors.SizeWE,
        ZoneTop or ZoneBottom => Cursors.SizeNS,
        _ => Cursors.Default,
    };

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        ScheduleWebViewRefresh();
        var maximized = WindowState == FormWindowState.Maximized;
        if (maximized != _lastMaximized)
        {
            _lastMaximized = maximized;
            _host?.PostEvent(Rpc.Events.WindowMaximizedChanged, new { isMaximized = maximized });
        }
    }

    protected override void OnLocationChanged(EventArgs e)
    {
        base.OnLocationChanged(e);
    }

    protected override void OnDpiChanged(DpiChangedEventArgs e)
    {
        base.OnDpiChanged(e);
        ScheduleWebViewRefresh();
    }

    private void ScheduleWebViewRefresh()
    {
        if (_webViewRefreshPending || !_webView.IsHandleCreated || IsDisposed) return;
        _webViewRefreshPending = true;
        BeginInvoke(() =>
        {
            _webViewRefreshPending = false;
            if (_webView.IsDisposed || !_webView.IsHandleCreated) return;
            _webView.Bounds = ClientRectangle;
            _webView.PerformLayout();
            _webView.Invalidate();
            _webView.Update();
        });
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        SaveWindowSettings();
        _shutdown.Cancel();
        try
        {
            _host?.Dispose();
        }
        catch
        {
        }
        base.OnFormClosing(e);
    }
}

