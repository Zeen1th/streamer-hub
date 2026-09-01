using System.Drawing.Text;

namespace StreamerHub.Core.Host;

public static class InstalledFontCatalog
{
    public static IReadOnlyList<string> GetFamilies()
    {
        using var collection = new InstalledFontCollection();
        return collection.Families
            .Select(font => font.Name.Trim())
            .Where(name => name.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }
}
