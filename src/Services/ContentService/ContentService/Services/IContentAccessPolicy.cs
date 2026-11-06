using Shared.Authorization;
using Shared.Models;
using Shared.Subscription;

namespace ContentService.Services;

/// <summary>What the current caller may open, resolved once per request.</summary>
public sealed record ContentEntitlement(bool Exempt, LearnerProfile Profile)
{
    /// <summary>Teachers and administrators: they author the catalogue, so nothing is locked for them.</summary>
    public static ContentEntitlement Staff { get; } = new(true, LearnerProfile.Free(-1));

    public bool Has(string feature) => Exempt || Profile.Has(feature);

    /// <summary>-1 when unlimited.</summary>
    public int PracticeTestsPerDay =>
        Exempt || Profile.PracticeTestsPerDay < 0 || Profile.Has(LearnerFeatureCodes.UnlimitedPractice)
            ? -1
            : Profile.PracticeTestsPerDay;

    /// <summary>
    /// Free items are open to everyone. Premium items need a package with premium content, and only at the
    /// student's own levels (grade and exam track) — the package belongs to the student, not to a level.
    /// A student who has not set a grade yet is not held back by level.
    /// </summary>
    public bool CanOpen(ContentAccessTier tier, string? levelSlug) =>
        Exempt
        || tier == ContentAccessTier.Free
        || (Profile.Has(LearnerFeatureCodes.PremiumContent)
            && (Profile.Levels.Count == 0 || levelSlug is null || Profile.Levels.Contains(levelSlug)));

    public bool IsLocked(ContentAccessTier tier, string? levelSlug) => !CanOpen(tier, levelSlug);
}

/// <summary>Decides what a caller may consume: premium content, daily practice tests, premium mock exams.</summary>
public interface IContentAccessPolicy
{
    Task<ContentEntitlement> GetAsync(Caller caller, CancellationToken cancellationToken = default);
}

/// <summary>Everything open. For tests and tools that run without SubscriptionService.</summary>
public sealed class AllowAllContentAccessPolicy : IContentAccessPolicy
{
    public Task<ContentEntitlement> GetAsync(Caller caller, CancellationToken cancellationToken = default) =>
        Task.FromResult(ContentEntitlement.Staff);
}

/// <summary>Student packages from SubscriptionService. Staff are exempt; everyone else gets what their package gives.</summary>
public sealed class PackageContentAccessPolicy : IContentAccessPolicy
{
    private readonly ILearnerAccessClient _learners;
    private ContentEntitlement? _resolved;
    private Guid _resolvedFor;

    public PackageContentAccessPolicy(ILearnerAccessClient learners) => _learners = learners;

    public async Task<ContentEntitlement> GetAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (caller.CanManageContent)
        {
            return ContentEntitlement.Staff;
        }

        if (_resolved is not null && _resolvedFor == caller.UserId)
        {
            return _resolved;
        }

        _resolved = new ContentEntitlement(false, await _learners.GetAsync(caller, cancellationToken));
        _resolvedFor = caller.UserId;
        return _resolved;
    }
}

public static class ContentAccessPolicyExtensions
{
    /// <summary>Throws <see cref="PackageRequiredException"/> (HTTP 402) when the caller may not open a premium item.</summary>
    public static async Task EnsureCanOpenAsync(
        this IContentAccessPolicy policy, Caller caller, ContentAccessTier tier, string? levelSlug, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(policy);

        if (tier == ContentAccessTier.Free)
        {
            return;
        }

        var entitlement = await policy.GetAsync(caller, cancellationToken);
        if (entitlement.CanOpen(tier, levelSlug))
        {
            return;
        }

        throw entitlement.Has(LearnerFeatureCodes.PremiumContent)
            ? new PackageRequiredException(1, PackageRequiredReasons.PremiumContent, "Bu içerik paketinin kapsadığı sınıf düzeyinde değil")
            : new PackageRequiredException(1, PackageRequiredReasons.PremiumContent, "Bu içerik için Temel ya da üstü bir paket gerekiyor");
    }
}
