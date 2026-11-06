using Shared.Models;

namespace Shared.DTOs;

// ---- Curriculum (read) ----

public record LevelDto(Guid Id, string Slug, string Name, LevelKind Kind, int? GradeNumber, int Order);

public record SubjectDto(Guid Id, Guid LevelId, string Slug, string Name, string Color, int Order);

public record LearningOutcomeDto(Guid Id, Guid TopicId, string Code, string Description);

/// <summary>A topic inside a subject tree, with the caller's completion count for progress bars.</summary>
public record TopicNodeDto(Guid Id, Guid UnitId, string Slug, string Name, int Order, int ItemCount, int CompletedCount);

public record UnitNodeDto(Guid Id, Guid SubjectId, string Name, int Order, List<TopicNodeDto> Topics);

public record SubjectTreeDto(SubjectDto Subject, LevelDto Level, List<UnitNodeDto> Units);

public record TopicDetailDto(
    Guid Id,
    Guid UnitId,
    string UnitName,
    Guid SubjectId,
    string SubjectName,
    string Slug,
    string Name,
    int Order,
    List<LearningOutcomeDto> Outcomes,
    List<ContentItemSummaryDto> Items);

// ---- Curriculum (admin) ----

public record CreateSubjectRequest(Guid LevelId, string Name, string? Slug, string? Color, int? Order);
public record UpdateSubjectRequest(string? Name, string? Slug, string? Color, int? Order);

public record CurriculumUnitDto(Guid Id, Guid SubjectId, string Name, int Order);
public record CreateUnitRequest(Guid SubjectId, string Name, int? Order);
public record UpdateUnitRequest(string? Name, int? Order);

public record TopicDto(Guid Id, Guid UnitId, string Slug, string Name, int Order);
public record CreateTopicRequest(Guid UnitId, string Name, string? Slug, int? Order);
public record UpdateTopicRequest(string? Name, string? Slug, int? Order);

public record CreateOutcomeRequest(Guid TopicId, string Code, string Description);
public record UpdateOutcomeRequest(string? Code, string? Description);

/// <summary>Outcome of a curriculum spreadsheet import. Counts are per entity kind.</summary>
public record CurriculumImportResult(
    bool DryRun,
    int RowCount,
    int SubjectsCreated,
    int UnitsCreated,
    int TopicsCreated,
    int OutcomesCreated,
    int OutcomesUpdated,
    List<CurriculumImportError> Errors);

public record CurriculumImportError(int Row, string Message);

// ---- Content items ----

public record ContentProgressDto(int PositionSeconds, bool Completed, DateTime UpdatedAt);

/// <summary>What a list needs to render a content card.</summary>
public record ContentItemSummaryDto(
    Guid Id,
    Guid TopicId,
    ContentItemType Type,
    string Title,
    int? DurationSeconds,
    ContentAccessTier AccessTier,
    ContentStatus Status,
    ContentProcessingStatus ProcessingStatus,
    bool HasThumbnail,
    int Order,
    ContentProgressDto? Progress);

public record ContentItemDto(
    Guid Id,
    Guid TopicId,
    string TopicName,
    ContentItemType Type,
    string Title,
    string Description,
    int? DurationSeconds,
    ContentAccessTier AccessTier,
    ContentStatus Status,
    string? ReviewNote,
    Guid OwnerId,
    ContentOwnerKind OwnerKind,
    int Order,
    ContentProcessingStatus ProcessingStatus,
    string? ProcessingError,
    string? OriginalFileName,
    long? FileSize,
    bool HasThumbnail,
    string? EmbedUrl,
    List<LearningOutcomeDto> Outcomes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? SubmittedAt,
    DateTime? PublishedAt,
    ContentProgressDto? Progress);

public record CreateContentItemRequest(
    Guid TopicId,
    ContentItemType Type,
    string Title,
    string? Description,
    ContentAccessTier AccessTier = ContentAccessTier.Free,
    string? EmbedUrl = null,
    int? Order = null,
    List<Guid>? OutcomeIds = null);

public record UpdateContentItemRequest(
    Guid? TopicId,
    string? Title,
    string? Description,
    ContentAccessTier? AccessTier,
    string? EmbedUrl,
    int? Order,
    List<Guid>? OutcomeIds);

/// <summary>An administrator's verdict on content waiting in the review queue.</summary>
public record ReviewContentRequest(bool Approve, string? Note);

public record UpdateProgressRequest(int PositionSeconds, bool Completed = false);

/// <summary>A "continue where you left off" card.</summary>
public record ContinueWatchingDto(
    ContentItemSummaryDto Item,
    Guid SubjectId,
    string SubjectName,
    string TopicName,
    int PositionSeconds,
    DateTime UpdatedAt);

// ---- Public (unauthenticated) ----

public record PublicSubjectStatsDto(
    Guid Id,
    string Slug,
    string Name,
    string Color,
    int UnitCount,
    int TopicCount,
    int ItemCount,
    int VideoMinutes);

public record PublicSampleItemDto(
    Guid Id,
    string Title,
    ContentItemType Type,
    string SubjectName,
    string TopicName,
    int? DurationSeconds);

public record PublicLevelDto(
    LevelDto Level,
    List<PublicSubjectStatsDto> Subjects,
    int TotalItems,
    int TotalVideoMinutes,
    List<PublicSampleItemDto> FreeSamples);
