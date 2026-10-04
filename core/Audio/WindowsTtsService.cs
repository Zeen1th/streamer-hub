using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace StreamerHub.Core.Audio;

public sealed class WindowsTtsService : IDisposable
{
    private readonly SoundEffectPlayer _soundPlayer;
    private readonly string _cacheDir;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _disposed;

    public event Action<string>? LogMessage;

    public WindowsTtsService(SoundEffectPlayer soundPlayer)
    {
        _soundPlayer = soundPlayer ?? throw new ArgumentNullException(nameof(soundPlayer));
        _cacheDir = Path.Combine(Path.GetTempPath(), "StreamerHub_TTS");
        try
        {
            if (!Directory.Exists(_cacheDir)) Directory.CreateDirectory(_cacheDir);
        }
        catch
        {
            // Ignore cache dir creation errors
        }
    }

    public async Task<bool> SpeakAsync(string text, string? voiceName = null, double? rate = 1.0, double? pitch = 1.0, double? volume = 1.0, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        await _lock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_disposed) return false;

            string wavPath = await SynthesizeToWavAsync(text.Trim(), voiceName, ct).ConfigureAwait(false);
            if (string.IsNullOrEmpty(wavPath) || !File.Exists(wavPath))
            {
                LogMessage?.Invoke("Failed to generate TTS audio file.");
                return false;
            }

            return await _soundPlayer.PlayAsync(wavPath, volume, ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"Error in TTS SpeakAsync: {ex.Message}");
            return false;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<string> SynthesizeToWavAsync(string text, string? requestedVoice, CancellationToken ct)
    {
        bool isArabic = Regex.IsMatch(text, @"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]");
        string safeVoice = requestedVoice?.Trim() ?? "";

        // Compute cache key
        string rawKey = $"{text}::{safeVoice}::{isArabic}";
        using var md5 = MD5.Create();
        string hash = Convert.ToHexString(md5.ComputeHash(Encoding.UTF8.GetBytes(rawKey)));
        string cachedFile = Path.Combine(_cacheDir, $"tts_{hash}.wav");

        if (File.Exists(cachedFile) && new FileInfo(cachedFile).Length > 100)
        {
            return cachedFile;
        }

        string base64Text = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
        string escapedCachedPath = cachedFile.Replace("'", "''");
        string escapedVoice = safeVoice.Replace("'", "''");

        string psScript = $$"""
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime] | Out-Null
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$isArabic = {{(isArabic ? "$true" : "$false")}}
$voiceName = '{{escapedVoice}}'

if ($voiceName -ne '') {
    $matched = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $voiceName -or $_.Id -like "*$voiceName*" } | Select-Object -First 1
    if ($matched) { $synth.Voice = $matched }
} elseif ($isArabic) {
    $arVoice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'ar*' } | Select-Object -First 1
    if ($arVoice) { $synth.Voice = $arVoice }
}

$rawText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{{base64Text}}'))
$asyncOp = $synth.SynthesizeTextToStreamAsync($rawText)
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }
$asTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$stream = $asTask.Invoke($null, @($asyncOp)).Result
$bytes = New-Object byte[] $stream.Size
$reader = New-Object Windows.Storage.Streams.DataReader $stream
[System.WindowsRuntimeSystemExtensions]::AsTask($reader.LoadAsync($stream.Size)).Wait()
$reader.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes('{{escapedCachedPath}}', $bytes)
""";

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -Command -",
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = psi };
        process.Start();

        await process.StandardInput.WriteAsync(psScript).ConfigureAwait(false);
        process.StandardInput.Close();

        await process.WaitForExitAsync(ct).ConfigureAwait(false);

        if (File.Exists(cachedFile) && new FileInfo(cachedFile).Length > 100)
        {
            return cachedFile;
        }

        return string.Empty;
    }

    public void Dispose()
    {
        _disposed = true;
        _lock.Dispose();
    }
}
