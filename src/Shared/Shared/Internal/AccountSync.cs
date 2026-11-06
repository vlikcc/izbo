using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;

namespace Shared.Internal;

/// <summary>Profile fields UserService needs to mirror an AuthService account.</summary>
public record AccountProfileSync(
    Guid Id,
    string? Email,
    string FirstName,
    string LastName,
    string Role,
    string? PhoneNumber,
    bool IsActive,
    string? Username = null,
    int? GradeLevel = null,
    string? ExamTarget = null);

public record AccountActiveRequest(bool IsActive);

public record AccountRoleRequest(string Role);

public record AccountPasswordRequest(string Password);

/// <summary>A student account opened by a parent. It has no e-mail address and signs in by user name.</summary>
public record CreateChildAccountRequest(
    string FirstName,
    string LastName,
    string Username,
    string Password,
    int GradeLevel,
    string? ExamTarget);

public record CreatedAccountDto(Guid Id, string Username);

public enum CreateChildAccountStatus
{
    Created,
    UsernameTaken,
    Failed
}

public sealed record CreateChildAccountResult(CreateChildAccountStatus Status, Guid? AccountId = null);

/// <summary>
/// Identity fields AuthService owns and re-mirrors into UserService on login. A profile edit that
/// writes only the directory is overwritten at the next sign-in unless this is pushed back.
/// </summary>
public record AccountIdentityRequest(string FirstName, string LastName, string? PhoneNumber, string? ProfileImageUrl);

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

    /// <summary>
    /// Pushes a directory profile edit onto the account that issues tokens. Returns false when
    /// AuthService could not be reached; callers should still keep the directory write.
    /// </summary>
    Task<bool> UpdateIdentityAsync(Guid userId, AccountIdentityRequest identity, CancellationToken cancellationToken = default);

    /// <summary>
    /// Applies an admin role change to the account that issues tokens. Without it the directory shows the new
    /// role while every token keeps carrying the old one. A false result is a failed operation.
    /// </summary>
    Task<bool> SetRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default);

    /// <summary>Sets a new password (a parent resetting a child account). A false result is a failed operation.</summary>
    Task<bool> SetPasswordAsync(Guid userId, string password, CancellationToken cancellationToken = default);

    /// <summary>Opens a user-name account for a child on AuthService.</summary>
    Task<CreateChildAccountResult> CreateChildAccountAsync(CreateChildAccountRequest request, CancellationToken cancellationToken = default);
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

    public async Task<bool> UpdateIdentityAsync(
        Guid userId,
        AccountIdentityRequest identity,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(identity);

        if (_http.BaseAddress is null)
        {
            _logger.LogError("AuthService base address is not configured; identity for {UserId} not applied", userId);
            return false;
        }

        try
        {
            var response = await _http.PutAsJsonAsync(
                $"api/internal/accounts/{userId}/identity", identity, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            _logger.LogError(
                "Applying identity for {UserId} on AuthService failed with {StatusCode}", userId, response.StatusCode);
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Applying identity for {UserId} on AuthService failed", userId);
            return false;
        }
    }

    public Task<bool> SetRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default) =>
        SendAsync(
            client => client.PutAsJsonAsync($"api/internal/accounts/{userId}/role", new AccountRoleRequest(role), cancellationToken),
            "role", userId);

    public Task<bool> SetPasswordAsync(Guid userId, string password, CancellationToken cancellationToken = default) =>
        SendAsync(
            client => client.PostAsJsonAsync($"api/internal/accounts/{userId}/password", new AccountPasswordRequest(password), cancellationToken),
            "password", userId);

    public async Task<CreateChildAccountResult> CreateChildAccountAsync(
        CreateChildAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (_http.BaseAddress is null)
        {
            _logger.LogError("AuthService base address is not configured; child account not created");
            return new CreateChildAccountResult(CreateChildAccountStatus.Failed);
        }

        try
        {
            var response = await _http.PostAsJsonAsync("api/internal/accounts", request, cancellationToken);

            if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
            {
                return new CreateChildAccountResult(CreateChildAccountStatus.UsernameTaken);
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Creating a child account on AuthService failed with {StatusCode}", response.StatusCode);
                return new CreateChildAccountResult(CreateChildAccountStatus.Failed);
            }

            var created = await response.Content.ReadFromJsonAsync<CreatedAccountDto>(cancellationToken);
            return created is null
                ? new CreateChildAccountResult(CreateChildAccountStatus.Failed)
                : new CreateChildAccountResult(CreateChildAccountStatus.Created, created.Id);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            _logger.LogError(ex, "Creating a child account on AuthService failed");
            return new CreateChildAccountResult(CreateChildAccountStatus.Failed);
        }
    }

    private async Task<bool> SendAsync(
        Func<HttpClient, Task<HttpResponseMessage>> send,
        string what,
        Guid userId)
    {
        if (_http.BaseAddress is null)
        {
            _logger.LogError("AuthService base address is not configured; {What} for {UserId} not applied", what, userId);
            return false;
        }

        try
        {
            using var response = await send(_http);
            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            _logger.LogError(
                "Applying {What} for {UserId} on AuthService failed with {StatusCode}", what, userId, response.StatusCode);
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Applying {What} for {UserId} on AuthService failed", what, userId);
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
