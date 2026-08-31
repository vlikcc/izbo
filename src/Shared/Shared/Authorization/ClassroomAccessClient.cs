using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using Shared.DTOs;
using System.Net;
using System.Net.Http.Json;

namespace Shared.Authorization;

/// <summary>
/// Asks ClassroomService whether the caller is the owning instructor of, or enrolled in, a classroom.
///
/// The caller's own bearer token is forwarded rather than a service credential, so this client can
/// never resolve more access than the user already has. Results are cached briefly because a single
/// request may check the same classroom several times.
/// </summary>
public sealed class ClassroomAccessClient : IClassroomAccessClient
{
    public const string HttpClientName = "classroom-access";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);

    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ClassroomAccessClient> _logger;

    public ClassroomAccessClient(
        HttpClient httpClient,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache cache,
        ILogger<ClassroomAccessClient> logger)
    {
        _httpClient = httpClient;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _logger = logger;
    }

    public Task<ClassroomAccess> GetAccessAsync(
        Guid classroomId,
        Caller caller,
        CancellationToken cancellationToken = default) =>
        GetAccessAsync(
            $"api/classrooms/{classroomId}/my-access",
            nameof(GetAccessAsync),
            classroomId,
            caller,
            authorizationHeader: null,
            cancellationToken);

    public Task<ClassroomAccess> GetSessionAccessAsync(
        Guid sessionId,
        Caller caller,
        string? authorizationHeader = null,
        CancellationToken cancellationToken = default) =>
        GetAccessAsync(
            $"api/classrooms/sessions/{sessionId}/my-access",
            nameof(GetSessionAccessAsync),
            sessionId,
            caller,
            authorizationHeader,
            cancellationToken);

    public async Task<bool> CanViewAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await GetAccessAsync(classroomId, caller, cancellationToken);
        return access.CanView;
    }

    public async Task<bool> CanManageAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await GetAccessAsync(classroomId, caller, cancellationToken);
        return access.IsInstructor;
    }

    public async Task<IReadOnlyCollection<Guid>?> GetAccessibleClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (caller.IsPlatformAdmin)
        {
            return null;
        }

        var cacheKey = (nameof(GetAccessibleClassroomIdsAsync), caller.UserId);
        if (_cache.TryGetValue(cacheKey, out IReadOnlyCollection<Guid>? cached) && cached is not null)
        {
            return cached;
        }

        var result = await GetAsync<List<Guid>>("api/classrooms/my-classroom-ids", authorizationHeader: null, cancellationToken);

        if (result.Outcome != LookupOutcome.Success || result.Value is null)
        {
            // An empty scope is the fail-closed answer: list queries return nothing rather than everything.
            return Array.Empty<Guid>();
        }

        _cache.Set(cacheKey, result.Value, CacheDuration);
        return result.Value;
    }

    private async Task<ClassroomAccess> GetAccessAsync(
        string relativeUrl,
        string cacheScope,
        Guid resourceId,
        Caller caller,
        string? authorizationHeader,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        // Administrators are unconditionally allowed, so skip the round trip entirely.
        if (caller.IsPlatformAdmin)
        {
            return new ClassroomAccess(IsInstructor: true, IsEnrolled: true);
        }

        var cacheKey = (cacheScope, caller.UserId, resourceId);
        if (_cache.TryGetValue(cacheKey, out ClassroomAccess? cached) && cached is not null)
        {
            return cached;
        }

        var result = await GetAsync<ClassroomAccess>(relativeUrl, authorizationHeader, cancellationToken);

        // Denied and unreachable are both answered as "no access", but only a definitive answer is
        // cached; a transport failure must be retried rather than remembered.
        if (result.Outcome == LookupOutcome.Success && result.Value is not null)
        {
            _cache.Set(cacheKey, result.Value, CacheDuration);
            return result.Value;
        }

        if (result.Outcome == LookupOutcome.Denied)
        {
            _cache.Set(cacheKey, ClassroomAccess.None, CacheDuration);
        }

        return ClassroomAccess.None;
    }

    private async Task<LookupResult<T>> GetAsync<T>(
        string relativeUrl,
        string? authorizationHeader,
        CancellationToken cancellationToken)
        where T : class
    {
        var authorization = authorizationHeader
            ?? _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();

        if (string.IsNullOrWhiteSpace(authorization))
        {
            _logger.LogWarning(
                "Cannot call {RelativeUrl}: no Authorization header is available for the current caller", relativeUrl);
            return LookupResult<T>.Unavailable;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
        request.Headers.TryAddWithoutValidation(HeaderNames.Authorization, authorization);

        try
        {
            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
            {
                return LookupResult<T>.Denied;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Call to {RelativeUrl} failed with status {StatusCode}", relativeUrl, (int)response.StatusCode);
                return LookupResult<T>.Unavailable;
            }

            var payload = await response.Content.ReadFromJsonAsync<ApiResponse<T>>(cancellationToken);
            return payload?.Data is { } value
                ? new LookupResult<T>(LookupOutcome.Success, value)
                : LookupResult<T>.Unavailable;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Call to {RelativeUrl} could not be completed", relativeUrl);
            return LookupResult<T>.Unavailable;
        }
    }

    private enum LookupOutcome
    {
        /// <summary>ClassroomService answered.</summary>
        Success,

        /// <summary>ClassroomService answered that the caller has no access, or the classroom is gone.</summary>
        Denied,

        /// <summary>No answer could be obtained. Treated as no access, but never cached.</summary>
        Unavailable
    }

    private readonly record struct LookupResult<T>(LookupOutcome Outcome, T? Value)
        where T : class
    {
        internal static LookupResult<T> Denied => new(LookupOutcome.Denied, null);

        internal static LookupResult<T> Unavailable => new(LookupOutcome.Unavailable, null);
    }
}
