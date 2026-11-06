using ContentService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Shared.Extensions;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>
/// An installation that predates a service has no database for it: the postgres init script only runs on
/// an empty volume. Startup must create it instead of crashing.
/// </summary>
[Collection("postgres")]
public class DatabaseCreationTests
{
    private readonly PostgresFixture _postgres;

    public DatabaseCreationTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task A_missing_service_database_is_created_and_migrated()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var name = "missing_" + Guid.NewGuid().ToString("N")[..12];
        var connection = new NpgsqlConnectionStringBuilder(_postgres.ConnectionStringFor("database_creation")) { Database = name }.ToString();
        var options = new DbContextOptionsBuilder<ContentDbContext>().UseNpgsql(connection).Options;

        await using (var db = new ContentDbContext(options))
        {
            (await db.Database.CanConnectAsync()).ShouldBeFalse("the database must not exist yet");

            DatabaseExtensions.EnsureDatabaseExists(db, NullLogger.Instance);
            DatabaseExtensions.EnsureDatabaseExists(db, NullLogger.Instance); // idempotent

            await db.Database.MigrateAsync();
        }

        await using var check = new ContentDbContext(options);
        (await check.Levels.CountAsync()).ShouldBeGreaterThan(0, "the migrations, seed included, ran on the new database");
    }
}
