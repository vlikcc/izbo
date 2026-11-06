namespace Shared.Models;

/// <summary>What a homework points students to, besides its own text.</summary>
public enum HomeworkLinkKind
{
    None = 0,

    /// <summary>A lesson in the content catalog (video, PDF…); the target is the content item.</summary>
    ContentItem = 1,

    /// <summary>A generated topic test from the question bank; the target is the topic.</summary>
    TopicTest = 2
}

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

    /// <summary>Optional link to platform content; ids live in ContentService and are not checked here.</summary>
    public HomeworkLinkKind LinkKind { get; set; } = HomeworkLinkKind.None;
    public Guid? LinkTargetId { get; set; }

    /// <summary>The linked lesson or topic's name as it was when assigned, for display.</summary>
    public string? LinkTitle { get; set; }

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
