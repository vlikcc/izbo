namespace Shared.DTOs;

// Auth DTOs
public record RegisterRequest(string Email, string Password, string FirstName, string LastName, string? PhoneNumber, string? Role = null);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, string RefreshToken, UserDto User, DateTime ExpiresAt);
public record RefreshTokenRequest(string RefreshToken);

// User DTOs
public record UserDto(Guid Id, string Email, string FirstName, string LastName, string Role, string? PhoneNumber, string? ProfileImageUrl, bool IsActive, DateTime CreatedAt);

/// <summary>
/// The subset of a profile any authenticated user may see. Contact details (e-mail, phone) are omitted:
/// other users need a display name and avatar to render rosters, not a way to harvest addresses.
/// </summary>
public record PublicUserDto(Guid Id, string FirstName, string LastName, string Role, string? ProfileImageUrl);
public record UpdateUserRequest(string? FirstName, string? LastName, string? PhoneNumber, string? ProfileImageUrl);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateRoleRequest(string Role);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string Password);
public record VerifyEmailRequest(string Token);
