using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using System.Net;

namespace Shared.Extensions;

public static class ForwardedHeadersExtensions
{
    /// <summary>
    /// Trusts <c>X-Forwarded-For</c> and <c>X-Forwarded-Proto</c> from the container network.
    ///
    /// Requests arrive through Caddy and then the gateway, so without this every service sees the gateway's
    /// address as the client. Anything that decides per client — rate limiting, audit records — would then
    /// treat the whole internet as one caller.
    ///
    /// Only the private ranges are trusted. A host outside the deployment cannot present a source address
    /// in those ranges, so it cannot get its forwarded headers honoured.
    /// </summary>
    public static IServiceCollection AddForwardedHeaders(this IServiceCollection services) =>
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

            // Two hops: the edge proxy and the gateway.
            options.ForwardLimit = 2;

            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();

            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("10.0.0.0"), 8));
            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("172.16.0.0"), 12));
            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("192.168.0.0"), 16));
            options.KnownIPNetworks.Add(new System.Net.IPNetwork(IPAddress.Parse("127.0.0.0"), 8));
        });

    /// <summary>
    /// Applies the forwarded headers. Must run before anything that reads the client address or scheme,
    /// which in practice means first in the pipeline.
    /// </summary>
    public static IApplicationBuilder UseForwardedHeadersFromProxy(this IApplicationBuilder app) =>
        app.UseForwardedHeaders();
}
