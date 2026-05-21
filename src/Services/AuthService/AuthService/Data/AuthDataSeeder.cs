using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.Configuration;
using Shared.Seed;

namespace AuthService.Data;

public static class AuthDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>().Value;
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("AuthDataSeeder");

        if (!options.Enabled)
        {
            logger.LogInformation("Admin seed disabled (Seed:Enabled=false).");
            return;
        }

        if (string.IsNullOrWhiteSpace(options.Email) || string.IsNullOrWhiteSpace(options.Password))
        {
            logger.LogWarning("Admin seed skipped: Seed:Email or Seed:Password is empty.");
            return;
        }

        var email = options.Email.Trim().ToLowerInvariant();

        if (await context.Users.AnyAsync(u => u.Email == email || u.Id == options.AdminUserId))
        {
            logger.LogInformation("Admin user already exists ({Email}), skipping seed.", email);
            return;
        }

        var admin = AdminUserFactory.Create(options);
        context.Users.Add(admin);
        await context.SaveChangesAsync();

        logger.LogInformation(
            "Seeded admin user {Email} with role {Role}. Change the password after first login in production.",
            admin.Email,
            admin.Role);
    }
}
