namespace Shared.Text;

/// <summary>
/// Canonical form for e-mail addresses used as lookup keys.
/// </summary>
public static class EmailNormalizer
{
    /// <summary>
    /// Trims and lower-cases using the invariant culture. Turkish culture maps 'I' to 'ı', which would
    /// make the same address hash to two different keys depending on the server locale.
    /// </summary>
    public static string Normalize(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();
}
