using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;

namespace Shared.Internal;

/// <summary>
/// Restricts an endpoint to callers holding the internal shared key. These routes are also absent from
/// the gateway's route table, so this is defence in depth rather than the only control.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class InternalOnlyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        var configured = context.HttpContext.RequestServices
            .GetRequiredService<IOptions<InternalApiOptions>>().Value.ApiKey;

        // With no key configured the endpoint stays shut rather than open: a missing secret must not
        // silently turn an internal route into an anonymous one.
        if (string.IsNullOrWhiteSpace(configured))
        {
            context.Result = new NotFoundResult();
            return;
        }

        var presented = context.HttpContext.Request.Headers[InternalApiOptions.HeaderName].ToString();

        if (!FixedTimeEquals(presented, configured))
        {
            // 404 rather than 401: an unauthenticated caller learns nothing about what lives here.
            context.Result = new NotFoundResult();
            return;
        }

        await next();
    }

    private static bool FixedTimeEquals(string presented, string configured)
    {
        if (string.IsNullOrEmpty(presented))
        {
            return false;
        }

        var a = Encoding.UTF8.GetBytes(presented);
        var b = Encoding.UTF8.GetBytes(configured);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}
