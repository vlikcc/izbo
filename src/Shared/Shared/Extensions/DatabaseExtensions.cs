using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shared.Extensions;

public static class DatabaseExtensions
{
    /// <summary>
    /// Applies pending EF migrations. On PostgreSQL the work is wrapped in an advisory lock so two
    /// instances booting together cannot race the schema.
    /// </summary>
    public static void ApplyMigrations<TContext>(this IHost host) where TContext : DbContext
    {
        ArgumentNullException.ThrowIfNull(host);

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Shared.Migrations");

        var isNpgsql = db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
        if (isNpgsql)
        {
            db.Database.OpenConnection();
            try
            {
                db.Database.ExecuteSqlRaw("SELECT pg_advisory_lock(hashtext(current_database()))");
                logger.LogInformation("Applying migrations for {Context}", typeof(TContext).Name);
                db.Database.Migrate();
            }
            finally
            {
                try
                {
                    db.Database.ExecuteSqlRaw("SELECT pg_advisory_unlock(hashtext(current_database()))");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to release the migration advisory lock");
                }

                db.Database.CloseConnection();
            }
        }
        else
        {
            db.Database.Migrate();
        }
    }
}
