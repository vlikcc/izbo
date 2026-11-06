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
