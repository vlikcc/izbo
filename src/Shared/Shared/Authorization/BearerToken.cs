using Microsoft.AspNetCore.Http;

namespace Shared.Authorization;

/// <summary>
/// Recovers the <c>Authorization</c> header value that a request authenticated with, so it can be
/// forwarded to another service on the caller's behalf.
/// </summary>
public static class BearerToken
{
    private const string AccessTokenQueryParameter = "access_token";
    private const string Scheme = "Bearer";

    /// <summary>
    /// The header value, or <c>null</c> when the request carries no token. Browsers cannot set headers
    /// on a WebSocket handshake, so SignalR clients pass the token as a query parameter instead; that
    /// form is normalised back into a header value here.
    /// </summary>
    public static string? FromRequest(HttpRequest? request)
    {
        if (request is null)
        {
            return null;
        }

        var header = request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(header))
        {
            return header;
        }

        var queryToken = request.Query[AccessTokenQueryParameter].ToString();
        return string.IsNullOrWhiteSpace(queryToken) ? null : $"{Scheme} {queryToken}";
    }
}
