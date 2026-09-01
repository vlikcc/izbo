using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;

namespace Shared.Internal;

/// <summary>Profile fields UserService needs to mirror an AuthService account.</summary>
public record AccountProfileSync(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    string? PhoneNumber,
    bool IsActive);

public record AccountActiveRequest(bool IsActive);

/// <summary>
/// Used by AuthService to give UserService a profile row carrying the same id as the account. Without
/// it the two services hold unrelated records for the same person and the admin directory shows only
/// whoever was seeded.
/// </summary>
public interface IAccountDirectoryClient
{
    /// <summary>Idempotent. Returns false when the profile could not be written.</summary>
    Task<bool> EnsureProfileAsync(AccountProfileSync profile, CancellationToken cancellationToken = default);
}

/// <summary>
/// Used by UserService to push an account enable/disable to AuthService, which is what actually gates
/// login. Callers must treat a false result as a failed operation, never as a no-op.
/// </summary>
public interface IAccountStateClient
{
    Task<bool> SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default);
}

internal sealed class AccountDirectoryClient : IAccountDirectoryClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AccountDirectoryClient> _logger;

    public AccountDirectoryClient(HttpClient http, ILogger<AccountDirectoryClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<bool> EnsureProfileAsync(AccountProfileSync profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);

        if (_http.BaseAddress is null)
        {
            _logger.LogWarning("UserService base address is not configured; profile {UserId} not mirrored", profile.Id);
            return false;
        }

        try
        {
            var response = await _http.PostAsJsonAsync("api/internal/users", profile, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            _logger.LogWarning(
                "Mirroring profile {UserId} to UserService failed with {StatusCode}", profile.Id, response.StatusCode);
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Mirroring profile {UserId} to UserService failed", profile.Id);
            return false;
        }
    }
}

internal sealed class AccountStateClient : IAccountStateClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AccountStateClient> _logger;

    public AccountStateClient(HttpClient http, ILogger<AccountStateClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<bool> SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default)
    {
        if (_http.BaseAddress is null)
        {
            _logger.LogError("AuthService base address is not configured; account {UserId} state not applied", userId);
            return false;
        }

        try
        {
            var response = await _http.PostAsJsonAsync(
                $"api/internal/accounts/{userId}/active", new AccountActiveRequest(isActive), cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            _logger.LogError(
                "Applying account state for {UserId} on AuthService failed with {StatusCode}", userId, response.StatusCode);
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Applying account state for {UserId} on AuthService failed", userId);
            return false;
        }
    }
}

public static class InternalServiceExtensions
{
    /// <summary>Binds <see cref="InternalApiOptions"/> so <see cref="InternalOnlyAttribute"/> can read the key.</summary>
    public static IServiceCollection AddInternalApi(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.Configure<InternalApiOptions>(configuration.GetSection(InternalApiOptions.SectionName));
        return services;
    }

    /// <summary>Registers the client AuthService uses to mirror profiles into UserService.</summary>
    public static IServiceCollection AddAccountDirectoryClient(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.AddInternalApi(configuration);

        var options = configuration.GetSection(InternalApiOptions.SectionName).Get<InternalApiOptions>()
            ?? new InternalApiOptions();

        services.AddHttpClient<IAccountDirectoryClient, AccountDirectoryClient>(client =>
        {
            Configure(client, options.UserServiceUrl, options.ApiKey);
        });

        return services;
    }

    /// <summary>Registers the client UserService uses to apply account state on AuthService.</summary>
    public static IServiceCollection AddAccountStateClient(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.AddInternalApi(configuration);

        var options = configuration.GetSection(InternalApiOptions.SectionName).Get<InternalApiOptions>()
            ?? new InternalApiOptions();

        services.AddHttpClient<IAccountStateClient, AccountStateClient>(client =>
        {
            Configure(client, options.AuthServiceUrl, options.ApiKey);
        });

        return services;
    }

    private static void Configure(HttpClient client, string? baseUrl, string? apiKey)
    {
        if (!string.IsNullOrWhiteSpace(baseUrl))
        {
            client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        }

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            client.DefaultRequestHeaders.Add(InternalApiOptions.HeaderName, apiKey);
        }

        client.Timeout = TimeSpan.FromSeconds(10);
    }
}
