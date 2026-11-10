namespace Shared.Security;

/// <summary>
/// YZ Kampüs password rules: the platform <see cref="PasswordPolicy"/> (length, common passwords) plus the
/// prototype's rule of at least one upper-case letter, one lower-case letter and one digit (Turkish letters
/// count). The prototype asked for 8 characters; the platform minimum of 10 wins.
/// </summary>
public static class KampusPasswordRules
{
    public static string? Validate(string? password)
    {
        if (PasswordPolicy.Validate(password) is { } error)
        {
            return error;
        }

        var value = password!;
        if (!value.Any(char.IsUpper))
        {
            return "Şifre en az bir büyük harf içermelidir.";
        }

        if (!value.Any(char.IsLower))
        {
            return "Şifre en az bir küçük harf içermelidir.";
        }

        if (!value.Any(char.IsDigit))
        {
            return "Şifre en az bir rakam içermelidir.";
        }

        return null;
    }
}
