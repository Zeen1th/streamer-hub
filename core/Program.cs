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

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
