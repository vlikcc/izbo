namespace AuthService.Models;

/// <summary>
/// An account's T.C. Kimlik No. The number itself is special-category personal data (KVKK), so it is
/// never stored in the clear: <see cref="LookupHash"/> is a keyed HMAC used to find the account at sign-in,
/// <see cref="Ciphertext"/> is the AES-GCM encrypted number for the rare case it must be shown again.
/// Kept apart from <c>users</c> so the shared <c>User</c> model (mapped by other services) stays unchanged.
/// </summary>
public class NationalIdCredential
{
    public Guid UserId { get; set; }

    /// <summary>Hex HMAC-SHA256 of the number under <c>NationalId:LookupKey</c>. Unique.</summary>
    public string LookupHash { get; set; } = string.Empty;

    /// <summary>Base64 of nonce ‖ tag ‖ ciphertext under <c>NationalId:EncryptionKey</c>.</summary>
    public string Ciphertext { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Failed T.C. sign-ins, counted per number whether or not an account has it, so the lockout itself
/// cannot be used to learn which numbers are registered.
/// </summary>
public class NationalIdLoginThrottle
{
    public string LookupHash { get; set; } = string.Empty;
    public int FailedCount { get; set; }
    public DateTime LastFailureAt { get; set; }
    public DateTime? LockedUntil { get; set; }
}
