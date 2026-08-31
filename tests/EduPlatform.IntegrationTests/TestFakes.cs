using Shared.Audit;
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
