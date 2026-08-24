using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Rpc;
using StreamerHub.Core.Twitch;

namespace StreamerHub.Core.Storage;

public sealed class TokenVault
{
    private readonly string _filePath;

    public TokenVault(string filePath)
    {
        _filePath = filePath;
    }

    public bool HasStoredToken() => File.Exists(_filePath);

    public TwitchTokens? Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return null;
            var protectedBytes = File.ReadAllBytes(_filePath);
            var jsonBytes = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<TwitchTokens>(Encoding.UTF8.GetString(jsonBytes), Json.Options);
        }
        catch
        {
            return null;
        }
    }

    public void Save(TwitchTokens tokens)
    {
        var json = JsonSerializer.Serialize(tokens, Json.Options);
        var protectedBytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(json), null, DataProtectionScope.CurrentUser);
        var dir = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var tmp = _filePath + ".tmp";
        File.WriteAllBytes(tmp, protectedBytes);
        File.Move(tmp, _filePath, overwrite: true);
    }

    public void Delete()
    {
        try
        {
            if (File.Exists(_filePath)) File.Delete(_filePath);
        }
        catch
        {
        }
    }
}
