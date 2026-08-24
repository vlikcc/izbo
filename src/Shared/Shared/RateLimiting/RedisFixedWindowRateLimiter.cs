using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Threading.RateLimiting;

namespace Shared.RateLimiting;

/// <summary>
/// A fixed-window counter held in Redis, so the limit applies to the deployment rather than to each
/// instance separately. The built-in limiters keep their counters in process memory, which means a
/// two-instance deployment quietly allows twice the configured rate.
///
/// Redis is treated as best-effort: when it cannot be reached the limiter falls back to an in-process
/// window of the same shape. Protection then degrades to per-instance rather than disappearing, which is
/// the right trade for endpoints that must stay reachable.
/// </summary>
public sealed class RedisFixedWindowRateLimiter : RateLimiter
{
    private readonly IDatabase? _redis;
    private readonly string _key;
    private readonly RedisRateLimitOptions _options;
    private readonly ILogger _logger;

    private readonly Lock _localGate = new();
    private int _localCount;
    private DateTimeOffset _localWindowEnd;

    public RedisFixedWindowRateLimiter(
        IDatabase? redis,
        string key,
        RedisRateLimitOptions options,
        ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _redis = redis;
        _key = key;
        _options = options;
        _logger = logger;
        _localWindowEnd = DateTimeOffset.UtcNow + options.Window;
    }

    /// <summary>Windows are short and cheap to recreate, so a limiter is collectable as soon as it is idle.</summary>
    public override TimeSpan? IdleDuration => _options.Window;

    public override RateLimiterStatistics? GetStatistics() => null;

    protected override RateLimitLease AttemptAcquireCore(int permitCount) => Acquire(permitCount);

    protected override ValueTask<RateLimitLease> AcquireAsyncCore(int permitCount, CancellationToken cancellationToken) =>
        new(Acquire(permitCount));

    private RateLimitLease Acquire(int permitCount)
    {
        // Requests for more than one permit are not part of this limiter's contract; treating them as one
        // would silently under-count, so they are refused.
        if (permitCount > 1)
        {
            throw new ArgumentOutOfRangeException(nameof(permitCount), permitCount, "Only single permits are supported.");
        }

        var count = TryCountInRedis() ?? CountLocally();

        return count <= _options.PermitLimit
            ? RateLimitLeases.Acquired
            : new DeniedLease(_options.Window);
    }

    /// <summary>
    /// Increments the window counter and returns the new value, or <c>null</c> when Redis is unavailable.
    /// The expiry is set on the increment that creates the key, which makes the window start at the first
    /// request rather than at a wall-clock boundary.
    /// </summary>
    private long? TryCountInRedis()
    {
        if (_redis is null)
        {
            return null;
        }

        try
        {
            var redisKey = (RedisKey)$"{_options.KeyPrefix}:{_key}";
            var count = _redis.StringIncrement(redisKey);

            if (count == 1)
            {
                _redis.KeyExpire(redisKey, _options.Window);
            }

            return count;
        }
        catch (RedisException ex)
        {
            _logger.LogWarning(ex, "Rate limit counter for {Key} could not be read from Redis; using the local window", _key);
            return null;
        }
        catch (TimeoutException ex)
        {
            _logger.LogWarning(ex, "Rate limit counter for {Key} timed out; using the local window", _key);
            return null;
        }
    }

    private long CountLocally()
    {
        lock (_localGate)
        {
            var now = DateTimeOffset.UtcNow;

            if (now >= _localWindowEnd)
            {
                _localCount = 0;
                _localWindowEnd = now + _options.Window;
            }

            return ++_localCount;
        }
    }

    private static class RateLimitLeases
    {
        internal static readonly RateLimitLease Acquired = new GrantedLease();
    }

    private sealed class GrantedLease : RateLimitLease
    {
        public override bool IsAcquired => true;

        public override IEnumerable<string> MetadataNames => [];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            metadata = null;
            return false;
        }
    }

    private sealed class DeniedLease : RateLimitLease
    {
        private readonly TimeSpan _retryAfter;

        internal DeniedLease(TimeSpan retryAfter) => _retryAfter = retryAfter;

        public override bool IsAcquired => false;

        public override IEnumerable<string> MetadataNames => [MetadataName.RetryAfter.Name];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            if (metadataName == MetadataName.RetryAfter.Name)
            {
                metadata = _retryAfter;
                return true;
            }

            metadata = null;
            return false;
        }
    }
}

/// <summary>How many requests a partition may make within one window.</summary>
public sealed record RedisRateLimitOptions(string KeyPrefix, int PermitLimit, TimeSpan Window);
