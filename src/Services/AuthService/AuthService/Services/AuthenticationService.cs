using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Shared.DTOs;
using Shared.Models;
using Shared.Security;
using Shared.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace AuthService.Services;

/// <summary>Where a request came from, recorded against issued refresh tokens.</summary>
public sealed record ClientFingerprint(string? IpAddress, string? UserAgent)
{
    public static readonly ClientFingerprint Unknown = new(null, null);
}

/// <summary>
/// The outcome of a registration attempt. Whether the address was already taken is deliberately something
/// the caller can act on but must not reveal to the client.
/// </summary>
public enum RegistrationOutcome
{
    Created,

    /// <summary>The address is already registered. Answered to the client exactly like <see cref="Created"/>.</summary>
    AlreadyRegistered,

    /// <summary>The password does not meet the policy. Safe to report, as it says nothing about the address.</summary>
    PasswordRejected
}

public sealed record RegistrationResult(RegistrationOutcome Outcome, string? Error = null);

public interface IAuthService
{
    Task<RegistrationResult> RegisterAsync(RegisterRequest request, ClientFingerprint client, CancellationToken cancellationToken = default);
    Task<AuthResponse?> LoginAsync(LoginRequest request, ClientFingerprint client, CancellationToken cancellationToken = default);
    Task<AuthResponse?> RefreshTokenAsync(string refreshToken, ClientFingerprint client, CancellationToken cancellationToken = default);
    Task<bool> LogoutAsync(Guid userId, string refreshToken, CancellationToken cancellationToken = default);
    Task<bool> RevokeAllTokensAsync(Guid userId, CancellationToken cancellationToken = default);
}

