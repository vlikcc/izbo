namespace Shared.Models;

public enum ExamStatus
{
    Draft = 0,
    Published = 1,
    InProgress = 2,
    Ended = 3,
    Cancelled = 4
}

public class Exam
{
    public Guid Id { get; set; }
    public Guid ClassroomId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int TotalPoints { get; set; }
    public bool ShuffleQuestions { get; set; } = false;
    public bool ShuffleOptions { get; set; } = false;
    public bool ShowResults { get; set; } = true;
    public int? PassingScore { get; set; }
    public ExamStatus Status { get; set; } = ExamStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual Classroom? Classroom { get; set; }
    public virtual ICollection<Question> Questions { get; set; } = new List<Question>();
    public virtual ICollection<ExamSession> Sessions { get; set; } = new List<ExamSession>();
}

public enum QuestionType
{
    MultipleChoice = 0,
    TrueFalse = 1,
    FillInBlank = 2,
    Matching = 3,
    Essay = 4
}

public class Question
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public int OrderIndex { get; set; }
    public QuestionType Type { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? Options { get; set; } // JSON array for multiple choice
    public string? CorrectAnswer { get; set; } // JSON for complex answers
    public int Points { get; set; } = 1;
    public string? Explanation { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual Exam? Exam { get; set; }
    public virtual ICollection<Answer> Answers { get; set; } = new List<Answer>();
}

public enum ExamSessionStatus
{
    NotStarted = 0,
    InProgress = 1,
    Submitted = 2,
    TimedOut = 3,
    Graded = 4
}

public class ExamSession
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public Guid StudentId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public int? TotalScore { get; set; }
    public decimal? Percentage { get; set; }
    public bool IsPassed { get; set; } = false;
    public ExamSessionStatus Status { get; set; } = ExamSessionStatus.NotStarted;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual Exam? Exam { get; set; }
    public virtual User? Student { get; set; }
    public virtual ICollection<Answer> Answers { get; set; } = new List<Answer>();
}

public class Answer
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public Guid QuestionId { get; set; }
    public string? AnswerContent { get; set; }
    public bool? IsCorrect { get; set; }
    public int? PointsAwarded { get; set; }
    public string? Feedback { get; set; }
    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ExamSession? Session { get; set; }
    public virtual Question? Question { get; set; }
}
