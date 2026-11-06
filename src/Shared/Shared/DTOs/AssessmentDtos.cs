using Shared.Models;

namespace Shared.DTOs;

// ---- Question bank (authoring) ----

public record QuestionOptionDto(string Key, string Text, Guid? AssetId);

/// <summary>An option as the author sends it. Keys are assigned by position (A, B, C, …).</summary>
public record QuestionOptionInput(string? Text, Guid? AssetId = null);

/// <summary>A bank question with its answer key — for authors, reviewers and teachers only.</summary>
public record BankQuestionDto(
    Guid Id,
    Guid TopicId,
    string TopicName,
    Guid UnitId,
    string UnitName,
    Guid SubjectId,
    string SubjectName,
    Guid LevelId,
    string LevelName,
    LearningOutcomeDto? Outcome,
    BankQuestionType Type,
    string Stem,
    Guid? StemAssetId,
    List<QuestionOptionDto> Options,
    string CorrectKey,
    QuestionDifficulty Difficulty,
    string Explanation,
    Guid? SolutionVideoItemId,
    string? SolutionVideoTitle,
    Guid OwnerId,
    ContentOwnerKind OwnerKind,
    ContentStatus Status,
    string? ReviewNote,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? SubmittedAt,
    DateTime? PublishedAt);

/// <summary>
/// Create or fully replace a question. For <see cref="BankQuestionType.TrueFalse"/> the options are fixed
/// and <paramref name="CorrectKey"/> is <c>A</c> (Doğru) or <c>B</c> (Yanlış).
/// </summary>
public record SaveBankQuestionRequest(
    Guid TopicId,
    Guid? LearningOutcomeId,
    BankQuestionType Type,
    string Stem,
    Guid? StemAssetId,
    List<QuestionOptionInput>? Options,
    string CorrectKey,
    QuestionDifficulty Difficulty = QuestionDifficulty.Medium,
    string? Explanation = null,
    Guid? SolutionVideoItemId = null);

/// <summary>Filters for the question bank list. Everything is optional; <paramref name="Mine"/> limits to the caller's own.</summary>
public record QuestionListQuery(
    Guid? LevelId = null,
    Guid? SubjectId = null,
    Guid? UnitId = null,
    Guid? TopicId = null,
    Guid? OutcomeId = null,
    QuestionDifficulty? Difficulty = null,
    ContentStatus? Status = null,
    bool Mine = false,
    string? Search = null,
    int Page = 1,
    int PageSize = 20);

public record QuestionAssetDto(Guid Id, string ContentType, long Size);

public record QuestionImportResult(
    bool DryRun,
    int RowCount,
    int Created,
    int Updated,
    int Unchanged,
    List<CurriculumImportError> Errors);

// ---- Taking tests ----

/// <summary>Start (or resume) a generated test for one topic or one unit. Exactly one id is set.</summary>
public record StartPracticeRequest(Guid? TopicId, Guid? UnitId, int? Count = null);

public record SaveAnswerRequest(string? SelectedKey);

/// <summary>A question as a student sees it during a test — never with its key.</summary>
public record AttemptQuestionDto(
    int Order,
    Guid QuestionId,
    string? SectionTitle,
    BankQuestionType Type,
    string Stem,
    Guid? StemAssetId,
    List<QuestionOptionDto> Options,
    string? SelectedKey);

public record AttemptSummaryDto(
    Guid Id,
    AttemptScope Scope,
    AssessmentKind? AssessmentKind,
    Guid? AssessmentId,
    Guid? TopicId,
    Guid? UnitId,
    string Title,
    AttemptStatus Status,
    ScoringRule ScoringRule,
    DateTime StartedAt,
    DateTime Deadline,
    DateTime? SubmittedAt,
    int QuestionCount,
    int AnsweredCount,
    bool ResultsVisible,
    DateTime? ResultsAt,
    int? Correct,
    int? Wrong,
    int? Blank,
    decimal? Net,
    decimal? Percent,
    bool IsRanked,
    int? Rank,
    int? ParticipantCount,
    decimal? TopPercent);

