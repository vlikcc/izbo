using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using Shared.DTOs;
using System.Net;
using System.Net.Http.Json;

namespace Shared.Authorization;

/// <summary>
/// Answers whether the caller may follow a given student: the student themself, an administrator, or a
/// parent linked to that student in UserService.
/// </summary>
public interface IGuardianAccessClient
{
    Task<bool> CanViewStudentAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default);
}

/// <summary>
/// Asks UserService about guardian links, forwarding the caller's own bearer token so this client can never
/// resolve more access than the user already has. Fails closed; only definitive answers are cached.
/// </summary>
public sealed class GuardianAccessClient : IGuardianAccessClient
{
    public const string HttpClientName = "guardian-access";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);

    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GuardianAccessClient> _logger;

    public GuardianAccessClient(
        HttpClient httpClient,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache cache,
        ILogger<GuardianAccessClient> logger)
    {
        _httpClient = httpClient;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _logger = logger;
    }

    public async Task<bool> CanViewStudentAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (caller.CanActFor(studentId))
        {
            return true;
        }

        if (!caller.IsParent)
        {
            return false;
        }

        var cacheKey = (nameof(GuardianAccessClient), caller.UserId, studentId);
        if (_cache.TryGetValue(cacheKey, out bool cached))
        {
            return cached;
        }

        var authorization = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization))
        {
            _logger.LogWarning("Cannot check guardianship: no Authorization header is available for the current caller");
            return false;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/users/guardianship/{studentId}");
        request.Headers.TryAddWithoutValidation(HeaderNames.Authorization, authorization);

        try
        {
            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
            {
                _cache.Set(cacheKey, false, CacheDuration);
                return false;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Guardianship check failed with status {StatusCode}", (int)response.StatusCode);
                return false;
            }

            var payload = await response.Content.ReadFromJsonAsync<ApiResponse<GuardianshipDto>>(cancellationToken);
            if (payload?.Data is not { } answer)
            {
                return false;
            }

            _cache.Set(cacheKey, answer.IsGuardian, CacheDuration);
            return answer.IsGuardian;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Guardianship check could not be completed");
            return false;
        }
    }
}
