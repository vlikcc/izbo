using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using Shared.Authorization;
using Shared.DTOs;
using System.Net.Http.Json;

namespace Shared.Subscription;

/// <summary>What a student's package allows, plus the catalogue levels they study (grade and exam track).</summary>
public sealed record LearnerProfile(int Tier, IReadOnlyCollection<string> Features, int PracticeTestsPerDay, IReadOnlyCollection<string> Levels)
{
    public static LearnerProfile Free(int practiceTestsPerDay, IReadOnlyCollection<string>? levels = null) =>
        new(0, [], practiceTestsPerDay, levels ?? []);

    public bool Has(string feature) => Features.Contains(feature);
}

/// <summary>Student package features, as SubscriptionService names them.</summary>
public static class LearnerFeatureCodes
{
    public const string PremiumContent = "premium_content";
    public const string UnlimitedPractice = "unlimited_practice";
    public const string PremiumAssessments = "premium_assessments";
}

/// <summary>Why a request needs a package; the frontend picks its message from this.</summary>
public static class PackageRequiredReasons
{
    public const string PremiumContent = "premium_content";
    public const string DailyLimit = "daily_limit";
    public const string PremiumAssessment = "premium_assessment";
}

/// <summary>Turns into HTTP 402 with <c>errorCode = PACKAGE_REQUIRED</c> (see <see cref="QuotaExceptionMiddleware"/>).</summary>
public class PackageRequiredException : Exception
{
    public PackageRequiredException() : this(1, PackageRequiredReasons.PremiumContent, "Bu içerik için bir paket gerekiyor")
    {
    }

    public PackageRequiredException(string message) : this(1, PackageRequiredReasons.PremiumContent, message)
    {
    }

    public PackageRequiredException(string message, Exception innerException) : base(message, innerException)
    {
        Reason = PackageRequiredReasons.PremiumContent;
        RequiredTier = 1;
    }

    public PackageRequiredException(int requiredTier, string reason, string message) : base(message)
    {
        RequiredTier = requiredTier;
        Reason = reason;
    }

    /// <summary>1 Temel, 2 Plus, 3 Premium.</summary>
    public int RequiredTier { get; }

    public string Reason { get; }
}

public static class LearnerLevels
{
    private static readonly TimeZoneInfo Istanbul = FindIstanbul();

    /// <summary>
    /// The catalogue levels a student studies: their grade, plus the exam track they prepare for.
    /// Mirrors the frontend's <c>levelSlugsForUser</c>.
    /// </summary>
    public static List<string> For(int? gradeLevel, string? examTarget)
    {
        var slugs = new List<string>();
        if (gradeLevel is >= 1 and <= 12)
        {
            slugs.Add($"{gradeLevel}-sinif");
        }

        if (string.Equals(examTarget, "Lgs", StringComparison.OrdinalIgnoreCase))
        {
            slugs.Add("lgs");
        }
        else if (string.Equals(examTarget, "Yks", StringComparison.OrdinalIgnoreCase))
        {
            slugs.AddRange(["yks-tyt", "yks-ayt", "yks-ydt"]);
        }

        return slugs;
    }

    /// <summary>Midnight of <paramref name="utcNow"/>'s day in Istanbul, as UTC: daily limits reset then.</summary>
    public static DateTime StartOfIstanbulDay(DateTime utcNow)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), Istanbul);
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified), Istanbul);
    }

    private static TimeZoneInfo FindIstanbul()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
        }
        catch (TimeZoneNotFoundException)
        {
            // Türkiye has stayed on UTC+3 all year since 2016.
            return TimeZoneInfo.CreateCustomTimeZone("Europe/Istanbul", TimeSpan.FromHours(3), "Istanbul", "Istanbul");
        }
    }
}

/// <summary>Resolves the current caller's student package and study levels.</summary>
public interface ILearnerAccessClient
{
    Task<LearnerProfile> GetAsync(Caller caller, CancellationToken cancellationToken = default);
}

public class LearnerAccessOptions
{
    public const string SectionName = "Learner";

    /// <summary>Daily topic/unit tests without a package, used when SubscriptionService cannot be reached.</summary>
    public int FreePracticeTestsPerDay { get; set; } = 3;

