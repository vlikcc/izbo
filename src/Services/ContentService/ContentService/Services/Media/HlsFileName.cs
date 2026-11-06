using System.Text.RegularExpressions;

namespace ContentService.Services.Media;

/// <summary>
/// The only file names the HLS endpoint will serve. The transcoder writes a flat directory —
/// <c>master.m3u8</c>, <c>360p.m3u8</c>, <c>360p_000.ts</c> — so anything with a separator, a dot
/// segment, an encoded character or an unexpected extension is not one of ours, and is refused before it
/// can be joined onto an object key.
/// </summary>
public static partial class HlsFileName
{
    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\\.(m3u8|ts)$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();

    public static bool IsValid(string? fileName) =>
        !string.IsNullOrEmpty(fileName) && fileName.Length <= 72 && Pattern().IsMatch(fileName);

    public static string ContentTypeFor(string fileName)
    {
        ArgumentNullException.ThrowIfNull(fileName);

        return fileName.EndsWith(".m3u8", StringComparison.Ordinal)
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t";
    }
}
