using System.Security.Cryptography;
using System.Text;

namespace StreamerHub.Core.Audio;

public readonly record struct TtsSpeakResult(bool Ok, bool PlayedOnHost, string? AudioBase64);

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

    public async Task<TtsSpeakResult> SpeakAsync(string text, string? voiceName = null, double? rate = 1.0, double? pitch = 1.0, double? volume = 1.0, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text)) return new TtsSpeakResult(false, false, null);

        await _lock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_disposed) return new TtsSpeakResult(false, false, null);

            string trimmedText = text.Trim();

            // ONLY synthesize using Microsoft Online Neural Voices (Edge TTS) - NO offline/robotic fallback
            string mp3Path = await SynthesizeWithEdgeTtsAsync(trimmedText, voiceName, rate, pitch, volume, ct).ConfigureAwait(false);
            if (string.IsNullOrEmpty(mp3Path) || !File.Exists(mp3Path))
            {
                LogMessage?.Invoke("Edge TTS online synthesis failed to produce audio.");
                return new TtsSpeakResult(false, false, null);
            }

            // Read audio bytes to base64 for WebView2 HTML5 playback fallback
            byte[] fileBytes = await File.ReadAllBytesAsync(mp3Path, ct).ConfigureAwait(false);
            string base64Audio = Convert.ToBase64String(fileBytes);

            // Attempt host desktop playback (mciSendStringW with WMP COM backup)
            bool playedOnHost = await _soundPlayer.PlayAsync(mp3Path, volume, ct).ConfigureAwait(false);
            return new TtsSpeakResult(true, playedOnHost, base64Audio);
        }
        catch (Exception ex)
        {
            LogMessage?.Invoke($"Error in TTS SpeakAsync: {ex.Message}");
            return new TtsSpeakResult(false, false, null);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<string> SynthesizeWithEdgeTtsAsync(string text, string? requestedVoice, double? rate, double? pitch, double? volume, CancellationToken ct)
    {
        string safeVoice = requestedVoice?.Trim() ?? "";
        string rawKey = $"edge::{text}::{safeVoice}::{(rate ?? 1.0):F2}::{(pitch ?? 1.0):F2}";
        using var md5 = MD5.Create();
        string hash = Convert.ToHexString(md5.ComputeHash(Encoding.UTF8.GetBytes(rawKey)));
        string cachedFile = Path.Combine(_cacheDir, $"edge_tts_{hash}.mp3");

        if (File.Exists(cachedFile) && new FileInfo(cachedFile).Length > 100)
        {
            return cachedFile;
        }

        byte[]? audioBytes = await EdgeTtsClient.SynthesizeAsync(text, safeVoice, rate, pitch, volume, ct).ConfigureAwait(false);
        if (audioBytes != null && audioBytes.Length > 0)
        {
            await File.WriteAllBytesAsync(cachedFile, audioBytes, ct).ConfigureAwait(false);
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
