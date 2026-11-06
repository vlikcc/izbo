using System.Text;

namespace ContentService.Services;

/// <summary>Turns Turkish names into URL slugs: "Fen Bilimleri" → "fen-bilimleri", "Üslü Sayılar" → "uslu-sayilar".</summary>
public static class Slug
{
    public static string From(string value, int maxLength = 100)
    {
        ArgumentNullException.ThrowIfNull(value);

        var builder = new StringBuilder(value.Length);
        var pendingDash = false;

        // Culture-free on purpose: containers may run with invariant globalization, where tr-TR is unavailable.
        foreach (var original in value.Trim())
        {
            var raw = original is 'İ' or 'I' ? 'i' : char.ToLowerInvariant(original);
            var c = raw switch
            {
                'ç' => 'c',
                'ğ' => 'g',
                'ı' => 'i',
                'ö' => 'o',
                'ş' => 's',
                'ü' => 'u',
                'â' => 'a',
                'î' => 'i',
                'û' => 'u',
                _ => raw
            };

            if (char.IsAsciiLetterOrDigit(c))
            {
                if (pendingDash && builder.Length > 0)
                {
                    builder.Append('-');
                }

                builder.Append(c);
                pendingDash = false;
            }
            else
            {
                pendingDash = true;
            }
        }

        var slug = builder.ToString();
        if (slug.Length > maxLength)
        {
            slug = slug[..maxLength].TrimEnd('-');
        }

        return slug.Length == 0 ? "x" : slug;
    }
}
