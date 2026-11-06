using Shared.Authorization;
using Shared.Models;

namespace ContentService.Services;

/// <summary>
/// Decides whether a caller may consume a published item. Premium content is only flagged for now; the
/// package/entitlement check lands with payments (Faz 3) behind this same interface.
/// </summary>
public interface IContentAccessPolicy
{
    Task<bool> CanConsumeAsync(Caller caller, ContentItem item, CancellationToken cancellationToken = default);
}

public sealed class AllowAllContentAccessPolicy : IContentAccessPolicy
{
    public Task<bool> CanConsumeAsync(Caller caller, ContentItem item, CancellationToken cancellationToken = default) =>
        Task.FromResult(true);
}
