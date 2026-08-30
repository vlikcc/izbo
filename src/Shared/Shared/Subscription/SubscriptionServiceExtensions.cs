using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Shared.Subscription;

public static class SubscriptionServiceExtensions
{
    /// <summary>Wires up everything a consuming service needs to enforce plan quotas:
    /// - binds Subscription:* config (BaseUrl, FailOpen, cache/timeout)
    /// - a typed HttpClient to SubscriptionService that forwards the caller's own Bearer token
    /// - IMemoryCache for the 60s entitlements cache
    /// - IQuotaGuard, the interface services call to enforce limits.
    /// Also call app.UseSubscriptionQuotaExceptions() in the pipeline to turn QuotaExceededException
    /// into an HTTP 402.</summary>
    public static IServiceCollection AddSubscriptionGuard(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SubscriptionOptions>(configuration.GetSection(SubscriptionOptions.SectionName));
        services.AddHttpContextAccessor();
        services.AddMemoryCache();

        services.AddHttpClient<IEntitlementClient, EntitlementClient>((sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<SubscriptionOptions>>().Value;
            if (!string.IsNullOrWhiteSpace(options.BaseUrl))
                client.BaseAddress = new Uri(options.BaseUrl);
        });

        services.AddScoped<IQuotaGuard, QuotaGuard>();

        return services;
    }

    public static IApplicationBuilder UseSubscriptionQuotaExceptions(this IApplicationBuilder app)
        => app.UseMiddleware<QuotaExceptionMiddleware>();
}
