using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Serilog.Context;

namespace Shared.Errors;

public static class CorrelationIdExtensions
{
    public const string HeaderName = "X-Correlation-ID";
    private const string ItemKey = "__correlationId";

    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var incoming = context.Request.Headers[HeaderName].FirstOrDefault();
            var id = string.IsNullOrWhiteSpace(incoming) ? context.TraceIdentifier : incoming.Trim();
            context.Items[ItemKey] = id;

            context.Response.OnStarting(() =>
            {
                context.Response.Headers[HeaderName] = id;
                return Task.CompletedTask;
            });

            using (LogContext.PushProperty("CorrelationId", id))
            {
                await next();
            }
        });

    public static string GetCorrelationId(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Items.TryGetValue(ItemKey, out var value) && value is string id && id.Length > 0)
        {
            return id;
        }

        return context.TraceIdentifier;
    }
}
