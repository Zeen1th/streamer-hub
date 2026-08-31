using System.Runtime.InteropServices;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.Host;

internal sealed class GlobalHotkeyManager : IDisposable
{
    internal const int MessageId = 0x0312;
    private const uint NoRepeat = 0x4000;
    private readonly IntPtr _windowHandle;
    private readonly Dictionary<int, string> _bindingIds = new();

    public GlobalHotkeyManager(IntPtr windowHandle) => _windowHandle = windowHandle;

    public IReadOnlyList<KeybindRegistration> Replace(IReadOnlyList<ActionKeybind> bindings)
    {
        Clear();
        var results = new List<KeybindRegistration>();
        var chords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var registrationId = 0x5000;
        foreach (var binding in bindings)
        {
            if (!binding.Enabled)
            {
                results.Add(new(binding.Id, "disabled"));
                continue;
            }
            var canonical = $"{binding.Chord.Modifier?.Trim().ToLowerInvariant()}+{binding.Chord.Key.Trim()}";
            if (!chords.Add(canonical))
            {
                results.Add(new(binding.Id, "conflict", "This shortcut is already assigned."));
                continue;
            }
            if (!TryMap(binding.Chord, out var modifiers, out var virtualKey))
            {
                results.Add(new(binding.Id, "unsupported", "This key is not supported as a global shortcut."));
                continue;
            }
            var id = registrationId++;
            if (!RegisterHotKey(_windowHandle, id, modifiers | NoRepeat, virtualKey))
            {
                results.Add(new(binding.Id, "conflict", "Windows or another app is already using this shortcut."));
                continue;
            }
            _bindingIds[id] = binding.Id;
            results.Add(new(binding.Id, "registered"));
        }
        return results;
    }

    public string? Resolve(int registrationId) => _bindingIds.GetValueOrDefault(registrationId);

    private void Clear()
    {
        foreach (var id in _bindingIds.Keys) UnregisterHotKey(_windowHandle, id);
        _bindingIds.Clear();
    }

    private static bool TryMap(KeybindChord chord, out uint modifiers, out uint virtualKey)
    {
        modifiers = chord.Modifier?.Trim().ToLowerInvariant() switch
        {
            null or "" => 0, "alt" => 0x0001, "ctrl" => 0x0002,
            "shift" => 0x0004, "meta" => 0x0008, _ => uint.MaxValue,
        };
        virtualKey = 0;
        if (modifiers == uint.MaxValue) return false;
        var key = chord.Key.Trim();
        if (key.StartsWith("Key", StringComparison.Ordinal) && key.Length == 4 && char.IsAsciiLetter(key[3]))
            virtualKey = char.ToUpperInvariant(key[3]);
        else if (key.StartsWith("Digit", StringComparison.Ordinal) && key.Length == 6 && char.IsAsciiDigit(key[5]))
            virtualKey = key[5];
        else if (key.StartsWith('F') && int.TryParse(key.AsSpan(1), out var f) && f is >= 1 and <= 24)
            virtualKey = (uint)(0x70 + f - 1);
        else if (key.StartsWith("Numpad", StringComparison.Ordinal) && key.Length == 7 && char.IsAsciiDigit(key[6]))
            virtualKey = (uint)(0x60 + (key[6] - '0'));
        else
            virtualKey = key switch
            {
                "NumpadMultiply" => 0x6A, "NumpadAdd" => 0x6B, "NumpadSubtract" => 0x6D,
                "NumpadDecimal" => 0x6E, "NumpadDivide" => 0x6F,
                "Backspace" => 0x08, "Tab" => 0x09, "Enter" => 0x0D, "Pause" => 0x13,
                "CapsLock" => 0x14, "Escape" => 0x1B, "Space" => 0x20, "PageUp" => 0x21,
                "PageDown" => 0x22, "End" => 0x23, "Home" => 0x24, "ArrowLeft" => 0x25,
                "ArrowUp" => 0x26, "ArrowRight" => 0x27, "ArrowDown" => 0x28, "PrintScreen" => 0x2C,
                "Insert" => 0x2D, "Delete" => 0x2E, "ScrollLock" => 0x91,
                "AudioVolumeMute" => 0xAD, "AudioVolumeDown" => 0xAE, "AudioVolumeUp" => 0xAF,
                "MediaTrackNext" => 0xB0, "MediaTrackPrevious" => 0xB1, "MediaStop" => 0xB2,
                "MediaPlayPause" => 0xB3, _ => 0,
            };
        return virtualKey != 0;
    }

    public void Dispose() => Clear();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
