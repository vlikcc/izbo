using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace AuthService.Services;

public sealed class NationalIdOptions
{
    public const string SectionName = "NationalId";

    /// <summary>Base64 of at least 32 random bytes. Keys the lookup HMAC; rotating it orphans every stored number.</summary>
    public string? LookupKey { get; set; }

    /// <summary>Base64 of exactly 32 random bytes (AES-256-GCM).</summary>
    public string? EncryptionKey { get; set; }

    /// <summary>Consecutive failed sign-ins for one number before it is locked.</summary>
    public int MaxFailedAttempts { get; set; } = 5;

    /// <summary>How long a locked number stays locked.</summary>
    public int LockoutSeconds { get; set; } = 300;

    /// <summary>Failures older than this no longer count towards a lockout.</summary>
    public int FailureWindowMinutes { get; set; } = 60;

    /// <summary>
    /// Accepts numbers that fail the checksum (the prototype's <c>12345678910</c>). Development only: a real
    /// T.C. Kimlik No always passes the checksum.
    /// </summary>
    public bool AllowDemoNumbers { get; set; }
}

/// <summary>Keyed hashing and encryption for T.C. Kimlik numbers.</summary>
public interface INationalIdProtector
{
    /// <summary>False when the keys are not configured; T.C. sign-in is then unavailable.</summary>
    bool IsConfigured { get; }

    string LookupHash(string nationalId);

    string Encrypt(string nationalId);

    string Decrypt(string ciphertext);
}

public sealed class NationalIdProtector : INationalIdProtector
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[]? _lookupKey;
    private readonly byte[]? _encryptionKey;

    public NationalIdProtector(IOptions<NationalIdOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _lookupKey = Decode(options.Value.LookupKey, minLength: 32);
        _encryptionKey = Decode(options.Value.EncryptionKey, minLength: 32);
        if (_encryptionKey is { Length: not 32 })
        {
            _encryptionKey = null;
        }
    }

    public bool IsConfigured => _lookupKey is not null && _encryptionKey is not null;

    public string LookupHash(string nationalId) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(LookupKeyOrThrow(), Encoding.ASCII.GetBytes(nationalId)));

    public string Encrypt(string nationalId)
    {
        var plain = Encoding.ASCII.GetBytes(nationalId);
        var buffer = new byte[NonceSize + TagSize + plain.Length];
        var nonce = buffer.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(EncryptionKeyOrThrow(), TagSize);
        aes.Encrypt(nonce, plain, buffer.AsSpan(NonceSize + TagSize), buffer.AsSpan(NonceSize, TagSize));
        return Convert.ToBase64String(buffer);
    }

    public string Decrypt(string ciphertext)
    {
        var buffer = Convert.FromBase64String(ciphertext);
        var plain = new byte[buffer.Length - NonceSize - TagSize];

        using var aes = new AesGcm(EncryptionKeyOrThrow(), TagSize);
        aes.Decrypt(buffer.AsSpan(0, NonceSize), buffer.AsSpan(NonceSize + TagSize), buffer.AsSpan(NonceSize, TagSize), plain);
        return Encoding.ASCII.GetString(plain);
    }

    private byte[] LookupKeyOrThrow() =>
        _lookupKey ?? throw new InvalidOperationException("NationalId:LookupKey is not configured.");

    private byte[] EncryptionKeyOrThrow() =>
        _encryptionKey ?? throw new InvalidOperationException("NationalId:EncryptionKey is not configured.");

    private static byte[]? Decode(string? base64, int minLength)
    {
        if (string.IsNullOrWhiteSpace(base64))
        {
            return null;
        }

        try
        {
            var bytes = Convert.FromBase64String(base64);
            return bytes.Length >= minLength ? bytes : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
