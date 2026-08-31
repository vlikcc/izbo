using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.DTOs;
using Shared.Email;
using Shared.Messaging;
using Shared.Models;
using Shared.Security;
using Shared.Text;

namespace AuthService.Services;

public interface IAccountEmailService
{
    Task RequestEmailVerificationAsync(User user, CancellationToken cancellationToken = default);
    Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default);
    Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default);
    Task<bool> ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default);
    Task DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default);
}

public sealed class AccountEmailService : IAccountEmailService
{
    private readonly AuthDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IAuditLogger _audit;
    private readonly ILogger<AccountEmailService> _logger;

    public AccountEmailService(
        AuthDbContext context,
        IConfiguration configuration,
        IAuditLogger audit,
        ILogger<AccountEmailService> logger)
    {
        _context = context;
        _configuration = configuration;
        _audit = audit;
        _logger = logger;
    }

    public async Task RequestEmailVerificationAsync(User user, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(user);
        var token = await IssueTokenAsync(user.Id, "verify", cancellationToken);
        var link = $"{FrontendBase()}/verify-email?token={Uri.EscapeDataString(token)}";
        await EnqueueEmailAsync(
            user.Email,
            "E-posta adresinizi doğrulayın",
            $"Hesabınızı doğrulamak için bu bağlantıyı açın:\n{link}",
            cancellationToken);
    }

    public async Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken = default)
    {
        var hash = HashToken(token);
        var row = await _context.EmailVerificationTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.ExpiresAt > DateTime.UtcNow, cancellationToken);
        if (row is null)
        {
            return false;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == row.UserId, cancellationToken);
        if (user is null)
        {
            return false;
        }

        user.EmailVerified = true;
        user.EmailVerifiedAt = DateTime.UtcNow;
        _context.EmailVerificationTokens.Remove(row);
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("EmailVerified", user.Id, "User", user.Id.ToString()), cancellationToken);
        return true;
    }

    public async Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = EmailNormalizer.Normalize(email);
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalized && u.IsActive, cancellationToken);
        if (user is null)
        {
            _logger.LogInformation("Password reset requested for an unknown address");
            return;
        }

        var token = await IssuePasswordResetAsync(user.Id, cancellationToken);
        var link = $"{FrontendBase()}/reset-password?token={Uri.EscapeDataString(token)}";
        await EnqueueEmailAsync(
            user.Email,
            "Parola sıfırlama",
            $"Parolanızı sıfırlamak için bu bağlantıyı açın:\n{link}",
            cancellationToken);
        await _audit.WriteAsync(new AuditRecord("PasswordResetRequested", user.Id, "User", user.Id.ToString()), cancellationToken);
    }

    public async Task<bool> ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default)
    {
        if (PasswordPolicy.Validate(password) is not null)
        {
            return false;
        }

        var hash = HashToken(token);
        var row = await _context.PasswordResetTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow, cancellationToken);
        if (row is null)
        {
            return false;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == row.UserId, cancellationToken);
        if (user is null)
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        row.UsedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("PasswordReset", user.Id, "User", user.Id.ToString()), cancellationToken);
        return true;
    }

    public async Task DeleteAccountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return;
        }

        user.IsActive = false;
        user.DeletedAt = DateTime.UtcNow;
        user.Email = $"deleted-{user.Id:N}@invalid.local";
        user.FirstName = "Silinmiş";
        user.LastName = "Kullanıcı";
        user.PhoneNumber = null;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));

        var tokens = await _context.RefreshTokens.Where(t => t.UserId == userId && !t.IsRevoked).ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.Revoke(RevocationReasons.AccountDeleted);
        }

        await _context.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("AccountDeleted", userId, "User", userId.ToString()), cancellationToken);
    }

    private async Task<string> IssueTokenAsync(Guid userId, string purpose, CancellationToken cancellationToken)
    {
        var value = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        _context.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = HashToken(value),
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        });
        await _context.SaveChangesAsync(cancellationToken);
        _ = purpose;
        return value;
    }

    private async Task<string> IssuePasswordResetAsync(Guid userId, CancellationToken cancellationToken)
    {
        var value = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = HashToken(value),
            ExpiresAt = DateTime.UtcNow.AddHours(2)
        });
        await _context.SaveChangesAsync(cancellationToken);
        return value;
    }

    private async Task EnqueueEmailAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new EmailMessage(to, subject, body));
        _context.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = OutboxMessageTypes.Email,
            Payload = payload,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);
    }

    private string FrontendBase() => (_configuration["Frontend:Url"] ?? "http://localhost:3000").TrimEnd('/');

    private static string HashToken(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
