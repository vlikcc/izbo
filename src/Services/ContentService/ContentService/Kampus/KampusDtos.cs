using System.Text.Json;

namespace ContentService.Kampus;

// Request/response shapes of /api/kampus. Field names follow the prototype Store (frontend/src/kampus/core/
// store.ts) so the frontend can swap a Store call for a fetch with little reshaping; see docs/kampus-api.md.

public sealed record GainDto(int Kp, int Cup, int Daily, int Bonus, int? Repeat = null, bool? Capped = null);

public sealed record SaveStopRequest(Dictionary<string, JsonElement>? Answers);

public sealed record StopResultDto(
    bool First, bool AllDone, int Kp, int Cup, int Daily, int Bonus, int? Repeat, bool? Capped, int LevelUp);

public sealed record StartStopRequest(string TopicId, string StopId);

public sealed record InProgressDto(string TopicId, string StopId, DateTime At);

public sealed record MiniTestAnswerDto(JsonElement? Given, bool Ok);

public sealed record MiniTestDto(
    string TopicId, int Attempt, IReadOnlyList<string> Set, int Idx, IReadOnlyDictionary<string, MiniTestAnswerDto> Answers,
    bool Done, IReadOnlyList<string> Prev, int Best);

public sealed record AnswerRequest(string QuestionId, JsonElement? Given);

public sealed record AnswerResultDto(bool Ok, MiniTestDto State);

public sealed record SaveAttemptRequest(string TopicId, Dictionary<string, JsonElement>? Answers);

public sealed record AttemptDto(Guid Id, string TopicId, Guid? AssignmentId, DateTime CompletedAt, bool ViaStops, int Daily, int Bonus);

public sealed record DailyQuestDto(string Title, int Done, int Target, int Bonus);

public sealed record OverviewDto(
    int Kp, int CampusLevel, int PendingLevelUp, int StarsToday, int StarDailyMax, DailyQuestDto DailyQuest, InProgressDto? InProgress);

public sealed record CollectionEntryDto(string TopicId, DateTime At);

public sealed record ProgressDto(
    IReadOnlyDictionary<string, IReadOnlyList<string>> Stops,
    IReadOnlyList<CollectionEntryDto> Collection,
    int CampusLevel,
    IReadOnlyList<string> CompletedTopics,
    IReadOnlyDictionary<string, int> MiniTestBest,
    int Kp);

public sealed record StarPreviewDto(int Max, int Open, int Left, string Kind);

public sealed record BadgeDto(string CourseId, int Count, int Target, bool Won);

public sealed record LevelUpDto(int Level);

public sealed record BookAnswerDto(bool Ok, DateTime At);

public sealed record BookStateDto(string BookId, bool Finished, DateTime? FinishedAt, DateTime? CompletedAt, IReadOnlyDictionary<string, BookAnswerDto> Answers, int Kp);

public sealed record BookAnswerRequest(string QuestionId, string Given);

public sealed record BookAnswerResultDto(bool Ok, GainDto Gain, BookStateDto State);

public sealed record FinishGameRequest(int Score);

// ---- Yıldız Kupası ----

public sealed record CupTaskDto(string Id, IReadOnlyList<string> Stops, string Label, string Icon, int Done, int Target);

public sealed record CupProgressDto(IReadOnlyList<CupTaskDto> Tasks, CupTaskDto Bonus, int Total, int DoneCount, bool Ready);

public sealed record CupThemeDto(string Id, string Name);

public sealed record CupBoardRowDto(string Nick, string Emoji, int Points, int Rank, bool Me, bool Winner);

public sealed record CupBoardDto(string Week, IReadOnlyList<CupBoardRowDto> Rows, int? Group, int Groups, int Winners);

public sealed record CupSummaryDto(
    bool Joined, CupThemeDto Theme, int Points, int? Rank, int Total, int? Group, int Groups, int Winners, bool InZone,
    CupProgressDto Progress, int Today, int DailyMax, string? Nick);

public sealed record NickChoicesDto(IReadOnlyList<string> Taken, string? Last, string Suggest, IReadOnlyList<string> Adjectives, IReadOnlyList<string> Nouns);

public sealed record JoinCupRequest(string? Nick);

public sealed record CupEntryDto(string Week, string Nick, DateTime At, int Group);

public sealed record CupWonDto(string Week, string Cup, CupThemeDto Theme, int? Rank, int Size, int Group, bool Won, int Stars);

