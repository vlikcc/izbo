using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Shared.Extensions;

public static class HealthCheckExtensions
{
    public static IServiceCollection AddEduPlatformHealthChecks(
        this IServiceCollection services,
        IConfiguration configuration,
        bool includeRedis = false)
    {
        var healthChecks = services.AddHealthChecks();

        var postgres = configuration.GetConnectionString("Postgres");
        if (!string.IsNullOrWhiteSpace(postgres))
        {
            healthChecks.AddNpgSql(postgres, name: "postgres");
        }

        if (includeRedis)
        {
            var redis = configuration.GetConnectionString("Redis");
            if (!string.IsNullOrWhiteSpace(redis))
            {
                healthChecks.AddRedis(redis, name: "redis");
            }
        }

        return services;
    }
}
