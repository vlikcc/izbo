using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.Configuration;
using Shared.Seed;

namespace UserService.Data;

public static class UserDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<UserDbContext>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>().Value;
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("UserDataSeeder");

        if (!options.Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(options.Email) || string.IsNullOrWhiteSpace(options.Password))
        {
            return;
        }

        var email = options.Email.Trim().ToLowerInvariant();

        if (await context.Users.AnyAsync(u => u.Email == email || u.Id == options.AdminUserId))
        {
            logger.LogInformation("Admin profile already exists in UserService, skipping seed.");
            return;
        }

        context.Users.Add(AdminUserFactory.Create(options));
        await context.SaveChangesAsync();

        logger.LogInformation("Seeded admin profile in UserService.");
    }
}
