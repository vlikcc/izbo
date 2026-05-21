using Shared.Configuration;
using Shared.Models;

namespace Shared.Seed;

public static class AdminUserFactory
{
    public static User Create(AdminSeedOptions options)
    {
        if (!Enum.TryParse<UserRole>(options.Role, ignoreCase: true, out var role))
        {
            role = UserRole.SuperAdmin;
        }

        if (role is not (UserRole.Admin or UserRole.SuperAdmin))
        {
            role = UserRole.SuperAdmin;
        }

        return new User
        {
            Id = options.AdminUserId,
            Email = options.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(options.Password),
            FirstName = options.FirstName,
            LastName = options.LastName,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }
}
