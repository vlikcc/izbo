using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.Audit;
using Shared.DTOs;
using Shared.Models;
using Shared.Security;
using System.Security.Cryptography;

namespace AuthService.Services;

public enum NationalIdLoginStatus
{
    Success,

    /// <summary>Not an 11-digit number with valid check digits. Says nothing about accounts.</summary>
    InvalidNumber,

    MissingPassword,

    /// <summary>Unknown number, wrong password, wrong role or disabled account — deliberately indistinguishable.</summary>
    Rejected,

    /// <summary>Too many failures for this number; applies equally to numbers that have no account.</summary>
    LockedOut,

    /// <summary>The lookup/encryption keys are not configured.</summary>
    Unavailable
}

public sealed record NationalIdLoginResult(NationalIdLoginStatus Status, AuthResponse? Auth = null, int RetryAfterSeconds = 0);

public enum NationalIdAssignmentStatus
{
    Updated,
    InvalidNumber,
    UserNotFound,

    /// <summary>Another account already has this number.</summary>
    InUse,
    Unavailable
}

public interface INationalIdAuthService
{
    Task<NationalIdLoginResult> LoginAsync(NationalIdLoginRequest request, ClientFingerprint client, CancellationToken cancellationToken = default);

    /// <summary>Gives an account a T.C. Kimlik No (or replaces it). Called by the school/admin directory.</summary>
    Task<NationalIdAssignmentStatus> AssignAsync(Guid userId, string? nationalId, CancellationToken cancellationToken = default);

    /// <summary>True when the number passes validation under the current configuration.</summary>
    bool IsAcceptable(string nationalId);
}

