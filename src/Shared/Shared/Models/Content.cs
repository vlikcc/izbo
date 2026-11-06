namespace Shared.Models;

// Curriculum-based content catalog owned by ContentService. The hierarchy is
// Level → Subject → CurriculumUnit → Topic → LearningOutcome, and every ContentItem hangs off a Topic.

public enum LevelKind
{
    /// <summary>A school year, 1. sınıf to 12. sınıf.</summary>
    Grade = 0,

    /// <summary>A national exam track such as LGS or YKS-TYT.</summary>
    ExamPrep = 1
}

public enum ContentItemType
{
    Video = 0,
    SolvedQuestionVideo = 1,
    Pdf = 2,
    Worksheet = 3,
    EBook = 4,
    Embed = 5
}

public enum ContentAccessTier
{
    Free = 0,
    Premium = 1
}

public enum ContentStatus
{
    Draft = 0,
    InReview = 1,
    Published = 2,
    Rejected = 3
}

public enum ContentOwnerKind
{
    /// <summary>Produced by the platform's own editors (administrators).</summary>
    Platform = 0,

    /// <summary>Produced by a teacher; must pass administrator review before publication.</summary>
    Teacher = 1
}

public enum ContentProcessingStatus
{
    /// <summary>Nothing has been uploaded yet.</summary>
    None = 0,

    /// <summary>A video is waiting for the transcode worker.</summary>
    Queued = 1,

    Processing = 2,

    /// <summary>The media is servable: an HLS ladder for videos, the stored file for documents.</summary>
    Ready = 3,

    Failed = 4
}

public class Level
{
    public Guid Id { get; set; }

    /// <summary>URL identifier, e.g. <c>5-sinif</c>, <c>lgs</c>, <c>yks-tyt</c>.</summary>
    public string Slug { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public LevelKind Kind { get; set; }

    /// <summary>1–12 for <see cref="LevelKind.Grade"/>; null for exam tracks.</summary>
    public int? GradeNumber { get; set; }

    public int Order { get; set; }

    public virtual ICollection<Subject> Subjects { get; set; } = new List<Subject>();
}

public class Subject
{
    public Guid Id { get; set; }
    public Guid LevelId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>Hex colour used by the UI, e.g. <c>#2563eb</c>.</summary>
    public string Color { get; set; } = "#2563eb";

    public int Order { get; set; }

    public virtual Level? Level { get; set; }
    public virtual ICollection<CurriculumUnit> Units { get; set; } = new List<CurriculumUnit>();
}

/// <summary>A teaching unit (ünite) of a subject.</summary>
public class CurriculumUnit
{
    public Guid Id { get; set; }
    public Guid SubjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }

    public virtual Subject? Subject { get; set; }
    public virtual ICollection<Topic> Topics { get; set; } = new List<Topic>();
}

public class Topic
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }

    public virtual CurriculumUnit? Unit { get; set; }
    public virtual ICollection<LearningOutcome> Outcomes { get; set; } = new List<LearningOutcome>();
    public virtual ICollection<ContentItem> Items { get; set; } = new List<ContentItem>();
}

/// <summary>A MEB learning outcome (kazanım), e.g. <c>M.5.1.1.1</c>.</summary>
public class LearningOutcome
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public virtual Topic? Topic { get; set; }
}

public class ContentItem
{
    public Guid Id { get; set; }
    public Guid TopicId { get; set; }
    public ContentItemType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int? DurationSeconds { get; set; }
    public ContentAccessTier AccessTier { get; set; } = ContentAccessTier.Free;
    public ContentStatus Status { get; set; } = ContentStatus.Draft;
    public string? ReviewNote { get; set; }
    public Guid OwnerId { get; set; }
    public ContentOwnerKind OwnerKind { get; set; }
    public int Order { get; set; }

    public ContentProcessingStatus ProcessingStatus { get; set; } = ContentProcessingStatus.None;
    public string? ProcessingError { get; set; }
    public int ProcessingAttempts { get; set; }
    public DateTime? ProcessingStartedAt { get; set; }

    /// <summary>Object key of the uploaded original (video source or document).</summary>
    public string? StorageKey { get; set; }

    public string? OriginalFileName { get; set; }
    public string? FileContentType { get; set; }
    public long? FileSize { get; set; }

    /// <summary>Object key prefix the HLS playlists and segments live under, ending in a slash.</summary>
    public string? HlsPrefix { get; set; }

    public string? ThumbnailKey { get; set; }
    public string? EmbedUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? PublishedAt { get; set; }

    public virtual Topic? Topic { get; set; }
    public virtual ICollection<ContentItemOutcome> Outcomes { get; set; } = new List<ContentItemOutcome>();

    public bool IsVideo => Type is ContentItemType.Video or ContentItemType.SolvedQuestionVideo;

    public bool IsDocument => Type is ContentItemType.Pdf or ContentItemType.Worksheet or ContentItemType.EBook;
}

/// <summary>Many-to-many link between content and the learning outcomes it covers.</summary>
public class ContentItemOutcome
{
    public Guid ContentItemId { get; set; }
    public Guid LearningOutcomeId { get; set; }

    public virtual ContentItem? ContentItem { get; set; }
    public virtual LearningOutcome? LearningOutcome { get; set; }
}

/// <summary>Where a user is in a piece of content. One row per (user, item).</summary>
public class ContentProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ContentItemId { get; set; }
    public int PositionSeconds { get; set; }
    public bool Completed { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public virtual ContentItem? ContentItem { get; set; }
}
