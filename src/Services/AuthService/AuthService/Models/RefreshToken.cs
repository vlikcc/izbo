using Shared.Models;

namespace AuthService.Models;

/// <summary>
/// One issued refresh token.
///
/// Only a hash of the token value is stored: a refresh token is a bearer credential, so a leaked database
/// dump must not contain anything that can be replayed. Rotation is recorded through
/// <see cref="ReplacedByTokenId"/>, which lets a replayed token be traced to the chain it came from.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>SHA-256 of the token value, hex encoded. The value itself is never persisted.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }

    /// <summary>Why the token was revoked, so a reuse-triggered mass revocation is distinguishable in audit.</summary>
    public string? RevokedReason { get; set; }

    /// <summary>The token issued in its place when it was rotated.</summary>
    public Guid? ReplacedByTokenId { get; set; }

    public virtual User? User { get; set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;

    public void Revoke(string reason)
    {
        if (IsRevoked)
        {
            return;
        }

        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        RevokedReason = reason;
    }
}

/// <summary>Reasons recorded on <see cref="RefreshToken.RevokedReason"/>.</summary>
public static class RevocationReasons
{
    public const string Rotated = "rotated";
    public const string LoggedOut = "logged-out";
    public const string RevokedByUser = "revoked-by-user";

    /// <summary>An already-rotated token was presented again, so the whole chain is assumed compromised.</summary>
    public const string ReuseDetected = "reuse-detected";
}
