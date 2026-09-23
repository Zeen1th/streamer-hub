using System.Runtime.InteropServices;
using System.Text;

namespace StreamerHub.Core.Audio;

public sealed class SoundEffectPlayer : IDisposable
{
    [DllImport("winmm.dll", EntryPoint = "mciSendStringA", CharSet = CharSet.Ansi)]
    private static extern int mciSendString(string lpstrCommand, StringBuilder? lpstrReturnString, int uReturnLength, IntPtr hwndCallback);

    public event Action<string>? LogMessage;

    public Task<bool> PlayAsync(string filePath, double? volume = 1.0, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            LogMessage?.Invoke($"Sound file not found: {filePath}");
            return Task.FromResult(false);
        }

        try
        {
            var alias = "sh_sfx_" + Guid.NewGuid().ToString("N");
            var openCmd = $"open \"{filePath}\" type mpegvideo alias {alias}";
            int hr = mciSendString(openCmd, null, 0, IntPtr.Zero);
            if (hr != 0)
            {
                // Fallback to simple open without explicit type specification
                openCmd = $"open \"{filePath}\" alias {alias}";
                hr = mciSendString(openCmd, null, 0, IntPtr.Zero);
            }

            if (hr != 0)
            {
                LogMessage?.Invoke($"Failed to open sound effect: {filePath} (MCI error {hr})");
                return Task.FromResult(false);
            }

            // Volume is 0 to 1000 in MCI
            double vol = Math.Clamp(volume ?? 1.0, 0.0, 1.0);
            int mciVol = (int)Math.Round(vol * 1000.0);
            mciSendString($"setaudio {alias} volume to {mciVol}", null, 0, IntPtr.Zero);

            // Play sound asynchronously
            mciSendString($"play {alias} from 0", null, 0, IntPtr.Zero);

            // Clean up alias after reasonable delay
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(60), ct).ConfigureAwait(false);
                }
                catch { }
                finally
                {
                    mciSendString($"close {alias}", null, 0, IntPtr.Zero);
                }
            }, ct);

            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"Error playing sound effect: {ex.Message}");
            return Task.FromResult(false);
        }
    }

    public void Dispose()
    {
        try
        {
            mciSendString("close all", null, 0, IntPtr.Zero);
        }
        catch { }
    }
}
