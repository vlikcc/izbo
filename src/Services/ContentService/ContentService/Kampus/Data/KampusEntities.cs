using System.Text.Json;

namespace ContentService.Kampus.Data;

// YZ Kampüs learner state. Every row belongs to one student (StudentId = the account id); topic, stop,
// book, game and avatar-item ids are the catalog's string ids.

/// <summary>
/// The 💎 KP balance and the row every reward or purchase locks (<c>SELECT … FOR UPDATE</c>), which is what
/// makes the daily ⭐ limit, one-reward-per-source and "never spend below zero" hold under concurrency.
/// </summary>
public class KampusWallet
{
    public Guid StudentId { get; set; }
    public int KpBalance { get; set; }

    /// <summary>The cup nickname chosen last time, offered again next week.</summary>
    public string? Nick { get; set; }

    /// <summary>Campus level reached but not yet announced (shown once).</summary>
    public int PendingLevelUp { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>The reward ledger: one row per (student, kind, ref) — the unique index is the idempotency rule.</summary>
public class KampusReward
{
    public long Id { get; set; }
    public Guid StudentId { get; set; }

    /// <summary>durak, yildiz, minitest, kitap, kitap-soru, oyun, gunluk, bonus.</summary>
    public string Kind { get; set; } = string.Empty;

    public string Ref { get; set; } = string.Empty;
    public int Kp { get; set; }
    public int Star { get; set; }
    public DateTime AwardedAt { get; set; }

    /// <summary>Local (Istanbul) day, for the daily ⭐ limit.</summary>
    public DateOnly Day { get; set; }

    /// <summary>Monday of the local week, for cup points.</summary>
    public DateOnly Week { get; set; }
}

public class KampusStopCompletion
{
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public string StopId { get; set; } = string.Empty;
    public DateTime CompletedAt { get; set; }
}

/// <summary>Every finished stop, including repeats (the prototype's stopLog): daily quest and cup tasks count these.</summary>
public class KampusActivity
{
    public long Id { get; set; }
    public Guid StudentId { get; set; }

    /// <summary><c>durak</c>, <c>kitap-bitir</c>, <c>kitap-tamam</c>, <c>oyun</c>.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>Topic id (durak), book id or game id.</summary>
    public string Ref { get; set; } = string.Empty;

    /// <summary>Stop id for <c>durak</c>.</summary>
    public string? StopId { get; set; }

    public int? Score { get; set; }
    public DateTime At { get; set; }
    public DateOnly Day { get; set; }
    public DateOnly Week { get; set; }
}

/// <summary>The latest answers per question for a topic's stops, merged (the prototype's stopAnswers).</summary>
public class KampusTopicAnswers
{
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public Dictionary<string, JsonElement> Answers { get; set; } = new();
}

public class KampusInProgress
{
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public string StopId { get; set; } = string.Empty;
    public DateTime At { get; set; }
}

public sealed record MiniTestAnswer(JsonElement? Given, bool Ok);

public class KampusMiniTest
{
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public int Attempt { get; set; }
    public List<string> Set { get; set; } = new();
    public int Idx { get; set; }
    public Dictionary<string, MiniTestAnswer> Answers { get; set; } = new();
    public bool Done { get; set; }
    public List<string> Prev { get; set; } = new();
    public List<string> Shown { get; set; } = new();
    public int Best { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// A finished topic (the prototype's attempts): from the topic player, or recorded once when all four stops
/// are done. Teacher assignment results and parent summaries read these.
/// </summary>
public class KampusTopicAttempt
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public Guid? AssignmentId { get; set; }
    public DateTime CompletedAt { get; set; }
    public Dictionary<string, JsonElement> Answers { get; set; } = new();
    public bool ViaStops { get; set; }
}

public class KampusCollectionEntry
{
    public Guid StudentId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public DateTime At { get; set; }
}

public sealed record BookAnswer(bool Ok, DateTime At);

public class KampusBookState
{
    public Guid StudentId { get; set; }
    public string BookId { get; set; } = string.Empty;
    public DateTime? FinishedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Dictionary<string, BookAnswer> Answers { get; set; } = new();
}

/// <summary>
/// One student's place in a week's Yıldız Kupası. Groups of <c>groupSize</c> fill in join order per grade;
/// (week, grade, group, nick) is unique, and so is (week, grade, seq).
/// </summary>
public class KampusCupEntry
{
    public DateOnly Week { get; set; }
    public Guid StudentId { get; set; }
    public int Grade { get; set; }

    /// <summary>0-based join order within (week, grade).</summary>
    public int Seq { get; set; }

    /// <summary>1-based group number (Seq / groupSize + 1).</summary>
    public int GroupNo { get; set; }

    public string Nick { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
}

public class KampusCupResult
{
    public Guid StudentId { get; set; }
    public DateOnly Week { get; set; }
    public string CupId { get; set; } = string.Empty;
    public int? Rank { get; set; }
    public int Size { get; set; }
    public int GroupNo { get; set; }
    public bool Won { get; set; }
    public int Stars { get; set; }
}

public class KampusAvatar
{
    public Guid StudentId { get; set; }
    public bool Custom { get; set; }
    public Dictionary<string, string> Config { get; set; } = new();
    public Dictionary<string, string?> Equipped { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class KampusOwnedItem
{
    public Guid StudentId { get; set; }
    public string ItemId { get; set; } = string.Empty;
    public int PricePaid { get; set; }
    public DateTime AcquiredAt { get; set; }
}

/// <summary>A topic a teacher assigns to one of their classrooms.</summary>
public class KampusAssignment
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public Guid ClassroomId { get; set; }
    public string TopicId { get; set; } = string.Empty;
    public string? Title { get; set; }
    public DateOnly Due { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed record ExamQuestion(
    string Id,
    string Skill,
    string Type,
    string? Prompt,
    string? Input,
    IReadOnlyList<Catalog.CatalogOption>? Options,
    IReadOnlyList<string>? Answer,
    int? Pairs);

/// <summary>
/// A Tema/Ünite değerlendirmesi (<c>tema</c>, published by an administrator for a grade, optionally limited to
/// classrooms) or a Süreç değerlendirmesi (<c>surec</c>, a teacher's mixed check for one classroom).
/// </summary>
public class KampusExam
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "tema";
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = "karma";
    public int? ThemeNo { get; set; }
    public string? ThemeTitle { get; set; }
    public int Grade { get; set; }

    /// <summary>Empty = every student of <see cref="Grade"/>.</summary>
    public List<Guid> ClassroomIds { get; set; } = new();

    public Guid? TeacherId { get; set; }
    public string? AssignedBy { get; set; }
    public DateOnly OpensAt { get; set; }
    public DateOnly ClosesAt { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<ExamQuestion> Questions { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public sealed record ExamAnswer(JsonElement? Given, bool Ok);

public class KampusExamResult
{
    public Guid StudentId { get; set; }
    public Guid ExamId { get; set; }
    public int Idx { get; set; }
    public bool Done { get; set; }
    public Dictionary<string, ExamAnswer> Answers { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
}
