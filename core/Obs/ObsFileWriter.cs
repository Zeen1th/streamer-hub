namespace StreamerHub.Core.Obs;

public sealed class ObsFileWriter
{
    private readonly object _lock = new();
    private string? _lastPath;
    private string? _lastContent;

    public async Task<(bool Ok, string? Error)> WriteAsync(string filePath, string content, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(filePath))
            return (false, "No target file set");

        try
        {
            lock (_lock)
            {
                if (filePath == _lastPath && content == _lastContent && File.Exists(filePath))
                    return (true, null);
            }

            var full = Path.GetFullPath(filePath);
            var dir = Path.GetDirectoryName(full);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

            var tmp = full + ".tmp";
            await File.WriteAllTextAsync(tmp, content, ct).ConfigureAwait(false);

            for (var attempt = 0; ; attempt++)
            {
                try
                {
                    File.Move(tmp, full, overwrite: true);
                    break;
                }
                catch (IOException) when (attempt == 0)
                {
                    await Task.Delay(50, ct).ConfigureAwait(false);
                }
            }

            lock (_lock)
            {
                _lastPath = filePath;
                _lastContent = content;
            }
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
