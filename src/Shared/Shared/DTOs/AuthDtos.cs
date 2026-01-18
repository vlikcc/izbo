namespace Shared.DTOs;

// Auth DTOs
public record RegisterRequest(string Email, string Password, string FirstName, string LastName, string? PhoneNumber, string? Role = null);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, string RefreshToken, UserDto User, DateTime ExpiresAt);
public record RefreshTokenRequest(string RefreshToken);

// User DTOs
public record UserDto(Guid Id, string Email, string FirstName, string LastName, string Role, string? PhoneNumber, string? ProfileImageUrl, bool IsActive, DateTime CreatedAt);
public record UpdateUserRequest(string? FirstName, string? LastName, string? PhoneNumber, string? ProfileImageUrl);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateRoleRequest(string Role);
