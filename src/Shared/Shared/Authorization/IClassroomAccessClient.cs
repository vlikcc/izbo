namespace Shared.Authorization;

/// <summary>
/// Resolves the current caller's relationship to a classroom owned by ClassroomService.
/// </summary>
public interface IClassroomAccessClient
{
    /// <summary>
    /// Returns the caller's access to <paramref name="classroomId"/>. Denies access when the lookup
    /// cannot be completed, so an outage never widens permissions.
    /// </summary>
    Task<ClassroomAccess> GetAccessAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the caller's access to the classroom that owns a live session. Live sessions have no
    /// membership of their own: whoever may view the classroom may attend its sessions.
    /// </summary>
    /// <param name="authorizationHeader">
    /// The caller's <c>Authorization</c> header to forward. Pass <c>null</c> from an MVC action to reuse
    /// the ambient request; SignalR hub invocations have no ambient request and must supply the header
    /// captured when the connection was established.
    /// </param>
    Task<ClassroomAccess> GetSessionAccessAsync(
        Guid sessionId,
        Caller caller,
        string? authorizationHeader = null,
        CancellationToken cancellationToken = default);

    /// <summary>True when the caller may read classroom content (instructor, enrolled student, or admin).</summary>
    Task<bool> CanViewAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>True when the caller may create or modify classroom content (owning instructor or admin).</summary>
    Task<bool> CanManageAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Every classroom the caller teaches or is enrolled in, used to scope unfiltered list queries.
    /// Returns <c>null</c> for administrators, who are not restricted to a subset.
    /// </summary>
    Task<IReadOnlyCollection<Guid>?> GetAccessibleClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default);
}