// ---- Avatar ----

public sealed record AvatarDto(bool Custom, IReadOnlyDictionary<string, string> Cfg, IReadOnlyList<string> Owned, IReadOnlyDictionary<string, string?> Eq, int Kp);

public sealed record SaveAvatarRequest(Dictionary<string, string>? Cfg, Dictionary<string, string?>? Eq);

// ---- Ödev, değerlendirme, raporlar ----

public sealed record CreateAssignmentRequest(Guid ClassroomId, string TopicId, DateOnly Due, string? Title);

public sealed record AssignmentDto(Guid Id, Guid TeacherId, Guid ClassroomId, string TopicId, string? Title, DateOnly Due, DateTime CreatedAt);

public sealed record AssignmentStudentRowDto(Guid StudentId, string Name, bool Done, DateTime? CompletedAt, int? WrongQs, int? Hints);

public sealed record AssignmentQuestionDto(string QuestionId, int Struggled, int Total, string? TopWrong);

public sealed record AssignmentResultsDto(AssignmentDto Assignment, IReadOnlyList<AssignmentStudentRowDto> Rows, IReadOnlyList<AssignmentQuestionDto> Questions, int DoneCount, int Total);

public sealed record ExamQuestionDto(string Id, string Skill, string Type, string? Prompt, string? Input, IReadOnlyList<Catalog.CatalogOption>? Options, int? Pairs);

public sealed record ExamDto(
    Guid Id, string Kind, string Title, string Subject, int? ThemeNo, string? ThemeTitle, int Grade, IReadOnlyList<Guid> ClassroomIds,
    string? AssignedBy, DateOnly OpensAt, DateOnly ClosesAt, IReadOnlyList<string> Skills, int QuestionCount, DateTime CreatedAt);

public sealed record ExamListItemDto(ExamDto Exam, string Status);

public sealed record ExamAnswerDto(JsonElement? Given, bool Ok);

public sealed record ExamStateDto(int Idx, bool Done, IReadOnlyDictionary<string, ExamAnswerDto> Answers, DateTime? SubmittedAt);

public sealed record ExamPlayDto(ExamDto Exam, IReadOnlyList<ExamQuestionDto> Questions, ExamStateDto? State, string Status);

public sealed record ExamAnswerResultDto(bool Ok, ExamStateDto State);

public sealed record SkillResultDto(string Skill, string Name, string? Can, string? Study, string? TopicId, string? Course, int Right, int Total);

public sealed record ReviewQuestionDto(string Id, string Skill, string? Prompt, JsonElement? Given, bool Ok, IReadOnlyList<string>? Answer);

public sealed record ExamReportDto(
    Guid ExamId, IReadOnlyList<SkillResultDto> Skills, IReadOnlyList<string> Strong, IReadOnlyList<string> Weak, string Msg, int Right, int Total,
    IReadOnlyList<ReviewQuestionDto> Review);

public sealed record CreateProcessCheckRequest(Guid ClassroomId, int Grade, List<string> Skills, int PerSkill, DateOnly OpensAt, DateOnly ClosesAt, string? Title);

public sealed record CreateThemeExamRequest(
    int Grade, string Title, string Subject, int? ThemeNo, string? ThemeTitle, DateOnly OpensAt, DateOnly ClosesAt,
    List<string> Skills, List<Data.ExamQuestion> Questions, List<Guid>? ClassroomIds);

public sealed record ProcessCheckRowDto(Guid StudentId, string Name, string Status, ExamReportDto? Report);

public sealed record ProcessCheckSkillDto(string Skill, string Name, IReadOnlyList<Guid> Mastered, IReadOnlyList<Guid> Repeat);

public sealed record ProcessCheckResultsDto(ExamDto Exam, IReadOnlyList<ProcessCheckRowDto> Rows, int DoneCount, int Total, IReadOnlyList<ProcessCheckSkillDto> Skills);

public sealed record TodoItemDto(string Kind, DateOnly Date, AssignmentDto? Assignment, ExamDto? Exam, string? Status);

public sealed record CompletedTopicDto(string TopicId, string Title, DateTime At);

public sealed record RepeatSkillDto(string Skill, string TopicId);

public sealed record ChildSummaryDto(IReadOnlyList<CompletedTopicDto> Completed, IReadOnlyList<RepeatSkillDto> Repeat, IReadOnlyList<AssignmentDto> Pending, int Light);
