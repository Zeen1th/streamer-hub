using System.Runtime.InteropServices;

namespace StreamerHub.Core.Audio;

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorComObject { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator
{
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr ppDevices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
    [PreserveSig] int GetDevice(string pwstrId, out IMMDevice ppDevice);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr pClient);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr pClient);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice
{
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    [PreserveSig] int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
    [PreserveSig] int GetId(out IntPtr ppstrId);
    [PreserveSig] int GetState(out int pdwState);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume
{
    [PreserveSig] int RegisterControlChangeNotify(IntPtr pNotify);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr pNotify);
    [PreserveSig] int GetChannelCount(out uint pnChannelCount);
    [PreserveSig] int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    [PreserveSig] int GetMasterVolumeLevel(out float pfLevelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    [PreserveSig] int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    [PreserveSig] int VolumeStepUp(ref Guid pguidEventContext);
    [PreserveSig] int VolumeStepDown(ref Guid pguidEventContext);
    [PreserveSig] int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    [PreserveSig] int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
}

public sealed class WindowsMicController : IDisposable
{
    private const int EDataFlowCapture = 1; // eCapture
    private const int ERoleConsole = 0;     // eConsole
    private const int ClsCtxInprocServer = 1;

    private readonly object _lock = new();
    private CancellationTokenSource? _unmuteCts;
    private bool _isMutedByUs;
    private bool _disposed;

    public event Action<string>? LogMessage;

    public bool SetMicrophoneMute(bool mute)
    {
        try
        {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
            int hr = enumerator.GetDefaultAudioEndpoint(EDataFlowCapture, ERoleConsole, out var device);
            if (hr != 0 || device == null)
            {
                LogMessage?.Invoke($"Failed to get default microphone endpoint (HR: 0x{hr:X8})");
                return false;
            }

            var iid = typeof(IAudioEndpointVolume).GUID;
            hr = device.Activate(ref iid, ClsCtxInprocServer, IntPtr.Zero, out var volumeObj);
            if (hr != 0 || volumeObj is not IAudioEndpointVolume volume)
            {
                LogMessage?.Invoke($"Failed to activate IAudioEndpointVolume on microphone (HR: 0x{hr:X8})");
                return false;
            }

            Guid ctx = Guid.NewGuid();
            hr = volume.SetMute(mute, ref ctx);
            if (hr != 0)
            {
                LogMessage?.Invoke($"Failed to set microphone mute to {mute} (HR: 0x{hr:X8})");
                return false;
            }

            _isMutedByUs = mute;
            LogMessage?.Invoke(mute ? "Microphone muted." : "Microphone unmuted.");
            return true;
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"Error setting microphone mute: {ex.Message}");
            return false;
        }
    }

    public Task<bool> MuteForDurationAsync(int durationSeconds, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (_disposed) return Task.FromResult(false);

            int seconds = Math.Max(1, Math.Min(durationSeconds, 3600));

            // Cancel any previously scheduled unmute timer to reset duration
            _unmuteCts?.Cancel();
            _unmuteCts?.Dispose();

            bool muted = SetMicrophoneMute(true);
            if (!muted) return Task.FromResult(false);

            _unmuteCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var token = _unmuteCts.Token;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(seconds), token).ConfigureAwait(false);
                    lock (_lock)
                    {
                        if (!_disposed)
                        {
                            SetMicrophoneMute(false);
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    // Overridden by another mute or explicit unmute
                }
            }, token);

            return Task.FromResult(true);
        }
    }

    public void Unmute()
    {
        lock (_lock)
        {
            _unmuteCts?.Cancel();
            _unmuteCts?.Dispose();
            _unmuteCts = null;
            SetMicrophoneMute(false);
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_disposed) return;
            _disposed = true;

            try
            {
                _unmuteCts?.Cancel();
                _unmuteCts?.Dispose();
                _unmuteCts = null;

                if (_isMutedByUs)
                {
                    SetMicrophoneMute(false);
                }
            }
            catch
            {
                // Suppress disposal errors
            }
        }
    }
}
