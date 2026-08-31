using Shared.Models;

namespace Shared.Authorization;

/// <summary>
/// Role names as they appear in the JWT role claim, plus the comma-separated groups used by
/// <c>[Authorize(Roles = ...)]</c>. Centralised because a typo in a role string silently opens or
/// closes an endpoint, and because SuperAdmin was previously omitted from several admin gates.
/// </summary>
public static class UserRoles
{
    public const string Student = nameof(UserRole.Student);
    public const string Instructor = nameof(UserRole.Instructor);
    public const string Admin = nameof(UserRole.Admin);
    public const string SuperAdmin = nameof(UserRole.SuperAdmin);

    /// <summary>Platform administrators. SuperAdmin must always accompany Admin.</summary>
    public const string Administrators = $"{Admin},{SuperAdmin}";

    /// <summary>Anyone allowed to author and manage teaching content.</summary>
    public const string ContentManagers = $"{Instructor},{Admin},{SuperAdmin}";
}