/// <summary>
/// T.C. Kimlik No + password sign-in for YZ Kampüs, next to the e-mail/user-name login. The number is only
/// ever handled as a keyed hash (lookup) and AES-GCM ciphertext (storage); failures are throttled per number
/// in the database (so every instance sees them) in addition to the per-IP limit on the endpoint.
/// </summary>
public sealed class NationalIdAuthService : INationalIdAuthService
{
    private static readonly string DecoyPasswordHash = BCrypt.Net.BCrypt.HashPassword(
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));

    private readonly AuthDbContext _context;
    private readonly INationalIdProtector _protector;
    private readonly NationalIdOptions _options;
    private readonly IAuthService _auth;
    private readonly IAuditLogger _audit;
    private readonly TimeProvider _time;
    private readonly ILogger<NationalIdAuthService> _logger;

    public NationalIdAuthService(
        AuthDbContext context,
        INationalIdProtector protector,
        IOptions<NationalIdOptions> options,
        IAuthService auth,
        IAuditLogger audit,
        TimeProvider time,
        ILogger<NationalIdAuthService> logger)
    {
        ArgumentNullException.ThrowIfNull(options);
        _context = context;
        _protector = protector;
        _options = options.Value;
        _auth = auth;
        _audit = audit;
        _time = time;
        _logger = logger;
    }

    public bool IsAcceptable(string nationalId) =>
        TurkishNationalId.HasValidChecksum(nationalId)
        || (_options.AllowDemoNumbers && TurkishNationalId.HasValidShape(nationalId));

    public async Task<NationalIdLoginResult> LoginAsync(
        NationalIdLoginRequest request,
        ClientFingerprint client,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!_protector.IsConfigured)
        {
            return new NationalIdLoginResult(NationalIdLoginStatus.Unavailable);
        }

        var number = TurkishNationalId.Normalize(request.NationalId);
        if (!IsAcceptable(number))
        {
            return new NationalIdLoginResult(NationalIdLoginStatus.InvalidNumber);
        }

        if (string.IsNullOrEmpty(request.Password))
        {
            return new NationalIdLoginResult(NationalIdLoginStatus.MissingPassword);
        }

        var hash = _protector.LookupHash(number);
        var now = _time.GetUtcNow().UtcDateTime;

        var lockedUntil = await _context.NationalIdLoginThrottles
            .Where(t => t.LookupHash == hash)
            .Select(t => t.LockedUntil)
            .FirstOrDefaultAsync(cancellationToken);
        if (lockedUntil > now)
        {
            return Locked(lockedUntil.Value, now);
        }

        var user = await _context.NationalIdCredentials
            .Where(c => c.LookupHash == hash)
            .Join(_context.Users, c => c.UserId, u => u.Id, (_, u) => u)
            .AsNoTracking() // always the stored IsActive/role, never a stale tracked copy
            .FirstOrDefaultAsync(cancellationToken);

        // Always run BCrypt: an early return for an unknown number would make response time an oracle.
        var passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? DecoyPasswordHash);

        if (user is null || !passwordMatches || !user.IsActive || user.DeletedAt is not null || !RoleMatches(user.Role, request.Role))
        {
            _logger.LogWarning("Failed T.C. sign-in from {IpAddress}", client?.IpAddress);
            var lockedNow = await RegisterFailureAsync(hash, now, cancellationToken);
            if (user is not null)
            {
                await _audit.WriteAsync(new AuditRecord("LoginFailed", user.Id, "User", user.Id.ToString(), IpAddress: client?.IpAddress), cancellationToken);
            }

            return lockedNow is { } until
                ? Locked(until, now)
                : new NationalIdLoginResult(NationalIdLoginStatus.Rejected);
        }

        await _context.NationalIdLoginThrottles.Where(t => t.LookupHash == hash).ExecuteDeleteAsync(cancellationToken);

        var auth = await _auth.CompleteSignInAsync(user, client ?? ClientFingerprint.Unknown, "NationalId", cancellationToken);
        return new NationalIdLoginResult(NationalIdLoginStatus.Success, auth);
    }

    public async Task<NationalIdAssignmentStatus> AssignAsync(Guid userId, string? nationalId, CancellationToken cancellationToken = default)
    {
        if (!_protector.IsConfigured)
        {
            return NationalIdAssignmentStatus.Unavailable;
        }

        var number = TurkishNationalId.Normalize(nationalId);
        if (!IsAcceptable(number))
        {
            return NationalIdAssignmentStatus.InvalidNumber;
        }

        if (!await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken))
        {
            return NationalIdAssignmentStatus.UserNotFound;
        }

        var hash = _protector.LookupHash(number);
        if (await _context.NationalIdCredentials.AnyAsync(c => c.LookupHash == hash && c.UserId != userId, cancellationToken))
        {
            return NationalIdAssignmentStatus.InUse;
        }

        var now = _time.GetUtcNow().UtcDateTime;
        var credential = await _context.NationalIdCredentials.FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (credential is null)
        {
            credential = new NationalIdCredential { UserId = userId, CreatedAt = now };
            _context.NationalIdCredentials.Add(credential);
        }

        credential.LookupHash = hash;
        credential.Ciphertext = _protector.Encrypt(number);
        credential.UpdatedAt = now;

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Lost a race for the same number.
            return NationalIdAssignmentStatus.InUse;
        }

        await _audit.WriteAsync(new AuditRecord("NationalIdAssigned", userId, "User", userId.ToString()), cancellationToken);
        return NationalIdAssignmentStatus.Updated;
    }

    /// <summary>Counts a failure atomically; returns the lock end when this failure triggered a lockout.</summary>
    private async Task<DateTime?> RegisterFailureAsync(string hash, DateTime now, CancellationToken cancellationToken)
    {
        var windowStart = now.AddMinutes(-Math.Max(1, _options.FailureWindowMinutes));

        var counts = await _context.Database.SqlQuery<int>($"""
            INSERT INTO national_id_login_throttles ("LookupHash", "FailedCount", "LastFailureAt", "LockedUntil")
            VALUES ({hash}, 1, {now}, NULL)
            ON CONFLICT ("LookupHash") DO UPDATE SET
                "FailedCount" = CASE
                    WHEN national_id_login_throttles."LastFailureAt" < {windowStart}
                      OR national_id_login_throttles."LockedUntil" IS NOT NULL THEN 1
                    ELSE national_id_login_throttles."FailedCount" + 1 END,
                "LastFailureAt" = {now},
                "LockedUntil" = NULL
            RETURNING "FailedCount" AS "Value"
            """).ToListAsync(cancellationToken);

        if (counts.Single() < Math.Max(1, _options.MaxFailedAttempts))
        {
            return null;
        }

        var until = now.AddSeconds(Math.Max(1, _options.LockoutSeconds));
        await _context.NationalIdLoginThrottles
            .Where(t => t.LookupHash == hash)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.LockedUntil, until).SetProperty(t => t.FailedCount, 0), cancellationToken);
        _logger.LogWarning("T.C. sign-in locked for {Seconds}s after repeated failures", _options.LockoutSeconds);
        return until;
    }

    private static NationalIdLoginResult Locked(DateTime until, DateTime now) =>
        new(NationalIdLoginStatus.LockedOut, RetryAfterSeconds: Math.Max(1, (int)Math.Ceiling((until - now).TotalSeconds)));

    /// <summary>The prototype's role picker (öğrenci / öğretmen / veli); no role means any.</summary>
    public static bool RoleMatches(UserRole actual, string? requested)
    {
        if (string.IsNullOrWhiteSpace(requested))
        {
            return true;
        }

        UserRole? wanted = requested.Trim().ToLowerInvariant() switch
        {
            "ogrenci" or "öğrenci" or "student" => UserRole.Student,
            "ogretmen" or "öğretmen" or "instructor" => UserRole.Instructor,
            "veli" or "parent" => UserRole.Parent,
            _ => null
        };

        return wanted == actual;
    }
}
