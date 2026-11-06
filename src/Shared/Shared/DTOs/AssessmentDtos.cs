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
