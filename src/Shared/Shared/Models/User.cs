namespace Shared.Models;

public enum UserRole
{
    Student = 0,
    Instructor = 1,
    Admin = 2,
    SuperAdmin = 3,

    /// <summary>A parent or guardian. Follows linked students' progress; does not take lessons.</summary>
    Parent = 4
}

/// <summary>The central exam a student is preparing for, if any.</summary>
public enum ExamTarget
{
    None = 0,

    /// <summary>Liselere Geçiş Sistemi (8. sınıf).</summary>
    Lgs = 1,

    /// <summary>Yükseköğretim Kurumları Sınavı (lise).</summary>
    Yks = 2
}

public class User
{
    public Guid Id { get; set; }

    /// <summary>
    /// Null only for accounts a parent opened for a child who has no address; those sign in with
    /// <see cref="Username"/> instead.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>Sign-in name for accounts without an e-mail address. Lower case, unique when set.</summary>
    public string? Username { get; set; }

    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Student;
    public string? PhoneNumber { get; set; }
    public string? ProfileImageUrl { get; set; }

    /// <summary>School grade, 1–12. Meaningful for students only.</summary>
    public int? GradeLevel { get; set; }

    public ExamTarget? ExamTarget { get; set; }

    public bool IsActive { get; set; } = true;
    public bool EmailVerified { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {LastName}";

    /// <summary>What to show where an account is identified to people: the address, or the user name.</summary>
    public string LoginName => Email ?? Username ?? string.Empty;
}

/// <summary>A parent's right to follow a student's progress.</summary>
public class GuardianLink
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// A one-time code a student hands to a parent so the parent can link to an existing account. Only the
/// hash is stored: the code is a credential for seeing the student's data.
/// </summary>
public class GuardianLinkCode
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
