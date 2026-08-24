using Testcontainers.PostgreSql;

namespace EduPlatform.IntegrationTests;

public sealed class PostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer? Container { get; private set; }

    public bool Available { get; private set; }

    public string ConnectionString =>
        Container?.GetConnectionString()
        ?? throw new InvalidOperationException("PostgreSQL container did not start.");

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
}

[CollectionDefinition("postgres")]
public sealed class PostgresTests : ICollectionFixture<PostgresFixture>;
