using Shared.Models;
using System.Security.Claims;

namespace Shared.Authorization;

/// <summary>
/// The authenticated principal behind the current request, reduced to what authorization decisions need.
/// </summary>
public sealed record Caller(Guid UserId, UserRole Role)
{
    public bool IsPlatformAdmin => Role is UserRole.Admin or UserRole.SuperAdmin;

    public bool IsInstructor => Role is UserRole.Instructor;

    /// <summary>Instructors and administrators may author content; students may not.</summary>
    public bool CanManageContent => IsInstructor || IsPlatformAdmin;

    public bool Is(Guid userId) => UserId == userId;

    /// <summary>True when the caller is acting on their own data, or is an administrator.</summary>
    public bool CanActFor(Guid userId) => Is(userId) || IsPlatformAdmin;
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Reads the caller from the validated token. Throws when the token is missing the claims the
    /// authorization layer depends on, because silently defaulting would grant unintended access.
    /// </summary>
    public static Caller GetCaller(this ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);

        if (!principal.TryGetCaller(out var caller))
        {
            throw new InvalidOperationException(
                "The authenticated token does not carry a usable subject and role claim.");
        }

        return caller;
    }

    public static bool TryGetCaller(this ClaimsPrincipal? principal, out Caller caller)
    {
        caller = null!;

        var subject = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(subject, out var userId))
        {
            return false;
        }

        var roleValue = principal!.FindFirstValue(ClaimTypes.Role);
        if (!Enum.TryParse<UserRole>(roleValue, ignoreCase: true, out var role))
        {
            return false;
        }

        caller = new Caller(userId, role);
        return true;
    }
}
