using Shared.Models;

namespace Shared.DTOs;

// Exam DTOs
public record ExamDto(
    Guid Id,
    Guid ClassroomId,
    string ClassroomName,
    string Title,
    string? Description,
    int DurationMinutes,
    DateTime StartTime,
    DateTime EndTime,
    int TotalPoints,
    int QuestionCount,
    bool ShuffleQuestions,
    bool ShuffleOptions,
    bool ShowResults,
    int? PassingScore,
    string Status,
    DateTime CreatedAt);

public record CreateExamRequest(
    Guid ClassroomId,
    string Title,
    string? Description,
    int DurationMinutes,
    DateTime StartTime,
    DateTime EndTime,
    bool ShuffleQuestions,
    bool ShuffleOptions,
    bool ShowResults,
    int? PassingScore);

public record UpdateExamRequest(
    string? Title,
    string? Description,
    int? DurationMinutes,
    DateTime? StartTime,
    DateTime? EndTime,
    bool? ShuffleQuestions,
    bool? ShuffleOptions,
    bool? ShowResults,
    int? PassingScore);

// Question DTOs
public record QuestionDto(
    Guid Id,
    Guid ExamId,
    int OrderIndex,
    string Type,
    string Content,
    string? ImageUrl,
    List<string>? Options,
    int Points,
    string? Explanation);

public record QuestionWithAnswerDto(
    Guid Id,
    Guid ExamId,
    int OrderIndex,
    string Type,
    string Content,
    string? ImageUrl,
    List<string>? Options,
    string? CorrectAnswer,
    int Points,
    string? Explanation);

public record CreateQuestionRequest(
    int OrderIndex,
    QuestionType Type,
    string Content,
    string? ImageUrl,
    List<string>? Options,
    string? CorrectAnswer,
    int Points,
    string? Explanation);

public record UpdateQuestionRequest(
    int? OrderIndex,
    string? Content,
    string? ImageUrl,
    List<string>? Options,
    string? CorrectAnswer,
    int? Points,
    string? Explanation);

// Exam Session DTOs
public record ExamSessionDto(
    Guid Id,
    Guid ExamId,
    string ExamTitle,
    Guid StudentId,
    string StudentName,
    DateTime? StartedAt,
    DateTime? SubmittedAt,
    int? TotalScore,
    decimal? Percentage,
    bool IsPassed,
    string Status);

public record StartExamResponse(
    Guid SessionId,
    List<QuestionDto> Questions,
    DateTime ExpiresAt,
    int RemainingSeconds);

public record SubmitAnswerRequest(Guid QuestionId, string Answer);
public record SubmitExamRequest(List<SubmitAnswerRequest> Answers);

public record ExamResultDto(
    Guid SessionId,
    Guid ExamId,
    string ExamTitle,
    int TotalScore,
    int MaxScore,
    decimal Percentage,
    bool IsPassed,
    DateTime SubmittedAt,
    List<QuestionResultDto>? QuestionResults);

public record QuestionResultDto(
    Guid QuestionId,
    string Content,
    string? YourAnswer,
    string? CorrectAnswer,
    bool IsCorrect,
    int PointsAwarded,
    int MaxPoints,
    string? Explanation);
