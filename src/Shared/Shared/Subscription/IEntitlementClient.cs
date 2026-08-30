using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Shared.Subscription;

/// <summary>Talks to SubscriptionService's /api/internal/* endpoints. Forwards the current request's
/// own Bearer token unchanged, so the subscriber is always resolved from the original caller's
/// identity — this service never authenticates as itself.</summary>
public interface IEntitlementClient
{
    Task<EntitlementsDto?> GetEntitlementsAsync(CancellationToken ct = default);
    Task<ConsumeUsageResultDto?> ConsumeAsync(QuotaMetric metric, long amount, CancellationToken ct = default);
    Task ReleaseAsync(QuotaMetric metric, long amount, CancellationToken ct = default);
}

public class EntitlementClient : IEntitlementClient
{
    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public EntitlementClient(HttpClient httpClient, IHttpContextAccessor httpContextAccessor, IOptions<SubscriptionOptions> options)
    {
        _httpClient = httpClient;
        _httpContextAccessor = httpContextAccessor;
        _httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(1, options.Value.TimeoutSeconds));
    }

    public async Task<EntitlementsDto?> GetEntitlementsAsync(CancellationToken ct = default)
    {
        using var request = BuildRequest(HttpMethod.Get, "/api/internal/entitlements");
        if (request == null) return null;

        using var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<EntitlementsDto>>(SubscriptionJsonOptions.Default, ct);
        return body?.Data;
    }

    public async Task<ConsumeUsageResultDto?> ConsumeAsync(QuotaMetric metric, long amount, CancellationToken ct = default)
    {
        using var request = BuildRequest(HttpMethod.Post, "/api/internal/usage/consume");
        if (request == null) return null;

        request.Content = JsonContent.Create(new ConsumeUsageRequest(metric, amount), options: SubscriptionJsonOptions.Default);
        using var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ConsumeUsageResultDto>>(SubscriptionJsonOptions.Default, ct);
        return body?.Data;
    }

    public async Task ReleaseAsync(QuotaMetric metric, long amount, CancellationToken ct = default)
    {
        using var request = BuildRequest(HttpMethod.Post, "/api/internal/usage/release");
        if (request == null) return;

        request.Content = JsonContent.Create(new ConsumeUsageRequest(metric, amount), options: SubscriptionJsonOptions.Default);
        using var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    private HttpRequestMessage? BuildRequest(HttpMethod method, string path)
    {
        var token = GetBearerToken();
        if (token == null) return null;

        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private string? GetBearerToken()
    {
        var header = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header) || !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        return header["Bearer ".Length..];
    }
}
