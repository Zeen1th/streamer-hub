namespace StreamerHub.Core.Host;

/// <summary>
/// Why the main window is closing.
///
/// The distinction matters because "close to tray" must apply only when the
/// user closed the window themselves. When the app is terminating itself - to
/// hand off to the updater, for example - hiding to the tray leaves the process
/// alive, and anything waiting for it to exit waits forever.
/// </summary>
public enum CloseTrigger
{
    /// <summary>The user clicked the window's close button.</summary>
    UserClosedWindow,

    /// <summary>The user picked Exit from the tray menu.</summary>
    TrayExit,

    /// <summary>The app is closing itself to let the updater replace it.</summary>
    UpdateRestart,

    /// <summary>Windows is shutting down, the task manager ended it, and so on.</summary>
    System,
}

public static class ShutdownPolicy
{
    /// <summary>
    /// Whether this close should be cancelled in favour of hiding to the tray.
    ///
    /// Only a user closing the window can be diverted to the tray. Every other
    /// trigger must be allowed to terminate the process.
    /// </summary>
    public static bool ShouldHideToTray(CloseTrigger trigger, bool closeToTrayEnabled) =>
        trigger == CloseTrigger.UserClosedWindow && closeToTrayEnabled;
}
