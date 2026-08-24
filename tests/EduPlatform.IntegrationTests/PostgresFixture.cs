using System.Collections.Concurrent;
using Npgsql;
using Testcontainers.PostgreSql;

namespace EduPlatform.IntegrationTests;

public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly ConcurrentDictionary<string, string> _databases = new(StringComparer.Ordinal);

    public PostgreSqlContainer? Container { get; private set; }

    public bool Available { get; private set; }

    public string ConnectionString =>
        Container?.GetConnectionString()
        ?? throw new InvalidOperationException("PostgreSQL container did not start.");

    /// <summary>
    /// Each context (auth, classroom, exam, …) needs its own catalog. <c>EnsureCreated</c> is a no-op when
    /// the shared database already has another service's tables, which is how CI lost <c>classrooms</c>.
    /// </summary>
    public string ConnectionStringFor(string databaseName)
    {
        if (Container is null)
        {
            throw new InvalidOperationException("PostgreSQL container did not start.");
        }

        if (databaseName.Length is 0 or > 63
            || databaseName.Any(static c => !char.IsAsciiLetterOrDigit(c) && c != '_'))
        {
            throw new ArgumentException("Database name must be a short ASCII identifier.", nameof(databaseName));
        }

        return _databases.GetOrAdd(databaseName, CreateDatabase);
    }

    public async Task InitializeAsync()
    {
        try
        {
            Container = new PostgreSqlBuilder("postgres:16-alpine").Build();
            await Container.StartAsync();
            Available = true;
        }
        catch (Exception)
        {
            Available = false;
        }
    }

    public async Task DisposeAsync()
    {
        if (Container is not null)
        {
            await Container.DisposeAsync();
        }
    }

    private string CreateDatabase(string databaseName)
    {
        var admin = new NpgsqlConnectionStringBuilder(ConnectionString)
        {
            Database = "postgres"
        };

        using var connection = new NpgsqlConnection(admin.ConnectionString);
        connection.Open();

        using (var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @name", connection))
        {
            exists.Parameters.AddWithValue("name", databaseName);
            if (exists.ExecuteScalar() is null)
            {
                using var create = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
                create.ExecuteNonQuery();
            }
        }

        admin.Database = databaseName;
        return admin.ConnectionString;
    }
}

[CollectionDefinition("postgres")]
public sealed class PostgresTests : ICollectionFixture<PostgresFixture>;
