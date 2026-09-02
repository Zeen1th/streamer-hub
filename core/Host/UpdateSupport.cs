using System.Text.Json;

namespace StreamerHub.Core.Host;

public static class UpdateSupport
{
    public static string? SelectInstallerDownloadUrl(JsonElement release)
    {
        if (!release.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Array)
            return null;

        string? firstExecutable = null;
        foreach (var asset in assets.EnumerateArray())
        {
            if (!asset.TryGetProperty("name", out var nameValue) || !asset.TryGetProperty("browser_download_url", out var urlValue))
                continue;
            var name = nameValue.GetString();
            var url = urlValue.GetString();
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(url) || !name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                continue;
            if (firstExecutable is null) firstExecutable = url;
            if (name.Contains("setup", StringComparison.OrdinalIgnoreCase)) return url;
        }

        return firstExecutable;
    }

    public static string BuildInstallerArguments(string appDirectory)
    {
        var escapedDirectory = appDirectory.Replace("\"", "\\\"", StringComparison.Ordinal);
        return $"/DIR=\"{escapedDirectory}\" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS";
    }
}
