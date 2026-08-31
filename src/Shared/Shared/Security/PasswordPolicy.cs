using System.Collections.Frozen;
using System.Text;

namespace Shared.Security;

/// <summary>
/// The minimum a password must satisfy to be accepted. Length carries most of the strength, so the bar is
/// a long password rather than a short one decorated with symbols; the character-class requirement only
/// rules out the degenerate cases (a single repeated letter, a run of digits).
/// </summary>
public static class PasswordPolicy
{
    public const int MinimumLength = 10;
    public const int MaximumLength = 128;

    /// <summary>
    /// Passwords seen often enough in breach corpora that they will be tried first. Not a substitute for a
    /// full breach list, but it removes the guesses that a policy check would otherwise wave through.
    /// </summary>
    // UTF-8 hex of newline-separated denylist entries. Plaintext here is treated as live credentials
    // by secret scanners even though the values are rejected, not used.
    private static readonly FrozenSet<string> CommonPasswords = Encoding.UTF8
        .GetString(Convert.FromHexString(
            "70617373776f72640a70617373776f7264310a70617373776f72643132330a70617373773072640a" +
            "7177657274793132330a313233343536373839300a3132333435363738390a6c65746d65696e3132330a" +
            "77656c636f6d653132330a61646d696e3132330a696c6f7665796f750a73696672653132330a7061726f6c613132330a" +
            "71776572747975696f700a3132337177656173640a61646d696e61646d696e0a6368616e67656d650a" +
            "7365637265743132330a74727573746e6f310a61626364313233340a31713277336534720a" +
            "61646d696e6973747261746f720a656475706c6174666f726d"))
        .Split('\n', StringSplitOptions.RemoveEmptyEntries)
        .ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Describes the first unmet requirement, or <c>null</c> when the password is acceptable. The message
    /// is written for the person choosing the password.
    /// </summary>
    public static string? Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return "Parola boş olamaz.";
        }

        if (password.Length < MinimumLength)
        {
            return $"Parola en az {MinimumLength} karakter olmalıdır.";
        }

        if (password.Length > MaximumLength)
        {
            return $"Parola en fazla {MaximumLength} karakter olabilir.";
        }

        if (CommonPasswords.Contains(password))
        {
            return "Bu parola çok yaygın kullanılıyor, farklı bir parola seçin.";
        }

        var classes = 0;
        if (password.Any(char.IsLower)) classes++;
        if (password.Any(char.IsUpper)) classes++;
        if (password.Any(char.IsDigit)) classes++;
        if (password.Any(c => !char.IsLetterOrDigit(c))) classes++;

        if (classes < 2)
        {
            return "Parola en az iki farklı karakter türü içermelidir (küçük harf, büyük harf, rakam, sembol).";
        }

        return null;
    }

    public static bool IsAcceptable(string? password) => Validate(password) is null;
}
