namespace Shared.Models;

public class Classroom
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid InstructorId { get; set; }
    public string? CoverImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public virtual User? Instructor { get; set; }
    public virtual ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public virtual ICollection<ClassSession> Sessions { get; set; } = new List<ClassSession>();
}

public class Enrollment
{
    public Guid Id { get; set; }
    public Guid ClassroomId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public virtual Classroom? Classroom { get; set; }
    public virtual User? Student { get; set; }
}

public enum SessionStatus
{
    Scheduled = 0,
    Live = 1,
    Ended = 2,
    Cancelled = 3
}

public class ClassSession
{
    public Guid Id { get; set; }
    public Guid ClassroomId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime ScheduledStartTime { get; set; }
    public DateTime ScheduledEndTime { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string? MeetingUrl { get; set; }
    public string? RecordingUrl { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Scheduled;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual Classroom? Classroom { get; set; }
}
