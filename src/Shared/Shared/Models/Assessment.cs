namespace Shared.Models;

// The question bank owned by ContentService. Questions hang off the curriculum (a Topic, optionally one
// LearningOutcome) so results can be reported per outcome and matched to the content that teaches it.
// Named BankQuestion because Shared.Models.Question is the classroom exam's own question.

public enum BankQuestionType
{
    /// <summary>Two to five options keyed A–E, exactly one correct.</summary>
    MultipleChoice = 0,

    /// <summary>Stored as two fixed options: A = Doğru, B = Yanlış.</summary>
    TrueFalse = 1
}

public enum QuestionDifficulty
{
    Easy = 1,
    Medium = 2,
    Hard = 3
}

/// <summary>One answer option. Text may contain <c>$...$</c> LaTeX; an image is optional.</summary>
public sealed record BankQuestionOption(string Key, string Text, Guid? AssetId = null);

public class BankQuestion
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public Guid? LearningOutcomeId { get; set; }
    public BankQuestionType Type { get; set; }

    /// <summary>The question text; <c>$...$</c> and <c>$$...$$</c> spans are LaTeX.</summary>
    public string Stem { get; set; } = string.Empty;

    public Guid? StemAssetId { get; set; }
    public List<BankQuestionOption> Options { get; set; } = new();

    /// <summary>Key of the correct option, e.g. <c>C</c>.</summary>
    public string CorrectKey { get; set; } = string.Empty;

    public QuestionDifficulty Difficulty { get; set; } = QuestionDifficulty.Medium;
    public string Explanation { get; set; } = string.Empty;

    /// <summary>A <see cref="ContentItemType.SolvedQuestionVideo"/> that walks through the solution.</summary>
    public Guid? SolutionVideoItemId { get; set; }

    public Guid OwnerId { get; set; }
    public ContentOwnerKind OwnerKind { get; set; }
    public ContentStatus Status { get; set; } = ContentStatus.Draft;
    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? PublishedAt { get; set; }

    public virtual Topic? Topic { get; set; }
    public virtual LearningOutcome? LearningOutcome { get; set; }
    public virtual ContentItem? SolutionVideo { get; set; }
}

/// <summary>
/// An image used in a question or option. Served without authentication by its random id, because an
/// <c>&lt;img&gt;</c> tag cannot send a bearer token; the id is never derived from anything guessable.
/// </summary>
public class QuestionAsset
{
    public Guid Id { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// ---- Tests and results ----

public enum AssessmentKind
{
    /// <summary>A scheduled mock exam (deneme): one window for everyone, ranked when it closes.</summary>
    MockExam = 0,

    /// <summary>A placement test (seviye belirleme): taken once, any time, never ranked.</summary>
    Placement = 1
}

/// <summary>How wrong answers count against right ones.</summary>
public enum ScoringRule
{
    /// <summary>Wrong answers cost nothing (school tests).</summary>
    Plain = 0,

    /// <summary>LGS: three wrong answers cancel one right answer.</summary>
    NetThird = 1,

    /// <summary>YKS: four wrong answers cancel one right answer.</summary>
    NetQuarter = 2
}

public enum AssessmentStatus
{
    Draft = 0,
    Published = 1
}

public enum AttemptScope
{
    /// <summary>A generated topic test (kazanım testi).</summary>
    Topic = 0,

    /// <summary>A generated unit test.</summary>
    Unit = 1,

    /// <summary>A curated <see cref="Assessment"/>.</summary>
    Assessment = 2
}

public enum AttemptStatus
{
    InProgress = 0,
    Submitted = 1,

    /// <summary>Closed by the server when its time ran out; graded with what was saved.</summary>
    Expired = 2
}

/// <summary>A curated test an administrator assembles from the bank: a mock exam or a placement test.</summary>
public class Assessment
{
    public Guid Id { get; set; }
    public AssessmentKind Kind { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid LevelId { get; set; }
    public int DurationMinutes { get; set; }
    public ScoringRule ScoringRule { get; set; }

    /// <summary>Required for mock exams: attempts started inside the window are ranked.</summary>
    public DateTime? WindowStart { get; set; }

    public DateTime? WindowEnd { get; set; }
    public ContentAccessTier AccessTier { get; set; } = ContentAccessTier.Free;
    public AssessmentStatus Status { get; set; } = AssessmentStatus.Draft;

    /// <summary>When ranks were computed after the window closed.</summary>
    public DateTime? RankedAt { get; set; }

    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }

    public virtual Level? Level { get; set; }
    public virtual ICollection<AssessmentSection> Sections { get; set; } = new List<AssessmentSection>();
    public virtual ICollection<AssessmentQuestion> Questions { get; set; } = new List<AssessmentQuestion>();
}

/// <summary>A part of an assessment, usually one subject ("Türkçe", "Matematik"); nets are reported per section.</summary>
public class AssessmentSection
{
    public Guid Id { get; set; }
    public Guid AssessmentId { get; set; }
    public Guid? SubjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Order { get; set; }

    public virtual Assessment? Assessment { get; set; }
    public virtual Subject? Subject { get; set; }
}

public class AssessmentQuestion
{
    public Guid AssessmentId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid SectionId { get; set; }
    public int Order { get; set; }

    public virtual Assessment? Assessment { get; set; }
    public virtual AssessmentSection? Section { get; set; }
    public virtual BankQuestion? Question { get; set; }
}

/// <summary>One student's sitting of a test. Results live here so later question edits never change them.</summary>
public class Attempt
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AttemptScope Scope { get; set; }
    public Guid? TopicId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AssessmentId { get; set; }

    /// <summary>Shown in lists, e.g. "Bölme — konu testi".</summary>
    public string Title { get; set; } = string.Empty;

    public ScoringRule ScoringRule { get; set; }
    public DateTime StartedAt { get; set; }

    /// <summary>Answers are refused after this (plus a short grace for network latency).</summary>
    public DateTime Deadline { get; set; }

    public DateTime? SubmittedAt { get; set; }
    public AttemptStatus Status { get; set; } = AttemptStatus.InProgress;
    public int Correct { get; set; }
    public int Wrong { get; set; }
    public int Blank { get; set; }
    public decimal Net { get; set; }
    public decimal Percent { get; set; }

    /// <summary>Started inside a mock exam's window, so it takes part in the ranking.</summary>
    public bool IsRanked { get; set; }

    public int? Rank { get; set; }
    public int? ParticipantCount { get; set; }

    /// <summary>Share of participants at or above this score, e.g. 2.5 means "ilk %2,5".</summary>
    public decimal? TopPercent { get; set; }

    public virtual Assessment? Assessment { get; set; }
    public virtual ICollection<AttemptItem> Items { get; set; } = new List<AttemptItem>();
}

/// <summary>One question inside an attempt, with a snapshot of its key and curriculum place.</summary>
public class AttemptItem
{
    public Guid AttemptId { get; set; }
    public int Order { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? SectionId { get; set; }
    public Guid TopicId { get; set; }
    public Guid? LearningOutcomeId { get; set; }
    public int OptionCount { get; set; }
    public string CorrectKey { get; set; } = string.Empty;
    public string? SelectedKey { get; set; }
    public bool? IsCorrect { get; set; }
    public DateTime? AnsweredAt { get; set; }

    public virtual Attempt? Attempt { get; set; }
    public virtual BankQuestion? Question { get; set; }
}
