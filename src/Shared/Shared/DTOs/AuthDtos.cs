namespace Shared.DTOs;

// Auth DTOs
public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string? Role = null,
    int? GradeLevel = null,
    string? ExamTarget = null);

/// <summary>Signs in with either an e-mail address or, for child accounts, a user name.</summary>
public record LoginRequest(string? Email, string Password, string? Username = null);
public record AuthResponse(string AccessToken, string RefreshToken, UserDto User, DateTime ExpiresAt);
public record RefreshTokenRequest(string RefreshToken);

// User DTOs
public record UserDto(
    Guid Id,
    string? Email,
    string FirstName,
    string LastName,
    string Role,
    string? PhoneNumber,
    string? ProfileImageUrl,
    bool IsActive,
    DateTime CreatedAt,
    string? Username = null,
    int? GradeLevel = null,
    string? ExamTarget = null);

/// <summary>
/// The subset of a profile any authenticated user may see. Contact details (e-mail, phone) are omitted:
/// other users need a display name and avatar to render rosters, not a way to harvest addresses.
/// </summary>
public record PublicUserDto(Guid Id, string FirstName, string LastName, string Role, string? ProfileImageUrl);
public record UpdateUserRequest(
    string? FirstName,
    string? LastName,
    string? PhoneNumber,
    string? ProfileImageUrl,
    int? GradeLevel = null,
    string? ExamTarget = null);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateRoleRequest(string Role);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string Password);
public record VerifyEmailRequest(string Token);

// Guardian (veli) DTOs
public record ChildDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? Username,
    string? Email,
    int? GradeLevel,
    string? ExamTarget,
    string? ProfileImageUrl,
    DateTime LinkedAt);

/// <summary>A parent opening an account for a child who signs in with a user name.</summary>
public record CreateChildRequest(
    string FirstName,
    string LastName,
    string Username,
    string Password,
    int GradeLevel,
    string? ExamTarget = null);

public record LinkChildRequest(string Code);
public record ResetChildPasswordRequest(string Password);
public record GuardianCodeDto(string Code, DateTime ExpiresAt);
public record GuardianshipDto(Guid StudentId, bool IsGuardian);