/// <summary>An attempt in progress, with the server's clock so the client timer cannot drift.</summary>
public record AttemptDto(AttemptSummaryDto Summary, DateTime ServerNow, List<AttemptQuestionDto> Questions);

// ---- Reports ----

public record SectionResultDto(string Title, Guid? SubjectId, int Correct, int Wrong, int Blank, decimal Net);

/// <summary>Success on one topic or outcome: <paramref name="Percent"/> is correct / total.</summary>
public record MasteryRowDto(
    Guid TopicId,
    string TopicName,
    Guid? OutcomeId,
    string? OutcomeCode,
    string? OutcomeDescription,
    int Correct,
    int Total,
    decimal Percent);

public record RecommendedContentDto(ContentItemSummaryDto Item, Guid TopicId, string TopicName, string? OutcomeCode);

/// <summary>A question after the results are out: the key, the explanation and the solution video.</summary>
public record ReviewQuestionDto(
    int Order,
    Guid QuestionId,
    string? SectionTitle,
    BankQuestionType Type,
    string Stem,
    Guid? StemAssetId,
    List<QuestionOptionDto> Options,
    string? SelectedKey,
    string CorrectKey,
    bool? IsCorrect,
    string Explanation,
    Guid? SolutionVideoItemId,
    string TopicName,
    string? OutcomeCode);

public record AttemptReportDto(
    AttemptSummaryDto Summary,
    List<SectionResultDto> Sections,
    List<MasteryRowDto> Topics,
    List<MasteryRowDto> Outcomes,
    List<MasteryRowDto> Weak,
    List<RecommendedContentDto> Recommendations,
    List<ReviewQuestionDto> Questions);

public record TopicMasteryDto(
    Guid TopicId,
    string TopicName,
    Guid SubjectId,
    string SubjectName,
    int Correct,
    int Total,
    decimal Percent,
    DateTime LastAttemptAt);

/// <summary>Results across recent tests, per topic; <paramref name="Weak"/> are the topics to revisit first.</summary>
public record MasteryDto(Guid StudentId, DateTime Since, List<TopicMasteryDto> Topics, List<TopicMasteryDto> Weak);

// ---- Assessments ----

public enum AssessmentWindowState
{
    /// <summary>Published but the window has not opened.</summary>
    Upcoming = 0,

    Open = 1,

    /// <summary>The window has closed; it can still be taken, unranked.</summary>
    Closed = 2
}

public record AssessmentSummaryDto(
    Guid Id,
    AssessmentKind Kind,
    string Title,
    string Description,
    Guid LevelId,
    string LevelSlug,
    string LevelName,
    int DurationMinutes,
    ScoringRule ScoringRule,
    int QuestionCount,
    DateTime? WindowStart,
    DateTime? WindowEnd,
    AssessmentWindowState State,
    ContentAccessTier AccessTier,
    AssessmentStatus Status,
    Guid? MyAttemptId,
    AttemptStatus? MyAttemptStatus);

public record AssessmentSectionDto(Guid Id, Guid? SubjectId, string Title, int Order, List<BankQuestionDto> Questions);

public record AssessmentDetailDto(AssessmentSummaryDto Summary, DateTime? RankedAt, int AttemptCount, List<AssessmentSectionDto> Sections);

/// <summary>Create or update an assessment's settings. <paramref name="ScoringRule"/> defaults from the level.</summary>
public record SaveAssessmentRequest(
    AssessmentKind Kind,
    string Title,
    string? Description,
    Guid LevelId,
    int DurationMinutes,
    ScoringRule? ScoringRule = null,
    DateTime? WindowStart = null,
    DateTime? WindowEnd = null,
    ContentAccessTier AccessTier = ContentAccessTier.Free);

public record SectionInput(Guid? SubjectId, string Title, List<Guid> QuestionIds);

/// <summary>Replaces every section and question of a draft assessment.</summary>
public record SaveSectionsRequest(List<SectionInput> Sections);

/// <summary>Random published questions from the given topics, for filling a section.</summary>
public record SuggestQuestionsRequest(List<Guid> TopicIds, int Count, List<Guid>? Exclude = null, QuestionDifficulty? Difficulty = null);
