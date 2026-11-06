using System.Text.RegularExpressions;

namespace Shared.Text;

/// <summary>Canonical form and allowed shape of sign-in names for accounts without an e-mail address.</summary>
public static partial class UsernameRules
{
    public const int MinLength = 4;
    public const int MaxLength = 32;

    /// <summary>Trims and lower-cases with the invariant culture, for the same reason as e-mail keys.</summary>
    public static string Normalize(string? username) => (username ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>
    /// Letters a–z, digits, dot and underscore. No '@', so a user name can never be mistaken for an address
    /// at sign-in.
    /// </summary>
    public static bool IsValid(string? username) => ValidShape().IsMatch(Normalize(username));

    [GeneratedRegex("^[a-z0-9._]{4,32}$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidShape();
}

/// <summary>Parsing and range rules for the school profile fields on student accounts.</summary>
public static class StudentProfileRules
{
    public const int MinGrade = 1;
    public const int MaxGrade = 12;

    public static bool IsValidGrade(int? grade) => grade is >= MinGrade and <= MaxGrade;

    /// <summary>For values that already passed validation: the parsed target, or null when unset or unknown.</summary>
    public static Models.ExamTarget? ParseExamTargetOrNull(string? value) =>
        TryParseExamTarget(value, out var target) ? target : null;

    /// <summary>Null or empty means "not set"; anything else must name an <see cref="Models.ExamTarget"/>.</summary>
    public static bool TryParseExamTarget(string? value, out Models.ExamTarget? target)
    {
        target = null;
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        if (Enum.TryParse<Models.ExamTarget>(value, ignoreCase: true, out var parsed) &&
            Enum.IsDefined(parsed))
        {
            target = parsed;
            return true;
        }

        return false;
    }
}
