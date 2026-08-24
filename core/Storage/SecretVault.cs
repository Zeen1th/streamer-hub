using System.Security.Cryptography;
using System.Text;

namespace StreamerHub.Core.Storage;

public sealed class SecretVault
{
    private readonly string _filePath;

    public SecretVault(string filePath) => _filePath = filePath;

    public string? Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return null;
            var bytes = ProtectedData.Unprotect(File.ReadAllBytes(_filePath), null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch
        {
            return null;
        }
    }

    public void Save(string value)
    {
        var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(value), null, DataProtectionScope.CurrentUser);
        var dir = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var tmp = _filePath + ".tmp";
        File.WriteAllBytes(tmp, bytes);
        File.Move(tmp, _filePath, overwrite: true);
    }

    public void Delete()
    {
        try { if (File.Exists(_filePath)) File.Delete(_filePath); } catch { }
    }
}
