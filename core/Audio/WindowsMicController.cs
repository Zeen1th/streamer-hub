using System.Runtime.InteropServices;

namespace StreamerHub.Core.Audio;

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorComObject { }

[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceCollection
{
    [PreserveSig] int GetCount(out uint pcDevices);
    [PreserveSig] int Item(uint nDevice, out IMMDevice ppDevice);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator
{
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection ppDevices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr pClient);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr pClient);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice
{
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    [PreserveSig] int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
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
    [PreserveSig] int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    [PreserveSig] int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
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
    private const int EDataFlowCapture = 1;       // eCapture
    private const int DeviceStateActive = 1;      // DEVICE_STATE_ACTIVE
    private const int ERoleConsole = 0;           // eConsole
    private const int ERoleMultimedia = 1;        // eMultimedia
    private const int ERoleCommunications = 2;    // eCommunications
    private const int ClsCtxAll = 23;             // 0x17
    private const int ClsCtxInprocServer = 1;

    private readonly object _lock = new();
    private readonly HashSet<string> _mutedDeviceIds = new(StringComparer.OrdinalIgnoreCase);
    private CancellationTokenSource? _unmuteCts;
    private bool _isMutedByUs;
    private bool _disposed;

    public event Action<string>? LogMessage;

    public bool SetMicrophoneMute(bool mute)
    {
        try
        {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
            var devicesToToggle = new Dictionary<string, IMMDevice>(StringComparer.OrdinalIgnoreCase);

            // 1. Collect default capture devices for all roles (Communications, Console, Multimedia)
            int[] roles = [ERoleConsole, ERoleCommunications, ERoleMultimedia];
            foreach (int role in roles)
            {
                try
                {
                    int hr = enumerator.GetDefaultAudioEndpoint(EDataFlowCapture, role, out var dev);
                    if (hr == 0 && dev != null)
                    {
                        if (dev.GetId(out string id) == 0 && !string.IsNullOrEmpty(id))
                        {
                            devicesToToggle[id] = dev;
                        }
                    }
                }
                catch
                {
                    // Ignore roles that don't have default devices
                }
            }

            // 2. Also enumerate all active capture devices to catch any streamer mic setups
            try
            {
                int hr = enumerator.EnumAudioEndpoints(EDataFlowCapture, DeviceStateActive, out var collection);
                if (hr == 0 && collection != null)
                {
                    if (collection.GetCount(out uint count) == 0)
                    {
                        for (uint i = 0; i < count; i++)
                        {
                            if (collection.Item(i, out var dev) == 0 && dev != null)
                            {
                                if (dev.GetId(out string id) == 0 && !string.IsNullOrEmpty(id))
                                {
                                    devicesToToggle[id] = dev;
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LogMessage?.Invoke($"Warning enumerating active capture endpoints: {ex.Message}");
            }

            if (devicesToToggle.Count == 0)
            {
                LogMessage?.Invoke("No active microphone endpoints found to toggle.");
                return false;
            }

            int successCount = 0;
            Guid ctx = Guid.NewGuid();

            foreach (var (id, dev) in devicesToToggle)
            {
                try
                {
                    var volume = ActivateVolume(dev);
                    if (volume == null) continue;

                    int hr = volume.SetMute(mute, ref ctx);
                    if (hr >= 0)
                    {
                        successCount++;
                        if (mute)
                        {
                            _mutedDeviceIds.Add(id);
                        }
                        else
                        {
                            _mutedDeviceIds.Remove(id);
                        }
                    }
                    else
                    {
                        LogMessage?.Invoke($"SetMute({mute}) failed for device {id} (HR: 0x{hr:X8})");
                    }
                }
                catch (Exception ex)
                {
                    LogMessage?.Invoke($"Error toggling mute on device {id}: {ex.Message}");
                }
            }

            _isMutedByUs = mute && successCount > 0;
            LogMessage?.Invoke(mute 
                ? $"Microphone(s) muted ({successCount}/{devicesToToggle.Count} devices)." 
                : $"Microphone(s) unmuted ({successCount}/{devicesToToggle.Count} devices).");

            return successCount > 0;
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"Error setting microphone mute: {ex.Message}");
            return false;
        }
    }

    private static IAudioEndpointVolume? ActivateVolume(IMMDevice device)
    {
        var iid = typeof(IAudioEndpointVolume).GUID;
        int hr = device.Activate(ref iid, ClsCtxAll, IntPtr.Zero, out var obj);
        if (hr != 0 || obj is not IAudioEndpointVolume)
        {
            hr = device.Activate(ref iid, ClsCtxInprocServer, IntPtr.Zero, out obj);
        }
        return obj as IAudioEndpointVolume;
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
