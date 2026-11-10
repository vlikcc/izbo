using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ContentService.Kampus.Data;

/// <summary>Lets <c>dotnet ef migrations add --context KampusDbContext</c> run without the app's configuration.</summary>
public sealed class KampusDesignTimeFactory : IDesignTimeDbContextFactory<KampusDbContext>
{
    public KampusDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<KampusDbContext>()
            .UseNpgsql("Host=localhost;Database=eduplatform_content",
                npgsql => npgsql.MigrationsHistoryTable(KampusDbContext.MigrationsHistoryTable))
            .Options);
}
