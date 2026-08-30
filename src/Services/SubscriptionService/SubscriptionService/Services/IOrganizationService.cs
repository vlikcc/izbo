using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using SubscriptionService.Configuration;
using SubscriptionService.Data;

namespace SubscriptionService.Services;

public class OrganizationNotFoundException : Exception
{
    public OrganizationNotFoundException() : base("Kurum bulunamadı.") { }
}

public class NotOrganizationAdminException : Exception
{
    public NotOrganizationAdminException() : base("Bu işlem için kurum yöneticisi olmanız gerekir.") { }
}

public class SeatLimitExceededException : Exception
{
    public long Limit { get; }
    public SeatLimitExceededException(long limit) : base("Koltuk kotanız doldu.") { Limit = limit; }
}

public interface IOrganizationService
{
    Task<OrganizationDto> CreateAsync(Guid ownerUserId, CreateOrganizationRequest request);
    Task<OrganizationDto?> GetMyOrganizationAsync(Guid userId);
    Task<OrganizationMemberDto> AddMemberAsync(Guid organizationId, Guid requestingUserId, AddOrganizationMemberRequest request);
    Task RemoveMemberAsync(Guid organizationId, Guid requestingUserId, Guid memberUserId);
}

public class OrganizationService : IOrganizationService
{
    private readonly SubscriptionDbContext _context;
    private readonly TrialOptions _trialOptions;

    public OrganizationService(SubscriptionDbContext context, IOptions<TrialOptions> trialOptions)
    {
        _context = context;
        _trialOptions = trialOptions.Value;
    }

    public async Task<OrganizationDto> CreateAsync(Guid ownerUserId, CreateOrganizationRequest request)
    {
        var slug = await GenerateUniqueSlugAsync(request.Name);

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Slug = slug,
            OwnerUserId = ownerUserId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.Organizations.Add(org);

        var ownerMember = new OrganizationMember
        {
            Id = Guid.NewGuid(),
            OrganizationId = org.Id,
            UserId = ownerUserId,
            OrgRole = OrgRole.Owner,
            JoinedAt = DateTime.UtcNow
        };
        _context.OrganizationMembers.Add(ownerMember);

        // Give every new organization a trial of the institution plan so the owner can explore
        // before paying — consistent with the individual "Free plan + 14-day trial" policy.
        var institutionPlan = await _context.Plans.Include(p => p.Limits)
            .FirstAsync(p => p.Code == "institution");
        var seatCount = institutionPlan.Limits.FirstOrDefault(l => l.Metric == QuotaMetric.Seats)?.Value ?? 1;

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            SubscriberType = SubscriberType.Organization,
            SubscriberId = org.Id,
            PlanId = institutionPlan.Id,
            Status = SubscriptionStatus.Trialing,
            CurrentPeriodStart = DateTime.UtcNow,
            CurrentPeriodEnd = DateTime.UtcNow.AddMonths(1),
            TrialEndsAt = DateTime.UtcNow.AddDays(_trialOptions.DurationDays),
            TrialUsedAt = DateTime.UtcNow,
            SeatCount = (int)Math.Max(1, seatCount),
            CreatedAt = DateTime.UtcNow
        };
        _context.Subscriptions.Add(subscription);

        _context.SubscriptionEvents.Add(new SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            SubscriberType = SubscriberType.Organization,
            SubscriberId = org.Id,
            Type = "OrganizationCreated",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return ToDto(org);
    }

    public async Task<OrganizationDto?> GetMyOrganizationAsync(Guid userId)
    {
        var membership = await _context.OrganizationMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.UserId == userId);
        if (membership == null) return null;

        var org = await _context.Organizations.Include(o => o.Members).AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == membership.OrganizationId);

        return org == null ? null : ToDto(org);
    }

    public async Task<OrganizationMemberDto> AddMemberAsync(Guid organizationId, Guid requestingUserId, AddOrganizationMemberRequest request)
    {
        await EnsureOrgAdminAsync(organizationId, requestingUserId);

        var sub = await _context.Subscriptions
            .FirstOrDefaultAsync(s => s.SubscriberType == SubscriberType.Organization && s.SubscriberId == organizationId);
        var plan = sub == null ? null : await _context.Plans.Include(p => p.Limits)
            .FirstOrDefaultAsync(p => p.Id == sub.PlanId);
        var seatLimit = plan?.Limits.FirstOrDefault(l => l.Metric == QuotaMetric.Seats)?.Value
            ?? sub?.SeatCount ?? 1;

        var currentMembers = await _context.OrganizationMembers.CountAsync(m => m.OrganizationId == organizationId);
        if (seatLimit >= 0 && currentMembers >= seatLimit)
            throw new SeatLimitExceededException(seatLimit);

        var alreadyMember = await _context.OrganizationMembers
            .AnyAsync(m => m.OrganizationId == organizationId && m.UserId == request.UserId);
        if (alreadyMember)
            throw new InvalidOperationException("Kullanıcı zaten bu kurumun üyesi.");

        var member = new OrganizationMember
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            UserId = request.UserId,
            OrgRole = request.OrgRole,
            JoinedAt = DateTime.UtcNow
        };
        _context.OrganizationMembers.Add(member);
        await _context.SaveChangesAsync();

        return new OrganizationMemberDto(member.Id, member.UserId, member.OrgRole, member.JoinedAt);
    }

    public async Task RemoveMemberAsync(Guid organizationId, Guid requestingUserId, Guid memberUserId)
    {
        await EnsureOrgAdminAsync(organizationId, requestingUserId);

        var member = await _context.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == memberUserId);
        if (member == null) return;

        if (member.OrgRole == OrgRole.Owner)
            throw new InvalidOperationException("Kurum sahibi çıkarılamaz.");

        _context.OrganizationMembers.Remove(member);
        await _context.SaveChangesAsync();
    }

    private async Task EnsureOrgAdminAsync(Guid organizationId, Guid requestingUserId)
    {
        var org = await _context.Organizations.FindAsync(organizationId) ?? throw new OrganizationNotFoundException();
        if (org.OwnerUserId == requestingUserId) return;

        var membership = await _context.OrganizationMembers.FirstOrDefaultAsync(m =>
            m.OrganizationId == organizationId && m.UserId == requestingUserId);
        if (membership == null || membership.OrgRole == OrgRole.Member)
            throw new NotOrganizationAdminException();
    }

    private async Task<string> GenerateUniqueSlugAsync(string name)
    {
        var baseSlug = new string(name.ToLowerInvariant()
                .Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u').Replace('ş', 's').Replace('ö', 'o').Replace('ç', 'c')
                .Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray())
            .Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "kurum";

        var slug = baseSlug;
        var suffix = 1;
        while (await _context.Organizations.AnyAsync(o => o.Slug == slug))
        {
            slug = $"{baseSlug}-{++suffix}";
        }
        return slug;
    }

    private static OrganizationDto ToDto(Organization org) => new(
        org.Id, org.Name, org.Slug, org.OwnerUserId,
        org.Members.Select(m => new OrganizationMemberDto(m.Id, m.UserId, m.OrgRole, m.JoinedAt)).ToList());
}
