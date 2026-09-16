using StreamerHub.Core.Host;

namespace StreamerHub.Core;

internal static class Program
{
    internal static bool StartedWithWindows { get; private set; }

    [STAThread]
    private static void Main(string[] args)
    {
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
