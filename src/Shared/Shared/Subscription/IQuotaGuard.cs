using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Shared.Models;
using System.Security.Claims;

namespace Shared.Subscription;

/// <summary>The interface each service calls to enforce plan limits. Never throws for infrastructure
/// failures (SubscriptionService down, network timeout) when Subscription:FailOpen=true (the default) —
/// only a genuine "you're over your limit" throws QuotaExceededException.</summary>
public interface IQuotaGuard
{
    Task EnsureFeatureAsync(string featureCode, CancellationToken ct = default);
    Task TryConsumeAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default);
    Task ReleaseAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default);
    Task<long> GetLimitAsync(QuotaMetric metric, CancellationToken ct = default);
}

public class QuotaGuard : IQuotaGuard
{
    private readonly IEntitlementClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _cache;
    private readonly SubscriptionOptions _options;
    private readonly ILogger<QuotaGuard> _logger;

    public QuotaGuard(
        IEntitlementClient client,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache cache,
        IOptions<SubscriptionOptions> options,
        ILogger<QuotaGuard> logger)
    {
        _client = client;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task EnsureFeatureAsync(string featureCode, CancellationToken ct = default)
    {
        var entitlements = await GetEntitlementsCachedAsync(ct);
        if (entitlements == null)
        {
            if (_options.FailOpen) return;
            throw new QuotaExceededException(featureCode, "Abonelik servisine şu anda ulaşılamıyor.");
        }

        var feature = entitlements.Features.FirstOrDefault(f => f.FeatureCode == featureCode);
        if (feature == null || !feature.IsEnabled)
            throw new QuotaExceededException(featureCode);
    }

    public async Task TryConsumeAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default)
    {
        Shared.DTOs.ConsumeUsageResultDto? result;
        try
        {
            result = await _client.ConsumeAsync(metric, amount, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SubscriptionService usage/consume call failed for {Metric} (fail-open={FailOpen})", metric, _options.FailOpen);
            if (_options.FailOpen) return;
            throw new QuotaExceededException(metric, 0, 0, "Abonelik servisine şu anda ulaşılamıyor.");
        }

        InvalidateEntitlementsCache();

        if (result == null)
        {
            if (_options.FailOpen) return;
            throw new QuotaExceededException(metric, 0, 0, "Abonelik servisine şu anda ulaşılamıyor.");
        }

        if (!result.Allowed)
            throw new QuotaExceededException(metric, result.Limit, result.Used, result.Message);
    }

    public async Task ReleaseAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default)
    {
        try
        {
            await _client.ReleaseAsync(metric, amount, ct);
            InvalidateEntitlementsCache();
        }
        catch (Exception ex)
        {
            // Releasing must never fail the caller's request — worst case a counter is briefly
            // overstated until the next period rollover or an admin reconcile.
            _logger.LogWarning(ex, "SubscriptionService usage/release call failed for {Metric}", metric);
        }
    }

    public async Task<long> GetLimitAsync(QuotaMetric metric, CancellationToken ct = default)
    {
        var entitlements = await GetEntitlementsCachedAsync(ct);
        if (entitlements == null)
            return _options.FailOpen ? -1 : 0;

        return entitlements.Limits.FirstOrDefault(l => l.Metric == metric)?.Value ?? -1;
    }

    private async Task<Shared.DTOs.EntitlementsDto?> GetEntitlementsCachedAsync(CancellationToken ct)
    {
        var cacheKey = BuildCacheKey();
        if (cacheKey != null && _cache.TryGetValue(cacheKey, out Shared.DTOs.EntitlementsDto? cached))
            return cached;

        try
        {
            var result = await _client.GetEntitlementsAsync(ct);
            if (result != null && cacheKey != null)
                _cache.Set(cacheKey, result, TimeSpan.FromSeconds(Math.Max(1, _options.EntitlementsCacheSeconds)));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SubscriptionService entitlements call failed (fail-open={FailOpen})", _options.FailOpen);
            return null;
        }
    }

    private void InvalidateEntitlementsCache()
    {
        var cacheKey = BuildCacheKey();
        if (cacheKey != null) _cache.Remove(cacheKey);
    }

    private string? BuildCacheKey()
    {
        var userId = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return userId == null ? null : $"entitlements:{userId}";
    }
}
