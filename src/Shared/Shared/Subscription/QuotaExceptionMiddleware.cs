using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace Shared.Subscription;

/// <summary>Turns a QuotaExceededException raised anywhere downstream into an HTTP 402 response using
/// the same ApiResponse envelope shape as the rest of the API, plus the extra fields the frontend's
/// axios interceptor needs to open the upgrade modal (metric, limit, current, upgradeUrl).</summary>
public class QuotaExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public QuotaExceptionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (QuotaExceededException ex)
        {
            context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            context.Response.ContentType = "application/json";

            var body = new
            {
                success = false,
                data = (object?)null,
                message = ex.Message,
                errors = new[] { "QUOTA_EXCEEDED" },
                errorCode = "QUOTA_EXCEEDED",
                metric = ex.Metric?.ToString(),
                featureCode = ex.FeatureCode,
                limit = ex.Limit,
                current = ex.Current,
                upgradeUrl = "/app/billing"
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(body));
        }
    }
}
