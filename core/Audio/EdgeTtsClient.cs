using System.Net.WebSockets;
using System.Security;
using System.Security.Cryptography;
using System.Text;

namespace StreamerHub.Core.Audio;

public static class EdgeTtsClient
{
    private const string TrustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private const long WinEpoch = 11644473600L;

    public const string DefaultMultilingualVoice = "en-AU-WilliamMultilingualNeural";
    public const string DefaultArabicVoice = "ar-SA-HamedNeural";

    public static async Task<byte[]?> SynthesizeAsync(
        string text,
        string? voice = null,
        double? rate = 1.0,
        double? pitch = 1.0,
        double? volume = 1.0,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        string voiceName = voice?.Trim() ?? "";
        if (string.IsNullOrEmpty(voiceName) || voiceName.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            // Default to WilliamMultilingual which naturally and fluently speaks both Arabic and English!
            voiceName = DefaultMultilingualVoice;
        }
        else if (voiceName.Contains("William", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = DefaultMultilingualVoice;
        }
        else if (voiceName.Contains("Hamed", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "ar-SA-HamedNeural";
        }
        else if (voiceName.Contains("Zariyah", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "ar-SA-ZariyahNeural";
        }
        else if (voiceName.Contains("Salma", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "ar-EG-SalmaNeural";
        }
        else if (voiceName.Contains("Shakir", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "ar-EG-ShakirNeural";
        }
        else if (voiceName.Contains("Andrew", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-US-AndrewMultilingualNeural";
        }
        else if (voiceName.Contains("Emma", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-US-EmmaMultilingualNeural";
        }
        else if (voiceName.Contains("Ava", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-US-AvaMultilingualNeural";
        }
        else if (voiceName.Contains("Jenny", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-US-JennyNeural";
        }
        else if (voiceName.Contains("Guy", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-US-GuyNeural";
        }
        else if (voiceName.Contains("Sonia", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-GB-SoniaNeural";
        }
        else if (voiceName.Contains("Ryan", StringComparison.OrdinalIgnoreCase))
        {
            voiceName = "en-GB-RyanNeural";
        }

        try
        {
            long currentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + WinEpoch;
            long roundedTime = (currentTime / 300) * 300;
            string data = $"{roundedTime * 10000000L}{TrustedClientToken}";
            using var sha256 = SHA256.Create();
            string secMsGec = Convert.ToHexString(sha256.ComputeHash(Encoding.ASCII.GetBytes(data))).ToUpperInvariant();

            string connectionId = Guid.NewGuid().ToString("N");
            string wsUrl = $"wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken={TrustedClientToken}&ConnectionId={connectionId}&Sec-MS-GEC={secMsGec}&Sec-MS-GEC-Version=1-143.0.3650.75";

            using var ws = new ClientWebSocket();
            ws.Options.SetRequestHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0");
            ws.Options.SetRequestHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold");
            ws.Options.SetRequestHeader("Pragma", "no-cache");
            ws.Options.SetRequestHeader("Cache-Control", "no-cache");
            ws.Options.SetRequestHeader("Accept-Encoding", "gzip, deflate, br, zstd");
            ws.Options.SetRequestHeader("Accept-Language", "en-US,en;q=0.9");
            string muid = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToUpperInvariant();
            ws.Options.SetRequestHeader("Cookie", $"muid={muid};");

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linkedCts.CancelAfter(TimeSpan.FromSeconds(15));

            await ws.ConnectAsync(new Uri(wsUrl), linkedCts.Token).ConfigureAwait(false);

            string jsDate = DateTime.UtcNow.ToString("ddd MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", System.Globalization.CultureInfo.InvariantCulture);

            // 1. Send speech.config
            string configMsg = $"X-Timestamp:{jsDate}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
                """{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}""" + "\r\n";

            byte[] configBytes = Encoding.UTF8.GetBytes(configMsg);
            await ws.SendAsync(new ArraySegment<byte>(configBytes), WebSocketMessageType.Text, true, linkedCts.Token).ConfigureAwait(false);

            // 2. Format rate / pitch / volume
            double r = Math.Clamp(rate ?? 1.0, 0.5, 2.0);
            int ratePct = (int)Math.Round((r - 1.0) * 100);
            string rateStr = ratePct >= 0 ? $"+{ratePct}%" : $"{ratePct}%";

            double p = Math.Clamp(pitch ?? 1.0, 0.5, 1.5);
            int pitchHz = (int)Math.Round((p - 1.0) * 50);
            string pitchStr = pitchHz >= 0 ? $"+{pitchHz}Hz" : $"{pitchHz}Hz";

            double v = Math.Clamp(volume ?? 1.0, 0.0, 1.0);
            int volPct = (int)Math.Round((v - 1.0) * 100);
            string volStr = volPct >= 0 ? $"+{volPct}%" : $"{volPct}%";

            string escapedText = SecurityElement.Escape(text);
            string reqId = Guid.NewGuid().ToString("N");
            string ssml = $"X-RequestId:{reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{jsDate}Z\r\nPath:ssml\r\n\r\n" +
                $"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
                $"<voice name='{voiceName}'><prosody pitch='{pitchStr}' rate='{rateStr}' volume='{volStr}'>{escapedText}</prosody></voice></speak>";

            byte[] ssmlBytes = Encoding.UTF8.GetBytes(ssml);
            await ws.SendAsync(new ArraySegment<byte>(ssmlBytes), WebSocketMessageType.Text, true, linkedCts.Token).ConfigureAwait(false);

            // 3. Receive audio stream
            using var audioMs = new MemoryStream();
            byte[] recvBuffer = new byte[64 * 1024];

            while (ws.State == WebSocketState.Open && !linkedCts.IsCancellationRequested)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(recvBuffer), linkedCts.Token).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string textMsg = Encoding.UTF8.GetString(recvBuffer, 0, result.Count);
                    if (textMsg.Contains("Path:turn.end", StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }
                }
                else if (result.MessageType == WebSocketMessageType.Binary && result.Count > 2)
                {
                    int headerLen = (recvBuffer[0] << 8) | recvBuffer[1];
                    if (headerLen > 0 && result.Count > 2 + headerLen)
                    {
                        string header = Encoding.UTF8.GetString(recvBuffer, 2, headerLen);
                        if (header.Contains("Path:audio", StringComparison.OrdinalIgnoreCase))
                        {
                            int audioOffset = 2 + headerLen;
                            int audioLen = result.Count - audioOffset;
                            audioMs.Write(recvBuffer, audioOffset, audioLen);
                        }
                    }
                }
            }

            try
            {
                if (ws.State == WebSocketState.Open)
                {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Done", CancellationToken.None).ConfigureAwait(false);
                }
            }
            catch { }

            return audioMs.Length > 0 ? audioMs.ToArray() : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EDGE TTS EXCEPTION] {ex}");
            return null;
        }
    }
}
