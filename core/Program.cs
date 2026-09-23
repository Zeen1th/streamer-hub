using System.Runtime.InteropServices;
using StreamerHub.Core.Host;

namespace StreamerHub.Core;

internal static class Program
{
    internal const string AppUserModelId = "Zeen1th.StreamerHub";

    [DllImport("shell32.dll", SetLastError = true)]
    private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);

    internal static bool StartedWithWindows { get; private set; }

    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            SetCurrentProcessExplicitAppUserModelID(AppUserModelId);
        }
        catch
        {
        }

        try
        {
            // Flush icon association cache on shell
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
        }
        catch
        {
        }

        StartedWithWindows = args.Any(arg => string.Equals(arg, "--startup", StringComparison.OrdinalIgnoreCase));

        // Windows Run launches processes with a system working directory. Set it
        // explicitly so any native/runtime lookup uses the installed app folder.
        Environment.CurrentDirectory = AppContext.BaseDirectory;

        using var singleInstance = new SingleInstanceCoordinator();
        if (!singleInstance.IsPrimary)
        {
            SingleInstanceCoordinator.NotifyPrimary();
            return;
        }

        ApplicationConfiguration.Initialize();
        using var mainForm = new MainForm();
        singleInstance.RegisterShowHandler(() =>
        {
            try
            {
                if (mainForm.IsDisposed) return;
                if (mainForm.IsHandleCreated)
                {
                    mainForm.BeginInvoke(new Action(mainForm.RestoreAndActivate));
                }
                else
                {
                    EventHandler onHandleCreated = null!;
                    onHandleCreated = (_, _) =>
                    {
                        mainForm.HandleCreated -= onHandleCreated;
                        mainForm.BeginInvoke(new Action(mainForm.RestoreAndActivate));
                    };
                    mainForm.HandleCreated += onHandleCreated;
                }
            }
            catch (ObjectDisposedException)
            {
            }
        });

        Application.Run(mainForm);
    }
}