    public int CacheSeconds { get; set; } = 60;
}

/// <summary>
/// Asks SubscriptionService for the caller's package and UserService for their grade, forwarding the caller's
/// own bearer token. Unlike teacher quotas this fails closed for premium: an outage means the free tier, never
/// a free upgrade. Answers are cached briefly per user, failures for a shorter time so a video's segment
/// requests don't each wait on a timeout.
/// </summary>
public sealed class LearnerAccessClient : ILearnerAccessClient
{
    public const string SubscriptionClientName = "learner-access-subscription";
    public const string UserClientName = "learner-access-users";

    private static readonly TimeSpan FailureCacheDuration = TimeSpan.FromSeconds(15);

    private readonly IHttpClientFactory _httpClients;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _cache;
    private readonly LearnerAccessOptions _options;
    private readonly ILogger<LearnerAccessClient> _logger;

    public LearnerAccessClient(
        IHttpClientFactory httpClients,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache cache,
        Microsoft.Extensions.Options.IOptions<LearnerAccessOptions> options,
        ILogger<LearnerAccessClient> logger)
    {
        ArgumentNullException.ThrowIfNull(options);
        _httpClients = httpClients;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<LearnerProfile> GetAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var cacheKey = (nameof(LearnerAccessClient), caller.UserId);
        if (_cache.TryGetValue(cacheKey, out LearnerProfile? cached) && cached is not null)
        {
            return cached;
        }

        var authorization = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization))
        {
            return LearnerProfile.Free(_options.FreePracticeTestsPerDay);
        }

        var access = await GetAsync<LearnerAccessDto>(SubscriptionClientName, "api/internal/learner-access", authorization, cancellationToken);
        var user = await GetAsync<UserDto>(UserClientName, "api/users/me", authorization, cancellationToken);
        var levels = user is null ? [] : LearnerLevels.For(user.GradeLevel, user.ExamTarget);

        var profile = access is null
            ? LearnerProfile.Free(_options.FreePracticeTestsPerDay, levels)
            : new LearnerProfile(access.Tier, access.Features, access.PracticeTestsPerDay, levels);

        var lifetime = access is null || user is null
            ? FailureCacheDuration
            : TimeSpan.FromSeconds(Math.Max(1, _options.CacheSeconds));
        _cache.Set(cacheKey, profile, lifetime);
        return profile;
    }

    private async Task<T?> GetAsync<T>(string clientName, string path, string authorization, CancellationToken cancellationToken)
        where T : class
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation(HeaderNames.Authorization, authorization);

        try
        {
            using var response = await _httpClients.CreateClient(clientName).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Learner access lookup {Path} failed with status {StatusCode}", path, (int)response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<ApiResponse<T>>(SubscriptionJsonOptions.Default, cancellationToken);
            return body?.Data;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException
                                   && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Learner access lookup {Path} could not be completed", path);
            return null;
        }
    }
}

public static class LearnerAccessServiceExtensions
{
    /// <summary>
    /// Registers <see cref="ILearnerAccessClient"/>. Needs <c>Subscription:BaseUrl</c> and <c>Services:UserService</c>.
    /// </summary>
    public static IServiceCollection AddLearnerAccessClient(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var subscription = configuration[$"{SubscriptionOptions.SectionName}:BaseUrl"];
        var users = configuration["Services:UserService"];
        if (string.IsNullOrWhiteSpace(subscription) || string.IsNullOrWhiteSpace(users))
        {
            throw new InvalidOperationException(
                "Subscription:BaseUrl and Services:UserService must be configured; student packages depend on them.");
        }

        services.Configure<LearnerAccessOptions>(configuration.GetSection(LearnerAccessOptions.SectionName));
        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddHttpClient(LearnerAccessClient.SubscriptionClientName, client =>
        {
            client.BaseAddress = new Uri(subscription.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddHttpClient(LearnerAccessClient.UserClientName, client =>
        {
            client.BaseAddress = new Uri(users.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(5);
        });
        services.AddSingleton<ILearnerAccessClient, LearnerAccessClient>();

        return services;
    }
}
