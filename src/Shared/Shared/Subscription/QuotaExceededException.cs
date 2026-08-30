using Shared.Models;

namespace Shared.Subscription;

/// <summary>Thrown by IQuotaGuard when a plan limit or feature gate blocks the current operation.
/// Caught by QuotaExceptionMiddleware and turned into an HTTP 402 response.</summary>
public class QuotaExceededException : Exception
{
    public QuotaMetric? Metric { get; }
    public string? FeatureCode { get; }
    public long Limit { get; }
    public long Current { get; }

    public QuotaExceededException(QuotaMetric metric, long limit, long current, string? message = null)
        : base(message ?? "Planınızın kotasını doldurdunuz.")
    {
        Metric = metric;
        Limit = limit;
        Current = current;
    }

    public QuotaExceededException(string featureCode, string? message = null)
        : base(message ?? "Bu özellik mevcut planınızda bulunmuyor.")
    {
        FeatureCode = featureCode;
    }
}
