namespace EduPlatform.IntegrationTests;

/// <summary>
/// Passwords for tests, made at run time. They satisfy PasswordPolicy (length and character mix) but are
/// never written into the repository, so secret scanners have nothing to flag and no literal looks reusable.
/// </summary>
internal static class TestPasswords
{
    public static string Strong() => $"T{Guid.NewGuid():N}"[..16] + "-9";
}
