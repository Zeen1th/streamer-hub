using System.Diagnostics;
using System.IO.Compression;
using System.Text.RegularExpressions;

namespace StreamerHub.Core.Media;

public sealed record FfmpegStatus(bool Available, string? Path, string? Version);

public sealed record AlertMediaInfo(
    string FilePath,
    long FileSizeBytes,
    double DurationSeconds,
    int Width,
    int Height,
    double Fps,
    string VideoCodec,
    string AudioCodec,
    bool HasAlpha
);

public sealed record CompressionProgress(
    double Percent,
    double Fps,
    long SizeBytes,
    string Speed,
    double CurrentSeconds,
    double TotalSeconds
);

public sealed record CompressionResult(
    bool Success,
    string InputPath,
    string OutputPath,
    long OriginalSizeBytes,
    long CompressedSizeBytes,
    double DurationSeconds,
    string? Error
);

public sealed class AlertCompressorService
{
    private readonly string _appData;
    private Process? _activeProcess;
    private readonly object _processLock = new();

    public AlertCompressorService(string appData)
    {
        _appData = appData;
    }

    public FfmpegStatus CheckFfmpegStatus()
    {
        var localExe = Path.Combine(AppContext.BaseDirectory, "ffmpeg.exe");
        if (File.Exists(localExe))
            return new FfmpegStatus(true, localExe, GetFfmpegVersion(localExe));

        var appDataExe = Path.Combine(_appData, "bin", "ffmpeg.exe");
        if (File.Exists(appDataExe))
            return new FfmpegStatus(true, appDataExe, GetFfmpegVersion(appDataExe));

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                var candidate = Path.Combine(dir, "ffmpeg.exe");
                if (File.Exists(candidate))
                    return new FfmpegStatus(true, candidate, GetFfmpegVersion(candidate));
            }
            catch
            {
                // Skip invalid PATH entries
            }
        }

        // Test if system can run "ffmpeg" directly
        try
        {
            var version = GetFfmpegVersion("ffmpeg");
            if (!string.IsNullOrEmpty(version))
                return new FfmpegStatus(true, "ffmpeg", version);
        }
        catch
        {
            // not found
        }

        return new FfmpegStatus(false, null, null);
    }

    private static string? GetFfmpegVersion(string executable)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = "-version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p == null) return null;
            var output = p.StandardOutput.ReadLine();
            p.WaitForExit(3000);
            return output?.Trim();
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> DownloadFfmpegAsync(Action<int> onProgress, CancellationToken ct)
    {
        var binDir = Path.Combine(_appData, "bin");
        Directory.CreateDirectory(binDir);
        var targetExe = Path.Combine(binDir, "ffmpeg.exe");

        if (File.Exists(targetExe)) return true;

        var tempZip = Path.Combine(binDir, "ffmpeg_download.zip");
        const string downloadUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        using var response = await http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength ?? 90_000_000L;
        await using (var contentStream = await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false))
        await using (var fileStream = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
        {
            var buffer = new byte[81920];
            long totalRead = 0;
            int bytesRead;

            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, ct).ConfigureAwait(false)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), ct).ConfigureAwait(false);
                totalRead += bytesRead;
                var percent = (int)Math.Min(100, Math.Round((double)totalRead / totalBytes * 100));
                onProgress(percent);
            }
        }

        // Extract ffmpeg.exe from archive
        try
        {
            using var archive = ZipFile.OpenRead(tempZip);
            var ffmpegEntry = archive.Entries.FirstOrDefault(e => e.FullName.EndsWith("bin/ffmpeg.exe", StringComparison.OrdinalIgnoreCase)
                                                                 || e.Name.Equals("ffmpeg.exe", StringComparison.OrdinalIgnoreCase));
            if (ffmpegEntry == null)
                throw new InvalidOperationException("ffmpeg.exe was not found in downloaded archive.");

            ffmpegEntry.ExtractToFile(targetExe, overwrite: true);
        }
        finally
        {
            try { File.Delete(tempZip); } catch { }
        }

        return File.Exists(targetExe);
    }

    public async Task<AlertMediaInfo> InspectVideoAsync(string inputPath, CancellationToken ct)
    {
        if (!File.Exists(inputPath))
            throw new FileNotFoundException($"Input video not found: {inputPath}");

        var status = CheckFfmpegStatus();
        var ffmpegExe = status.Path ?? "ffmpeg";

        var psi = new ProcessStartInfo
        {
            FileName = ffmpegExe,
            Arguments = $"-i \"{inputPath}\"",
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Failed to start ffmpeg inspection.");
        var stderr = await process.StandardError.ReadToEndAsync(ct).ConfigureAwait(false);
        await process.WaitForExitAsync(ct).ConfigureAwait(false);

        var fileInfo = new FileInfo(inputPath);
        var sizeBytes = fileInfo.Length;

        // Duration: 00:00:32.01
        double duration = 0;
        var durMatch = Regex.Match(stderr, @"Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)");
        if (durMatch.Success)
        {
            var h = double.Parse(durMatch.Groups[1].Value);
            var m = double.Parse(durMatch.Groups[2].Value);
            var s = double.Parse(durMatch.Groups[3].Value);
            duration = h * 3600 + m * 60 + s;
        }

        // Resolution: 1920x1080
        int width = 1920;
        int height = 1080;
        var resMatch = Regex.Match(stderr, @"Stream #\d+:\d+.*Video:.*?(\d{3,5})x(\d{3,5})");
        if (resMatch.Success)
        {
            width = int.Parse(resMatch.Groups[1].Value);
            height = int.Parse(resMatch.Groups[2].Value);
        }

        // FPS: 30 fps or 30 tbr
        double fps = 30.0;
        var fpsMatch = Regex.Match(stderr, @"(\d+(?:\.\d+)?)\s*(?:fps|tbr)");
        if (fpsMatch.Success)
        {
            fps = double.Parse(fpsMatch.Groups[1].Value);
        }

        // Video codec
        var vCodecMatch = Regex.Match(stderr, @"Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_\-]+)");
        var videoCodec = vCodecMatch.Success ? vCodecMatch.Groups[1].Value : "unknown";

        // Audio codec
        var aCodecMatch = Regex.Match(stderr, @"Stream #\d+:\d+.*Audio:\s*([a-zA-Z0-9_\-]+)");
        var audioCodec = aCodecMatch.Success ? aCodecMatch.Groups[1].Value : "none";

        // Has alpha transparency
        bool hasAlpha = stderr.Contains("alpha_mode      : 1", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("ALPHA_MODE      : 1", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("yuva420p", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("yuva444p", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("yuva422p", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("rgba", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("bgra", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("argb", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("qtrle", StringComparison.OrdinalIgnoreCase)
                        || stderr.Contains("prores_4444", StringComparison.OrdinalIgnoreCase);

        return new AlertMediaInfo(
            FilePath: inputPath,
            FileSizeBytes: sizeBytes,
            DurationSeconds: Math.Max(0.1, duration),
            Width: width,
            Height: height,
            Fps: fps,
            VideoCodec: videoCodec,
            AudioCodec: audioCodec,
            HasAlpha: hasAlpha
        );
    }

    public async Task<CompressionResult> CompressAsync(
        string inputPath,
        string? outputPath,
        double targetSizeMb,
        int? customCrf,
        int? customMaxBitrateK,
        Action<CompressionProgress> onProgress,
        CancellationToken ct,
        bool lumaKeyEnabled = false,
        string? lumaKeyMode = "dark",
        double? lumaThreshold = 0.15,
        double? lumaTolerance = 0.10,
        double? lumaSoftness = 0.08,
        bool? lumaInvert = false,
        double? lumaChoke = 0.0,
        double? lumaGamma = 1.0,
        double? lumaOpacity = 1.0,
        string? outputFormat = "webm",
        string? keyType = "luma",
        string? keyColor = "#00ff00",
        int? rotation = 0)
    {
        if (!File.Exists(inputPath))
            return new CompressionResult(false, inputPath, outputPath ?? string.Empty, 0, 0, 0, "Input file does not exist.");

        var status = CheckFfmpegStatus();
        if (!status.Available || string.IsNullOrEmpty(status.Path))
            return new CompressionResult(false, inputPath, outputPath ?? string.Empty, 0, 0, 0, "FFmpeg is not installed or could not be found.");

        var info = await InspectVideoAsync(inputPath, ct).ConfigureAwait(false);
        var originalSize = info.FileSizeBytes;

        var isMov = string.Equals(outputFormat, "mov", StringComparison.OrdinalIgnoreCase) ||
                    (outputPath?.EndsWith(".mov", StringComparison.OrdinalIgnoreCase) ?? false);
        var formatExt = isMov ? ".mov" : ".webm";

        if (string.IsNullOrWhiteSpace(outputPath))
        {
            var dir = Path.GetDirectoryName(inputPath) ?? AppContext.BaseDirectory;
            var nameWithoutExt = Path.GetFileNameWithoutExtension(inputPath);
            var suffix = lumaKeyEnabled ? "_lumakey" : "_under30mb";
            outputPath = Path.Combine(dir, $"{nameWithoutExt}{suffix}{formatExt}");
        }
        else
        {
            var outDir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(outDir))
            {
                try { Directory.CreateDirectory(outDir); } catch { }
            }
        }

        // Calculate bitrate ceiling and CRF
        // Reserve 12% safety margin under targetSizeMb
        var safeTargetMb = Math.Min(targetSizeMb * 0.88, 26.5);
        var targetBits = safeTargetMb * 1024 * 1024 * 8;
        var totalBitrateKbps = info.DurationSeconds > 0 ? (int)Math.Round((targetBits / info.DurationSeconds) / 1000) : 2500;

        // Alpha stream consumes ~35% of total muxed bits in yuva420p BlockAddition mode
        var calculatedVideoBitrateK = Math.Clamp((int)(totalBitrateKbps * 0.65), 1000, 8000);
        var maxBitrateK = customMaxBitrateK ?? calculatedVideoBitrateK;

        // Auto CRF selection: lower = higher quality
        int crf;
        if (customCrf.HasValue)
        {
            crf = customCrf.Value;
        }
        else if (maxBitrateK >= 4000)
        {
            crf = 24;
        }
        else if (maxBitrateK >= 3000)
        {
            crf = 26;
        }
        else if (maxBitrateK >= 2000)
        {
            crf = 28;
        }
        else if (maxBitrateK >= 1500)
        {
            crf = 31;
        }
        else
        {
            crf = 34;
        }

        var threads = Math.Clamp(Environment.ProcessorCount, 4, 16);
        var isWebmInput = Path.GetExtension(inputPath).Equals(".webm", StringComparison.OrdinalIgnoreCase);

        // Build command arguments
        var args = new List<string>();

        // Overwrite
        args.Add("-y");

        // WebM VP9 input requires libvpx-vp9 decoder to read alpha
        if (isWebmInput)
        {
            args.Add("-c:v libvpx-vp9");
        }

        args.Add($"-i \"{inputPath}\"");

        // Video filters
        var vfFilters = new List<string>();
        if (lumaKeyEnabled)
        {
            var targetThresh = (lumaKeyMode?.ToLowerInvariant()) switch
            {
                "bright" => 1.0,
                "custom" => Math.Clamp(lumaThreshold ?? 0.15, 0.0, 1.0),
                _ => 0.0 // "dark" mode targets black
            };
            var effTol = Math.Clamp(lumaTolerance ?? 0.15, 0.001, 1.0);
            var effSoft = Math.Clamp(lumaSoftness ?? 0.08, 0.0, 1.0);

            // Lossless 90-degree rotation (pure pixel remap, no resampling)
            switch ((((rotation ?? 0) % 360) + 360) % 360)
            {
                case 90: vfFilters.Add("transpose=1"); break;
                case 180: vfFilters.Add("hflip,vflip"); break;
                case 270: vfFilters.Add("transpose=2"); break;
            }

            vfFilters.Add("format=yuva420p");
            var hex = (keyColor ?? "#00ff00").TrimStart('#');
            var isColorKey = string.Equals(keyType, "color", StringComparison.OrdinalIgnoreCase) &&
                             hex.Length == 6 && hex.All(Uri.IsHexDigit);
            if (isColorKey)
            {
                vfFilters.Add(FormattableString.Invariant($"colorkey=color=0x{hex}:similarity={Math.Max(effTol, 0.01):F3}:blend={effSoft:F3}"));
            }
            else
            {
                vfFilters.Add(FormattableString.Invariant($"lumakey=threshold={targetThresh:F3}:tolerance={effTol:F3}:softness={effSoft:F3}"));
            }
            if (lumaInvert == true)
            {
                vfFilters.Add("lutrgb=a='255-val'");
            }

            // Matte shaping: choke (shrink), gamma curve, then global opacity
            var effChoke = Math.Clamp(lumaChoke ?? 0.0, 0.0, 0.9);
            var effGamma = Math.Clamp(lumaGamma ?? 1.0, 0.2, 5.0);
            var effOpacity = Math.Clamp(lumaOpacity ?? 1.0, 0.0, 1.0);
            if (effChoke > 0.0 || Math.Abs(effGamma - 1.0) > 0.001 || effOpacity < 0.999)
            {
                vfFilters.Add(FormattableString.Invariant(
                    $"lut=a='maxval*{effOpacity:F3}*pow(clip((val-{effChoke:F3}*maxval)/(maxval*(1-{effChoke:F3})),0,1),{effGamma:F3})'"));
            }
        }

        if (vfFilters.Count > 0)
        {
            args.Add($"-vf \"{string.Join(",", vfFilters)}\"");
        }

        if (isMov)
        {
            // Apple ProRes 4444 with 10-bit alpha for maximum fidelity and editor compatibility
            args.Add("-c:v prores_ks");
            args.Add("-profile:v 4444");
            args.Add("-pix_fmt yuva444p10le");
            args.Add($"-threads {threads}");

            if (info.AudioCodec != "none")
            {
                args.Add("-c:a aac -b:a 192k");
            }
            else
            {
                args.Add("-an");
            }
        }
        else
        {
            // WebM VP9 with yuva420p alpha channel
            args.Add("-c:v libvpx-vp9");
            args.Add("-pix_fmt yuva420p");
            if (lumaKeyEnabled && customMaxBitrateK.HasValue)
            {
                var targetK = Math.Clamp(maxBitrateK, 200, 100000);
                args.Add($"-b:v {targetK}k");
                args.Add($"-maxrate {(int)(targetK * 1.5)}k");
                args.Add($"-bufsize {targetK * 2}k");
            }
            else
            {
                args.Add($"-b:v {maxBitrateK}k");
                args.Add($"-crf {crf}");
            }
            args.Add("-row-mt 1");
            args.Add($"-threads {threads}");
            args.Add("-cpu-used 3");

            // Audio handling
            if (info.AudioCodec == "opus")
            {
                args.Add("-c:a copy");
            }
            else if (info.AudioCodec != "none")
            {
                args.Add("-c:a libopus -b:a 128k");
            }
            else
            {
                args.Add("-an");
            }
        }

        args.Add($"\"{outputPath}\"");

        var argumentString = string.Join(" ", args);

        var psi = new ProcessStartInfo
        {
            FileName = status.Path,
            Arguments = argumentString,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        Process? process = null;
        try
        {
            lock (_processLock)
            {
                process = Process.Start(psi) ?? throw new InvalidOperationException("Failed to launch ffmpeg compression.");
                _activeProcess = process;
            }

            var stderrLines = new List<string>();

            // Read stderr line by line for progress
            var lineBuffer = new System.Text.StringBuilder();
            using var reader = process.StandardError;

            var buffer = new char[512];
            int read;
            while ((read = await reader.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false)) > 0)
            {
                if (ct.IsCancellationRequested)
                {
                    CancelActiveProcess();
                    throw new OperationCanceledException();
                }

                for (var i = 0; i < read; i++)
                {
                    var ch = buffer[i];
                    if (ch == '\r' || ch == '\n')
                    {
                        var line = lineBuffer.ToString();
                        lineBuffer.Clear();

                        if (!string.IsNullOrWhiteSpace(line))
                        {
                            stderrLines.Add(line);
                            if (stderrLines.Count > 100) stderrLines.RemoveAt(0);

                            ParseProgressLine(line, info.DurationSeconds, onProgress);
                        }
                    }
                    else
                    {
                        lineBuffer.Append(ch);
                    }
                }
            }

            await process.WaitForExitAsync(ct).ConfigureAwait(false);

            if (process.ExitCode == 0 && File.Exists(outputPath))
            {
                var compressedSize = new FileInfo(outputPath).Length;
                onProgress(new CompressionProgress(100.0, 0, compressedSize, "1.0x", info.DurationSeconds, info.DurationSeconds));
                return new CompressionResult(true, inputPath, outputPath, originalSize, compressedSize, info.DurationSeconds, null);
            }

            var errorSummary = stderrLines.Count > 0 ? string.Join("\n", stderrLines.TakeLast(10)) : "Unknown ffmpeg error";
            return new CompressionResult(false, inputPath, outputPath, originalSize, 0, info.DurationSeconds, errorSummary);
        }
        catch (OperationCanceledException)
        {
            try { if (File.Exists(outputPath)) File.Delete(outputPath); } catch { }
            return new CompressionResult(false, inputPath, outputPath, originalSize, 0, info.DurationSeconds, "Compression cancelled by user.");
        }
        catch (Exception ex)
        {
            try { if (File.Exists(outputPath)) File.Delete(outputPath); } catch { }
            return new CompressionResult(false, inputPath, outputPath, originalSize, 0, info.DurationSeconds, ex.Message);
        }
        finally
        {
            lock (_processLock)
            {
                if (_activeProcess == process)
                    _activeProcess = null;
            }
            process?.Dispose();
        }
    }

    private static void ParseProgressLine(string line, double totalSeconds, Action<CompressionProgress> onProgress)
    {
        // Example: frame=  150 fps= 17 q=52.0 Lsize=    3617KiB time=00:00:05.00 bitrate=5926.0kbits/s speed=0.578x
        var timeMatch = Regex.Match(line, @"time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)");
        if (!timeMatch.Success) return;

        var h = double.Parse(timeMatch.Groups[1].Value);
        var m = double.Parse(timeMatch.Groups[2].Value);
        var s = double.Parse(timeMatch.Groups[3].Value);
        var currentSeconds = h * 3600 + m * 60 + s;

        var percent = totalSeconds > 0 ? Math.Clamp(Math.Round((currentSeconds / totalSeconds) * 100, 1), 0.0, 99.5) : 0.0;

        double fps = 0;
        var fpsMatch = Regex.Match(line, @"fps=\s*(\d+(?:\.\d+)?)");
        if (fpsMatch.Success) fps = double.Parse(fpsMatch.Groups[1].Value);

        long sizeBytes = 0;
        var sizeMatch = Regex.Match(line, @"size=\s*(\d+)(KiB|kB|MB)");
        if (sizeMatch.Success)
        {
            var num = long.Parse(sizeMatch.Groups[1].Value);
            var unit = sizeMatch.Groups[2].Value;
            sizeBytes = unit switch
            {
                "KiB" => num * 1024,
                "kB" => num * 1000,
                "MB" => num * 1024 * 1024,
                _ => num
            };
        }

        string speed = "1.0x";
        var speedMatch = Regex.Match(line, @"speed=\s*([0-9\.]+)x");
        if (speedMatch.Success) speed = speedMatch.Groups[1].Value + "x";

        onProgress(new CompressionProgress(percent, fps, sizeBytes, speed, currentSeconds, totalSeconds));
    }

    public void CancelActiveProcess()
    {
        lock (_processLock)
        {
            if (_activeProcess != null && !_activeProcess.HasExited)
            {
                try
                {
                    _activeProcess.Kill(entireProcessTree: true);
                }
                catch
                {
                    // Ignore kill errors
                }
                _activeProcess = null;
            }
        }
    }
}
