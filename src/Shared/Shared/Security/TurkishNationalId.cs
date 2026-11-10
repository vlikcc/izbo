namespace Shared.Security;

/// <summary>
/// T.C. Kimlik No format rules. The number is special-category personal data under KVKK: it is checked
/// here, then only ever stored encrypted and looked up by a keyed hash (see AuthService's
/// <c>NationalIdProtector</c>). Never log it, never put it in a URL or a token.
/// </summary>
public static class TurkishNationalId
{
    public const int Length = 11;

    /// <summary>Removes the spaces people type while reading the number off a card.</summary>
    public static string Normalize(string? value) =>
        new((value ?? string.Empty).Where(c => !char.IsWhiteSpace(c)).ToArray());

    /// <summary>
    /// Eleven digits, the first not zero, and both check digits right: the 10th is
    /// ((d1+d3+d5+d7+d9)·7 − (d2+d4+d6+d8)) mod 10, the 11th is the sum of the first ten mod 10.
    /// </summary>
    public static bool HasValidChecksum(string? value)
    {
        if (value is null || value.Length != Length || value[0] == '0' || !value.All(char.IsAsciiDigit))
        {
            return false;
        }

        var d = value.Select(c => c - '0').ToArray();
        var odd = d[0] + d[2] + d[4] + d[6] + d[8];
        var even = d[1] + d[3] + d[5] + d[7];
        var tenth = ((odd * 7 - even) % 10 + 10) % 10;
        var eleventh = d.Take(10).Sum() % 10;

        return tenth == d[9] && eleventh == d[10];
    }

    /// <summary>
    /// The number shape the prototype accepts as a demo exception (it fails the checksum). Only honoured
    /// where configuration explicitly allows demo numbers.
    /// </summary>
    public static bool HasValidShape(string? value) =>
        value is { Length: Length } && value[0] != '0' && value.All(char.IsAsciiDigit);
}
