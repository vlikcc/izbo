using Shared.Audit;
using Shared.Internal;
using Shared.Models;
using Shared.Subscription;
using AuthService.Services;

namespace EduPlatform.IntegrationTests;

internal sealed class NullAuditLogger : IAuditLogger
{
    public Task WriteAsync(AuditRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

/// <summary>Never enforces a limit — ownership tests exercise access control, not billing.</summary>
internal sealed class NoopQuotaGuard : IQuotaGuard
{
    public Task EnsureFeatureAsync(string featureCode, CancellationToken ct = default) => Task.CompletedTask;

    public Task TryConsumeAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default) => Task.CompletedTask;

    public Task ReleaseAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default) => Task.CompletedTask;

    public Task<long> GetLimitAsync(QuotaMetric metric, CancellationToken ct = default) => Task.FromResult(-1L);
}

internal sealed class NullAccountEmailService : IAccountEmailService
{
    public Task RequestEmailVerificationAsync(User user, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default) => Task.FromResult(true);

    public Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<bool> ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default) => Task.FromResult(true);

    public Task DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

/// <summary>Records what was mirrored so tests can assert the account/profile sync happened.</summary>
internal sealed class RecordingAccountDirectoryClient : IAccountDirectoryClient
{
    public List<AccountProfileSync> Mirrored { get; } = [];

    public bool Available { get; set; } = true;

    public Task<bool> EnsureProfileAsync(AccountProfileSync profile, CancellationToken cancellationToken = default)
    {
        if (Available)
        {
            Mirrored.Add(profile);
        }

        return Task.FromResult(Available);
    }
}

/// <summary>Stands in for AuthService when testing the admin activation toggle.</summary>
internal sealed class RecordingAccountStateClient : IAccountStateClient
{
    public List<(Guid UserId, bool IsActive)> Applied { get; } = [];

    public List<(Guid UserId, AccountIdentityRequest Identity)> Identities { get; } = [];

    /// <summary>Set false to simulate AuthService being unreachable.</summary>
    public bool Available { get; set; } = true;

    public Task<bool> SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default)
    {
        if (Available)
        {
            Applied.Add((userId, isActive));
        }

        return Task.FromResult(Available);
    }

    public Task<bool> UpdateIdentityAsync(Guid userId, AccountIdentityRequest identity, CancellationToken cancellationToken = default)
    {
        if (Available)
        {
            Identities.Add((userId, identity));
        }

        return Task.FromResult(Available);
    }

    public List<(Guid UserId, string Role)> Roles { get; } = [];

    public List<(Guid UserId, string Password)> Passwords { get; } = [];

    public List<CreateChildAccountRequest> CreatedChildren { get; } = [];

    /// <summary>User names AuthService would report as taken.</summary>
    public HashSet<string> TakenUsernames { get; } = new(StringComparer.Ordinal);

    public Task<bool> SetRoleAsync(Guid userId, string role, CancellationToken cancellationToken = default)
    {
        if (Available)
        {
            Roles.Add((userId, role));
        }

        return Task.FromResult(Available);
    }

    public Task<bool> SetPasswordAsync(Guid userId, string password, CancellationToken cancellationToken = default)
    {
        if (Available)
        {
            Passwords.Add((userId, password));
        }

        return Task.FromResult(Available);
    }

    public Task<CreateChildAccountResult> CreateChildAccountAsync(
        CreateChildAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!Available)
        {
            return Task.FromResult(new CreateChildAccountResult(CreateChildAccountStatus.Failed));
        }

        if (!TakenUsernames.Add(request.Username))
        {
            return Task.FromResult(new CreateChildAccountResult(CreateChildAccountStatus.UsernameTaken));
        }

        CreatedChildren.Add(request);
        return Task.FromResult(new CreateChildAccountResult(CreateChildAccountStatus.Created, Guid.NewGuid()));
    }
}
