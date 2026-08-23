using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Shared.Authorization;

public static class AuthorizationServiceExtensions
{
    /// <summary>
    /// Registers the classroom access client used by services that store classroom-scoped content but
    /// do not own the enrollment tables. Reads the base address from <c>Services:ClassroomService</c>.
    /// </summary>
    public static IServiceCollection AddClassroomAccessClient(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var baseAddress = configuration["Services:ClassroomService"];
        if (string.IsNullOrWhiteSpace(baseAddress))
        {
            throw new InvalidOperationException(
                "Services:ClassroomService must be configured; classroom-scoped authorization depends on it.");
        }

        services.AddHttpContextAccessor();
        services.AddMemoryCache();

        services.AddHttpClient<IClassroomAccessClient, ClassroomAccessClient>(ClassroomAccessClient.HttpClientName, client =>
        {
            client.BaseAddress = new Uri(baseAddress.TrimEnd('/') + "/");
            // Authorization is on the request path, so a slow lookup must fail fast rather than
            // hold the caller's request open.
            client.Timeout = TimeSpan.FromSeconds(5);
        });

        return services;
    }
}
