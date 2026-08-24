using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Globalization;
using System.Text.Json;
using System.Threading.RateLimiting;

namespace Shared.RateLimiting;

/// <summary>
/// Per-endpoint limits for the credential endpoints. The gateway's global per-IP limit is far too loose to
/// slow credential stuffing down — it allows hundreds of login attempts a minute, counted per instance.
/// </summary>
public static class AuthRateLimits
{
    public const string Login = "auth-login";
    public const string Registration = "auth-registration";
    public const string Refresh = "auth-refresh";
    public const string ForgotPassword = "auth-forgot-password";

    /// <summary>
    /// Registers the credential-endpoint policies, counting in Redis when a connection string is given so
    /// the limit applies across instances.
    /// </summary>
    public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services, string? redisConnectionString)
    {
        if (!string.IsNullOrWhiteSpace(redisConnectionString))
        {
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(Configure(redisConnectionString)));
        }

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = RejectAsync;

            AddPolicy(options, Login, new RedisRateLimitOptions("rl:login", PermitLimit: 10, TimeSpan.FromMinutes(5)));
            AddPolicy(options, Registration, new RedisRateLimitOptions("rl:register", PermitLimit: 5, TimeSpan.FromMinutes(15)));
            AddPolicy(options, Refresh, new RedisRateLimitOptions("rl:refresh", PermitLimit: 30, TimeSpan.FromMinutes(5)));
            AddPolicy(options, ForgotPassword, new RedisRateLimitOptions("rl:forgot", PermitLimit: 5, TimeSpan.FromMinutes(15)));
        });

        return services;
    }

    private static void AddPolicy(RateLimiterOptions options, string policyName, RedisRateLimitOptions limits) =>
        options.AddPolicy(policyName, context =>
        {
            var services = context.RequestServices;
            var redis = services.GetService<IConnectionMultiplexer>()?.GetDatabase();
            var logger = services.GetRequiredService<ILogger<RedisFixedWindowRateLimiter>>();

            return RateLimitPartition.Get(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                key => new RedisFixedWindowRateLimiter(redis, key, limits, logger));
        });

    private static async ValueTask RejectAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var response = context.HttpContext.Response;

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds))
                .ToString(CultureInfo.InvariantCulture);
        }

        response.ContentType = "application/json";

        await response.WriteAsync(
            JsonSerializer.Serialize(new
            {
                success = false,
                message = "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin."
            }),
            cancellationToken);
    }

    private static ConfigurationOptions Configure(string connectionString)
    {
        var configuration = ConfigurationOptions.Parse(connectionString);

        // A limiter must never hold a request open waiting for its counter. The limiter's local fallback
        // covers the case where Redis does not answer quickly.
        configuration.AbortOnConnectFail = false;
        configuration.ConnectTimeout = 1000;
        configuration.SyncTimeout = 500;

        return configuration;
    }
}
