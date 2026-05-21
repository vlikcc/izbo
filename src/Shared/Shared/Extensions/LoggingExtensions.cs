using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Formatting.Compact;

namespace Shared.Extensions;

public static class LoggingExtensions
{
    public static WebApplicationBuilder AddEduPlatformLogging(this WebApplicationBuilder builder)
    {
        builder.Host.UseSerilog((context, _, configuration) =>
        {
            configuration
                .ReadFrom.Configuration(context.Configuration)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", context.HostingEnvironment.ApplicationName)
                .Enrich.WithProperty("Environment", context.HostingEnvironment.EnvironmentName);

            if (context.HostingEnvironment.IsProduction())
            {
                configuration.WriteTo.Console(new CompactJsonFormatter());
            }
            else
            {
                configuration.WriteTo.Console();
            }
        });

        return builder;
    }
}
