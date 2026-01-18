namespace Shared.DTOs;

// Homework DTOs
public record HomeworkDto(
    Guid Id,
    Guid ClassroomId,
    string ClassroomName,
    string Title,
    string Description,
    string? AttachmentUrl,
    int MaxScore,
    DateTime DueDate,
    bool AllowLateSubmission,
    int LatePenaltyPercent,
    int SubmissionCount,
    bool IsActive,
    DateTime CreatedAt);

public record CreateHomeworkRequest(
    Guid ClassroomId,
    string Title,
    string Description,
    string? AttachmentUrl,
    int MaxScore,
    DateTime DueDate,
    bool AllowLateSubmission,
    int LatePenaltyPercent);

public record UpdateHomeworkRequest(
    string? Title,
    string? Description,
    string? AttachmentUrl,
    int? MaxScore,
    DateTime? DueDate,
    bool? AllowLateSubmission,
    int? LatePenaltyPercent);

// Submission DTOs
public record SubmissionDto(
    Guid Id,
    Guid HomeworkId,
    Guid StudentId,
    string StudentName,
    string? Content,
    string? FileUrl,
    int? Score,
    string? Feedback,
    string Status,
    DateTime? SubmittedAt,
    DateTime? GradedAt);

public record SubmitHomeworkRequest(string? Content, string? FileUrl);
public record GradeSubmissionRequest(int Score, string? Feedback);
