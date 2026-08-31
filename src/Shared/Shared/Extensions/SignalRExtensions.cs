using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace Shared.Extensions;

public static class SignalRExtensions
{
    /// <summary>
    /// Adds SignalR, and a Redis backplane when a Redis connection string is configured so hub
    /// messages reach clients connected to a different instance.
    /// </summary>
    public static IServiceCollection AddEduPlatformSignalR(
        this IServiceCollection services,
        IConfiguration configuration,
        string channelPrefix,
        Action<HubOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentException.ThrowIfNullOrWhiteSpace(channelPrefix);

        var builder = services.AddSignalR(options => configure?.Invoke(options));
        var redis = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redis))
        {
            builder.AddStackExchangeRedis(redis, options =>
            {
                options.Configuration.ChannelPrefix = RedisChannel.Literal(channelPrefix);
            });
        }

        return services;
    }
}
