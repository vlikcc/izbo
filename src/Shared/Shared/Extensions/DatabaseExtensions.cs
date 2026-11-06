using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Shared.Extensions;

public static class DatabaseExtensions
{
    public static void UseEduPlatformNpgsql(this DbContextOptionsBuilder options, string? connectionString)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.UseNpgsql(NpgsqlPooling.Apply(connectionString));
    }
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
            EnsureDatabaseExists(db, logger);
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

    /// <summary>
    /// Creates the service's database when it is missing. The postgres init script only runs on an empty
    /// volume, so a service added later (ContentService's <c>eduplatform_content</c>) would otherwise fail
    /// to start on an existing installation — and take every service that waits for it down with it.
    /// Needs the CREATEDB right, which the stack's postgres user has.
    /// </summary>
    public static void EnsureDatabaseExists(DbContext db, ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(logger);

        var creator = db.GetService<IRelationalDatabaseCreator>();
        if (creator.Exists())
        {
            return;
        }

        logger.LogWarning("Database for {Context} does not exist; creating it", db.GetType().Name);
        try
        {
            creator.Create();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.DuplicateDatabase)
        {
            // Another replica created it first.
        }
    }
}
