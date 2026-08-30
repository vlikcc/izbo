using Microsoft.EntityFrameworkCore;
using Shared.Models;
using SubscriptionService.Data;

namespace SubscriptionService.Services;

public record SubscriberRef(SubscriberType Type, Guid Id);

/// <summary>Resolves which subscriber (an Organization or the User themselves) a given user's
/// entitlements should come from. If the user belongs to an organization that itself has a
/// subscription, the organization's plan wins over the user's own personal plan.</summary>
public interface ISubscriberResolver
{
    Task<SubscriberRef> ResolveAsync(Guid userId);
}

public class SubscriberResolver : ISubscriberResolver
{
    private readonly SubscriptionDbContext _context;

    public SubscriberResolver(SubscriptionDbContext context)
    {
        _context = context;
    }

    public async Task<SubscriberRef> ResolveAsync(Guid userId)
    {
        var orgId = await _context.OrganizationMembers
            .Where(m => m.UserId == userId)
            .Join(_context.Subscriptions,
                m => m.OrganizationId,
                s => s.SubscriberId,
                (m, s) => new { m.OrganizationId, s.SubscriberType })
            .Where(x => x.SubscriberType == SubscriberType.Organization)
            .Select(x => (Guid?)x.OrganizationId)
            .FirstOrDefaultAsync();

        if (orgId.HasValue)
            return new SubscriberRef(SubscriberType.Organization, orgId.Value);

        return new SubscriberRef(SubscriberType.User, userId);
    }
}
