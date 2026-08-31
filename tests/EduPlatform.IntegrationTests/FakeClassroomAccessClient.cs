using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace EduPlatform.IntegrationTests;

internal sealed class FakeClassroomAccessClient : IClassroomAccessClient
{
    public HashSet<Guid> Viewable { get; } = [];
    public HashSet<Guid> Manageable { get; } = [];

    public Task<ClassroomAccess> GetAccessAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var manage = caller.IsPlatformAdmin || Manageable.Contains(classroomId);
        var view = manage || caller.IsPlatformAdmin || Viewable.Contains(classroomId);
        return Task.FromResult(new ClassroomAccess(manage, view));
    }

    public Task<ClassroomAccess> GetSessionAccessAsync(
        Guid sessionId,
        Caller caller,
        string? authorizationHeader = null,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new ClassroomAccess(false, false));

    public async Task<bool> CanViewAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default) =>
        (await GetAccessAsync(classroomId, caller, cancellationToken)).CanView;

    public async Task<bool> CanManageAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default) =>
        (await GetAccessAsync(classroomId, caller, cancellationToken)).IsInstructor;

    public Task<IReadOnlyCollection<Guid>?> GetAccessibleClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        if (caller.IsPlatformAdmin)
        {
            return Task.FromResult<IReadOnlyCollection<Guid>?>(null);
        }

        return Task.FromResult<IReadOnlyCollection<Guid>?>(Viewable.Union(Manageable).ToList());
    }
}
