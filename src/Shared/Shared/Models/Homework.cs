namespace Shared.Models;

public class Homework
{
    public Guid Id { get; set; }
    public Guid ClassroomId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public int MaxScore { get; set; } = 100;
    public DateTime DueDate { get; set; }
    public bool AllowLateSubmission { get; set; } = false;
    public int LatePenaltyPercent { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual Classroom? Classroom { get; set; }
    public virtual ICollection<HomeworkSubmission> Submissions { get; set; } = new List<HomeworkSubmission>();
}

public enum SubmissionStatus
{
    Pending = 0,
    Submitted = 1,
    Late = 2,
    Graded = 3
}

public class HomeworkSubmission
{
    public Guid Id { get; set; }
    public Guid HomeworkId { get; set; }
    public Guid StudentId { get; set; }
    public string? Content { get; set; }
    public string? FileUrl { get; set; }
    public int? Score { get; set; }
    public string? Feedback { get; set; }
    public SubmissionStatus Status { get; set; } = SubmissionStatus.Pending;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? GradedAt { get; set; }
    public Guid? GradedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual Homework? Homework { get; set; }
    public virtual User? Student { get; set; }
}
