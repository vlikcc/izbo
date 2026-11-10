using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Net.Http.Headers;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Subscription;

namespace ContentService.Kampus.Services;

public sealed record RosterStudent(Guid StudentId, string Name);

/// <summary>
/// Who may see what in YZ Kampüs, resolved against the services that own the relationships: classrooms and
/// enrollments (ClassroomService), guardian links and grades (UserService). Everything fails closed.
/// </summary>
public interface IKampusDirectory
{
    /// <summary>The calling student's grade (1–12), or null when it cannot be resolved.</summary>
    Task<int?> GetOwnGradeAsync(Caller student, CancellationToken cancellationToken = default);

    /// <summary>Classrooms the calling student is enrolled in (or the calling teacher teaches).</summary>
    Task<IReadOnlyCollection<Guid>> GetOwnClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Owning teacher or administrator.</summary>
    Task<bool> CanManageClassroomAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Active students of a classroom the caller manages; null when the caller may not see it.</summary>
    Task<IReadOnlyList<RosterStudent>?> GetRosterAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>The student, an administrator, a linked parent, or a teacher of one of the student's classrooms.</summary>
    Task<bool> CanViewStudentAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>Classrooms of a student, as seen by someone allowed to follow them.</summary>
    Task<IReadOnlyCollection<Guid>> GetStudentClassroomIdsAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default);
}

public sealed class KampusDirectory : IKampusDirectory
{
    public const string ClassroomClientName = "kampus-classrooms";

    private readonly IClassroomAccessClient _classrooms;
    private readonly IGuardianAccessClient _guardians;
    private readonly ILearnerAccessClient _learners;
    private readonly IHttpClientFactory _http;
    private readonly IHttpContextAccessor _httpContext;
    private readonly IMemoryCache _cache;
    private readonly ILogger<KampusDirectory> _logger;

    public KampusDirectory(
        IClassroomAccessClient classrooms,
        IGuardianAccessClient guardians,
        ILearnerAccessClient learners,
        IHttpClientFactory http,
        IHttpContextAccessor httpContext,
        IMemoryCache cache,
        ILogger<KampusDirectory> logger)
    {
        _classrooms = classrooms;
        _guardians = guardians;
        _learners = learners;
        _http = http;
        _httpContext = httpContext;
        _cache = cache;
        _logger = logger;
    }

    public async Task<int?> GetOwnGradeAsync(Caller student, CancellationToken cancellationToken = default)
    {
        var profile = await _learners.GetAsync(student, cancellationToken);
        foreach (var level in profile.Levels)
        {
            if (level.EndsWith("-sinif", StringComparison.Ordinal) && int.TryParse(level[..^"-sinif".Length], out var grade))
            {
                return grade;
            }
        }

        return null;
    }

    public async Task<IReadOnlyCollection<Guid>> GetOwnClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default) =>
        await _classrooms.GetAccessibleClassroomIdsAsync(caller, cancellationToken) ?? [];

    public Task<bool> CanManageClassroomAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default) =>
        _classrooms.CanManageAsync(classroomId, caller, cancellationToken);

    public async Task<IReadOnlyList<RosterStudent>?> GetRosterAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        if (!await _classrooms.CanManageAsync(classroomId, caller, cancellationToken))
        {
            return null;
        }

        var cacheKey = (nameof(KampusDirectory), classroomId);
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<RosterStudent>? cached) && cached is not null)
        {
            return cached;
        }

        var authorization = _httpContext.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization))
        {
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/classrooms/{classroomId}/enrollments");
        request.Headers.TryAddWithoutValidation(HeaderNames.Authorization, authorization);
        try
        {
            using var response = await _http.CreateClient(ClassroomClientName).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Roster lookup failed with status {StatusCode}", (int)response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<EnrollmentDto>>>(cancellationToken);
            var roster = (body?.Data ?? [])
                .Where(e => e.IsActive)
                .Select(e => new RosterStudent(e.StudentId, e.StudentName))
                .ToList();
            _cache.Set(cacheKey, (IReadOnlyList<RosterStudent>)roster, TimeSpan.FromSeconds(30));
            return roster;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException
                                   && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Roster lookup could not be completed");
            return null;
        }
    }

    public async Task<bool> CanViewStudentAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);
        if (caller.CanActFor(studentId))
        {
            return true;
        }

        if (caller.IsParent)
        {
            return await _guardians.CanViewStudentAsync(studentId, caller, cancellationToken);
        }

        if (!caller.IsInstructor)
        {
            return false;
        }

        foreach (var classroomId in await GetOwnClassroomIdsAsync(caller, cancellationToken))
        {
            var roster = await GetRosterAsync(classroomId, caller, cancellationToken);
            if (roster?.Any(s => s.StudentId == studentId) == true)
            {
                return true;
            }
        }

        return false;
    }

    public async Task<IReadOnlyCollection<Guid>> GetStudentClassroomIdsAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default)
    {
        if (caller.Is(studentId))
        {
            return await GetOwnClassroomIdsAsync(caller, cancellationToken);
        }

        if (caller.IsInstructor)
        {
            var mine = new List<Guid>();
            foreach (var classroomId in await GetOwnClassroomIdsAsync(caller, cancellationToken))
            {
                var roster = await GetRosterAsync(classroomId, caller, cancellationToken);
                if (roster?.Any(s => s.StudentId == studentId) == true)
                {
                    mine.Add(classroomId);
                }
            }

            return mine;
        }

        return await _classrooms.GetStudentClassroomIdsAsync(studentId, cancellationToken);
    }
}
