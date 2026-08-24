using Shared.Audit;
using Shared.Models;
using AuthService.Services;

namespace EduPlatform.IntegrationTests;

internal sealed class NullAuditLogger : IAuditLogger
{
    public Task WriteAsync(AuditRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

internal sealed class NullAccountEmailService : IAccountEmailService
{
    public Task RequestEmailVerificationAsync(User user, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default) => Task.FromResult(true);

    public Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<bool> ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default) => Task.FromResult(true);

    public Task DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
