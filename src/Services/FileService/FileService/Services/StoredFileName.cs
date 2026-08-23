using System.Text.RegularExpressions;

namespace FileService.Services;

/// <summary>
/// Turns a client-supplied file name into something safe to store and to echo back.
/// Object keys are generated server-side, so this only protects the display name.
/// </summary>
public static partial class StoredFileName
{
    private const int MaxLength = 120;
    private const string Fallback = "file";

    /// <summary>
    /// Strips any directory component and reduces the remainder to a conservative character set, so a
    /// name like <c>../../etc/passwd</c> or one containing control characters cannot survive.
    /// </summary>
    public static string Sanitize(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Fallback;
        }

        // Handle both separators regardless of host OS: a Windows client may send backslashes.
        var name = fileName.Replace('\\', '/');
        name = name[(name.LastIndexOf('/') + 1)..].Trim();

        name = UnsafeCharacters().Replace(name, "_");
        name = RepeatedUnderscores().Replace(name, "_").Trim('_', '.');

        if (name.Length == 0)
        {
            return Fallback;
        }

        if (name.Length <= MaxLength)
        {
            return name;
        }

        // Truncate the stem rather than the extension, which callers rely on to pick a viewer.
        var extension = ExtensionOf(name);
        var stemLength = Math.Max(1, MaxLength - extension.Length);
        return string.Concat(name.AsSpan(0, stemLength), extension);
    }

    /// <summary>
    /// The lower-cased extension including the leading dot, or an empty string when there is none.
    /// Only recognises short alphanumeric extensions so a dotted name is not mistaken for one.
    /// </summary>
    public static string ExtensionOf(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return string.Empty;
        }

        var lastDot = fileName.LastIndexOf('.');
        if (lastDot < 0 || lastDot == fileName.Length - 1)
        {
            return string.Empty;
        }

        var extension = fileName[lastDot..].ToLowerInvariant();
        return ValidExtension().IsMatch(extension) ? extension : string.Empty;
    }

    [GeneratedRegex(@"[^a-zA-Z0-9._\- ]", RegexOptions.CultureInvariant)]
    private static partial Regex UnsafeCharacters();

    [GeneratedRegex(@"_{2,}", RegexOptions.CultureInvariant)]
    private static partial Regex RepeatedUnderscores();

    [GeneratedRegex(@"^\.[a-z0-9]{1,10}$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidExtension();
}