public class AuthenticationService : IAuthService
{
    /// <summary>
    /// A BCrypt hash of a value nobody knows, verified against when no user matches. Skipping the
    /// verification would make a non-existent address answer measurably faster than a wrong password.
    /// </summary>
    private static readonly string DecoyPasswordHash = BCrypt.Net.BCrypt.HashPassword(
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));

    private readonly AuthDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthenticationService> _logger;

    public AuthenticationService(
        AuthDbContext context,
        IConfiguration configuration,
        ILogger<AuthenticationService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<RegistrationResult> RegisterAsync(
        RegisterRequest request,
        ClientFingerprint client,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        // Checked before the address is looked up, so a weak password fails identically whether or not the
        // address is taken.
        if (PasswordPolicy.Validate(request.Password) is { } passwordError)
        {
            return new RegistrationResult(RegistrationOutcome.PasswordRejected, passwordError);
        }

        var email = EmailNormalizer.Normalize(request.Email);

        if (await _context.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            // Spend the same work a real registration would, then report the same thing to the client.
            BCrypt.Net.BCrypt.HashPassword(request.Password);
            _logger.LogInformation("Registration attempted for an address that already exists");
            return new RegistrationResult(RegistrationOutcome.AlreadyRegistered);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhoneNumber = request.PhoneNumber,
            Role = RequestedRole(request.Role),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User {UserId} registered", user.Id);

        return new RegistrationResult(RegistrationOutcome.Created);
    }

    public async Task<AuthResponse?> LoginAsync(
        LoginRequest request,
        ClientFingerprint client,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var email = EmailNormalizer.Normalize(request.Email);
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        // Always verify against something: returning early for an unknown address turns response time
        // into an oracle for which addresses are registered.
        var passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? DecoyPasswordHash);

        if (user == null || !passwordMatches)
        {
            _logger.LogWarning("Failed login attempt from {IpAddress}", client?.IpAddress);
            return null;
        }

        if (!user.IsActive)
        {
            _logger.LogWarning("Login rejected: user {UserId} is deactivated", user.Id);
            return null;
        }

        _logger.LogInformation("User {UserId} logged in", user.Id);

        return await IssueTokensAsync(user, client, cancellationToken);
    }

    public async Task<AuthResponse?> RefreshTokenAsync(
        string refreshToken,
        ClientFingerprint client,
        CancellationToken cancellationToken = default)
    {
        var hash = HashToken(refreshToken);

        var token = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash, cancellationToken);

        if (token == null)
        {
            _logger.LogWarning("Refresh rejected: unknown token presented from {IpAddress}", client?.IpAddress);
            return null;
        }

        // A token that has already been rotated must never appear again. Either it leaked, or the chain
        // has been cloned; in both cases every token the user holds is suspect, so all of them go.
        if (token.IsRevoked)
        {
            _logger.LogError(
                "Refresh token reuse detected for user {UserId} from {IpAddress}; revoking every session",
                token.UserId, client?.IpAddress);

            await RevokeAllTokensAsync(token.UserId, RevocationReasons.ReuseDetected, cancellationToken);
            return null;
        }

        if (token.IsExpired || token.User == null || !token.User.IsActive)
        {
            _logger.LogWarning("Refresh rejected for user {UserId}: token expired or account unusable", token.UserId);
            return null;
        }

        var replacement = BuildRefreshToken(token.UserId, client);

        token.Revoke(RevocationReasons.Rotated);
        token.ReplacedByTokenId = replacement.Token.Id;

        _context.RefreshTokens.Add(replacement.Token);
        await _context.SaveChangesAsync(cancellationToken);

        return BuildAuthResponse(token.User, replacement.Value);
    }

    public async Task<bool> LogoutAsync(Guid userId, string refreshToken, CancellationToken cancellationToken = default)
    {
        var hash = HashToken(refreshToken);

        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash && rt.UserId == userId, cancellationToken);

        if (token == null)
            return false;

        token.Revoke(RevocationReasons.LoggedOut);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public Task<bool> RevokeAllTokensAsync(Guid userId, CancellationToken cancellationToken = default) =>
        RevokeAllTokensAsync(userId, RevocationReasons.RevokedByUser, cancellationToken);

    private async Task<bool> RevokeAllTokensAsync(Guid userId, string reason, CancellationToken cancellationToken)
    {
        var tokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync(cancellationToken);

        foreach (var token in tokens)
        {
            token.Revoke(reason);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>Registration may only ask for a teaching or learning role; elevation is an admin action.</summary>
    private static UserRole RequestedRole(string? requested) =>
        Enum.TryParse<UserRole>(requested, ignoreCase: true, out var role) &&
        role is UserRole.Student or UserRole.Instructor
            ? role
            : UserRole.Student;

    private async Task<AuthResponse> IssueTokensAsync(User user, ClientFingerprint? client, CancellationToken cancellationToken)
    {
        var refreshToken = BuildRefreshToken(user.Id, client);

        _context.RefreshTokens.Add(refreshToken.Token);
        await _context.SaveChangesAsync(cancellationToken);

        return BuildAuthResponse(user, refreshToken.Value);
    }

    private AuthResponse BuildAuthResponse(User user, string refreshTokenValue)
    {
        var lifetime = AccessTokenLifetime();

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Role.ToString(),
            user.PhoneNumber,
            user.ProfileImageUrl,
            user.IsActive,
            user.CreatedAt);

        return new AuthResponse(
            GenerateAccessToken(user, lifetime),
            refreshTokenValue,
            userDto,
            DateTime.UtcNow.Add(lifetime));
    }

    private (RefreshToken Token, string Value) BuildRefreshToken(Guid userId, ClientFingerprint? client)
    {
        // 256 bits from a cryptographic source: the value is the entire credential.
        var value = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = HashToken(value),
            ExpiresAt = DateTime.UtcNow.Add(RefreshTokenLifetime()),
            CreatedAt = DateTime.UtcNow,
            IpAddress = client?.IpAddress,
            UserAgent = Truncate(client?.UserAgent, 256)
        };

        return (token, value);
    }

    private string GenerateAccessToken(User user, TimeSpan lifetime)
    {
        var jwtSettings = _configuration.GetSection("JWT");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("firstName", user.FirstName),
            new Claim("lastName", user.LastName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.Add(lifetime),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Access tokens are not revocable, so their lifetime is the window in which a stolen one still works.
    /// Refresh rotation makes a short lifetime cheap.
    /// </summary>
    private TimeSpan AccessTokenLifetime() => TimeSpan.FromMinutes(
        _configuration.GetValue<double?>("JWT:AccessTokenExpirationMinutes") ?? 15);

    private TimeSpan RefreshTokenLifetime() => TimeSpan.FromDays(
        _configuration.GetValue<double?>("JWT:RefreshTokenExpirationDays") ?? 7);

    private static string HashToken(string? token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? string.Empty)));

    private static string? Truncate(string? value, int maxLength) =>
        value is null || value.Length <= maxLength ? value : value[..maxLength];
}
