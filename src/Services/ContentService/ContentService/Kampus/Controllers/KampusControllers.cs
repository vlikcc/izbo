using ContentService.Controllers;
using ContentService.Kampus.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ContentService.Kampus.Controllers;

/// <summary>
/// The signed-in student's own YZ Kampüs data (the prototype's <c>Store</c> calls with <c>sid</c> = me).
/// Students only: nobody else can create progress, rewards or purchases on a student's behalf.
/// </summary>
[ApiController]
[Route("api/kampus/me")]
[Authorize(Roles = UserRoles.Student)]
public sealed class KampusMeController : ControllerBase
{
    private readonly KampusLearnerService _learner;
    private readonly KampusCupService _cup;
    private readonly KampusAvatarService _avatar;
    private readonly KampusTeachingService _teaching;
    private readonly KampusClock _clock;

    public KampusMeController(
        KampusLearnerService learner, KampusCupService cup, KampusAvatarService avatar, KampusTeachingService teaching, KampusClock clock)
    {
        _learner = learner;
        _cup = cup;
        _avatar = avatar;
        _teaching = teaching;
        _clock = clock;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<OverviewDto>>> Overview(CancellationToken ct) =>
        Ok(new ApiResponse<OverviewDto>(true, await _learner.OverviewAsync(Caller.UserId, ct)));

    [HttpGet("progress")]
    public async Task<ActionResult<ApiResponse<ProgressDto>>> Progress(CancellationToken ct) =>
        Ok(new ApiResponse<ProgressDto>(true, await _learner.ProgressAsync(Caller.UserId, ct)));

    [HttpGet("daily-quest")]
    public async Task<ActionResult<ApiResponse<DailyQuestDto>>> DailyQuest(CancellationToken ct) =>
        Ok(new ApiResponse<DailyQuestDto>(true, await _learner.DailyQuestAsync(Caller.UserId, ct)));

    [HttpGet("in-progress")]
    public async Task<ActionResult<ApiResponse<InProgressDto?>>> InProgress(CancellationToken ct) =>
        Ok(new ApiResponse<InProgressDto?>(true, await _learner.InProgressAsync(Caller.UserId, ct)));

    [HttpPost("in-progress")]
    public async Task<ActionResult<ApiResponse<bool>>> StartStop([FromBody] StartStopRequest request, CancellationToken ct) =>
        (await _learner.StartStopAsync(Caller, request.TopicId, request.StopId, ct)).ToActionResult(this);

    [HttpPost("stops/{topicId}/{stopId}")]
    public async Task<ActionResult<ApiResponse<StopResultDto>>> SaveStop(string topicId, string stopId, [FromBody] SaveStopRequest? request, CancellationToken ct) =>
        (await _learner.SaveStopAsync(Caller, topicId, stopId, request?.Answers, ct)).ToActionResult(this);

    [HttpGet("star-preview/{topicId}/{stopId}")]
    public async Task<ActionResult<ApiResponse<StarPreviewDto>>> StarPreview(string topicId, string stopId, CancellationToken ct) =>
        (await _learner.StarPreviewAsync(Caller.UserId, topicId, stopId, ct)).ToActionResult(this);

    [HttpGet("minitests/{topicId}")]
    public async Task<ActionResult<ApiResponse<MiniTestDto?>>> MiniTest(string topicId, CancellationToken ct) =>
        (await _learner.GetMiniTestAsync(Caller, topicId, ct)).ToActionResult(this);

    [HttpPost("minitests/{topicId}/new")]
    public async Task<ActionResult<ApiResponse<MiniTestDto>>> NewMiniTest(string topicId, CancellationToken ct) =>
        (await _learner.NewMiniTestAsync(Caller, topicId, ct)).ToActionResult(this);

    [HttpPost("minitests/{topicId}/answers")]
    public async Task<ActionResult<ApiResponse<AnswerResultDto>>> AnswerMiniTest(string topicId, [FromBody] AnswerRequest request, CancellationToken ct) =>
        (await _learner.AnswerMiniTestAsync(Caller, topicId, request.QuestionId, request.Given, ct)).ToActionResult(this);

    [HttpPost("minitests/{topicId}/complete")]
    public async Task<ActionResult<ApiResponse<StopResultDto>>> CompleteMiniTest(string topicId, [FromBody] SaveStopRequest? request, CancellationToken ct) =>
        (await _learner.CompleteMiniTestAsync(Caller, topicId, request?.Answers, ct)).ToActionResult(this);

    [HttpPost("attempts")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> SaveAttempt([FromBody] SaveAttemptRequest request, CancellationToken ct) =>
        (await _learner.SaveAttemptAsync(Caller, request, ct)).ToActionResult(this);

    [HttpGet("badges/{courseId}")]
    public async Task<ActionResult<ApiResponse<BadgeDto>>> Badge(string courseId, CancellationToken ct) =>
        Ok(new ApiResponse<BadgeDto>(true, await _learner.BadgeAsync(Caller.UserId, courseId, ct)));

    [HttpPost("level-up/take")]
    public async Task<ActionResult<ApiResponse<LevelUpDto>>> TakeLevelUp(CancellationToken ct) =>
        Ok(new ApiResponse<LevelUpDto>(true, await _learner.TakeLevelUpAsync(Caller, ct)));

    [HttpGet("books")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BookStateDto>>>> Books(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<BookStateDto>>(true, await _learner.BooksAsync(Caller.UserId, ct)));

    [HttpPost("books/{bookId}/finish")]
    public async Task<ActionResult<ApiResponse<GainDto>>> FinishBook(string bookId, CancellationToken ct) =>
        (await _learner.FinishBookAsync(Caller, bookId, ct)).ToActionResult(this);

    [HttpPost("books/{bookId}/answers")]
    public async Task<ActionResult<ApiResponse<BookAnswerResultDto>>> AnswerBook(string bookId, [FromBody] BookAnswerRequest request, CancellationToken ct) =>
        (await _learner.AnswerBookAsync(Caller, bookId, request.QuestionId, request.Given, ct)).ToActionResult(this);

    [HttpPost("games/{gameId}/finish")]
    public async Task<ActionResult<ApiResponse<GainDto>>> FinishGame(string gameId, [FromBody] FinishGameRequest request, CancellationToken ct) =>
        (await _learner.FinishGameAsync(Caller, gameId, request.Score, ct)).ToActionResult(this);

    // ---- Yıldız Kupası ----

    [HttpGet("cup")]
    public async Task<ActionResult<ApiResponse<CupSummaryDto>>> CupSummary(CancellationToken ct) =>
        Ok(new ApiResponse<CupSummaryDto>(true, await _cup.SummaryAsync(Caller.UserId, ct)));

    [HttpGet("cup/progress")]
    public async Task<ActionResult<ApiResponse<CupProgressDto>>> CupProgress(CancellationToken ct) =>
        Ok(new ApiResponse<CupProgressDto>(true, await _cup.ProgressAsync(Caller.UserId, ct)));

    /// <summary>The student's own group. <paramref name="week"/> is a Monday (yyyy-MM-dd); default this week.</summary>
    [HttpGet("cup/board")]
    public async Task<ActionResult<ApiResponse<CupBoardDto>>> CupBoard([FromQuery] DateOnly? week, CancellationToken ct) =>
        Ok(new ApiResponse<CupBoardDto>(true, await _cup.BoardAsync(Caller.UserId, week ?? _clock.ThisWeek, ct)));

    [HttpGet("cup/nick-choices")]
    public async Task<ActionResult<ApiResponse<NickChoicesDto>>> NickChoices(CancellationToken ct) =>
        Ok(new ApiResponse<NickChoicesDto>(true, await _cup.NickChoicesAsync(Caller, ct)));

    [HttpPost("cup/join")]
    public async Task<ActionResult<ApiResponse<CupEntryDto>>> JoinCup([FromBody] JoinCupRequest? request, CancellationToken ct) =>
        (await _cup.JoinAsync(Caller, request?.Nick, ct)).ToActionResult(this);

    [HttpGet("cup/won")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CupWonDto>>>> CupsWon(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<CupWonDto>>(true, await _cup.CupsWonAsync(Caller.UserId, ct)));

    // ---- Avatar ----

    [HttpGet("avatar")]
    public async Task<ActionResult<ApiResponse<AvatarDto>>> Avatar(CancellationToken ct) =>
        Ok(new ApiResponse<AvatarDto>(true, await _avatar.GetAsync(Caller.UserId, ct)));

    [HttpPut("avatar")]
    public async Task<ActionResult<ApiResponse<AvatarDto>>> SaveAvatar([FromBody] SaveAvatarRequest request, CancellationToken ct) =>
        (await _avatar.SaveAsync(Caller, request, ct)).ToActionResult(this);

    [HttpPost("avatar/items/{itemId}/buy")]
    public async Task<ActionResult<ApiResponse<AvatarDto>>> BuyItem(string itemId, CancellationToken ct) =>
        (await _avatar.BuyAsync(Caller, itemId, ct)).ToActionResult(this);

    // ---- Ödevler, değerlendirmeler ----

    [HttpGet("todo")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<TodoItemDto>>>> Todo(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<TodoItemDto>>(true, await _teaching.TodoAsync(Caller, ct)));

    [HttpGet("assignments")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AssignmentDto>>>> Assignments([FromQuery] bool done, CancellationToken ct) =>
        (await _teaching.StudentAssignmentsAsync(Caller, Caller.UserId, done, ct)).ToActionResult(this);

    [HttpGet("next-topic")]
    public async Task<ActionResult<ApiResponse<string?>>> NextTopic(CancellationToken ct) =>
        Ok(new ApiResponse<string?>(true, await _teaching.NextTopicAsync(Caller, ct)));

    [HttpGet("exams")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ExamListItemDto>>>> Exams(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<ExamListItemDto>>(true, await _teaching.StudentExamsAsync(Caller, ct)));

    [HttpGet("exams/{examId:guid}")]
    public async Task<ActionResult<ApiResponse<ExamPlayDto>>> Exam(Guid examId, CancellationToken ct) =>
        (await _teaching.ExamForStudentAsync(Caller, examId, ct)).ToActionResult(this);

    [HttpPost("exams/{examId:guid}/answers")]
    public async Task<ActionResult<ApiResponse<ExamAnswerResultDto>>> AnswerExam(Guid examId, [FromBody] AnswerRequest request, CancellationToken ct) =>
        (await _teaching.AnswerExamAsync(Caller, examId, request.QuestionId, request.Given, ct)).ToActionResult(this);

    [HttpGet("exams/{examId:guid}/report")]
    public async Task<ActionResult<ApiResponse<ExamReportDto>>> ExamReport(Guid examId, CancellationToken ct) =>
        (await _teaching.ExamReportAsync(Caller, Caller.UserId, examId, ct)).ToActionResult(this);
}

/// <summary>
/// A student's data as seen by someone allowed to follow them: a linked parent, a teacher of one of the
/// student's classrooms, or an administrator. Anyone else gets 404, so ids cannot be probed.
/// </summary>
[ApiController]
[Route("api/kampus/students/{studentId:guid}")]
[Authorize]
public sealed class KampusStudentsController : ControllerBase
{
    private readonly KampusLearnerService _learner;
    private readonly KampusTeachingService _teaching;
    private readonly IKampusDirectory _directory;

    public KampusStudentsController(KampusLearnerService learner, KampusTeachingService teaching, IKampusDirectory directory)
    {
        _learner = learner;
        _teaching = teaching;
        _directory = directory;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("progress")]
    public async Task<ActionResult<ApiResponse<ProgressDto>>> Progress(Guid studentId, CancellationToken ct) =>
        await _directory.CanViewStudentAsync(studentId, Caller, ct)
            ? Ok(new ApiResponse<ProgressDto>(true, await _learner.ProgressAsync(studentId, ct)))
            : NotFound(new ApiResponse<ProgressDto>(false, null, "Öğrenci bulunamadı."));

    [HttpGet("badges/{courseId}")]
    public async Task<ActionResult<ApiResponse<BadgeDto>>> Badge(Guid studentId, string courseId, CancellationToken ct) =>
        await _directory.CanViewStudentAsync(studentId, Caller, ct)
            ? Ok(new ApiResponse<BadgeDto>(true, await _learner.BadgeAsync(studentId, courseId, ct)))
            : NotFound(new ApiResponse<BadgeDto>(false, null, "Öğrenci bulunamadı."));

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<ChildSummaryDto>>> Summary(Guid studentId, CancellationToken ct) =>
        (await _teaching.ChildSummaryAsync(Caller, studentId, ct)).ToActionResult(this);

    [HttpGet("assignments")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AssignmentDto>>>> Assignments(Guid studentId, [FromQuery] bool done, CancellationToken ct) =>
        (await _teaching.StudentAssignmentsAsync(Caller, studentId, done, ct)).ToActionResult(this);

    [HttpGet("exams/{examId:guid}/report")]
    public async Task<ActionResult<ApiResponse<ExamReportDto>>> ExamReport(Guid studentId, Guid examId, CancellationToken ct) =>
        (await _teaching.ExamReportAsync(Caller, studentId, examId, ct)).ToActionResult(this);
}

/// <summary>Teachers: topic assignments and mixed skill checks for their own classrooms.</summary>
[ApiController]
[Route("api/kampus/teacher")]
[Authorize(Roles = UserRoles.ContentManagers)]
public sealed class KampusTeacherController : ControllerBase
{
    private readonly KampusTeachingService _teaching;

    public KampusTeacherController(KampusTeachingService teaching)
    {
        _teaching = teaching;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost("assignments")]
    public async Task<ActionResult<ApiResponse<AssignmentDto>>> CreateAssignment([FromBody] CreateAssignmentRequest request, CancellationToken ct) =>
        (await _teaching.CreateAssignmentAsync(Caller, request, ct)).ToActionResult(this, "Ödev verildi");

    [HttpGet("assignments")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AssignmentDto>>>> Assignments(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<AssignmentDto>>(true, await _teaching.TeacherAssignmentsAsync(Caller, ct)));

    [HttpGet("assignments/{id:guid}/results")]
    public async Task<ActionResult<ApiResponse<AssignmentResultsDto>>> AssignmentResults(Guid id, CancellationToken ct) =>
        (await _teaching.AssignmentResultsAsync(Caller, id, ct)).ToActionResult(this);

    [HttpPost("process-checks")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> CreateProcessCheck([FromBody] CreateProcessCheckRequest request, CancellationToken ct)
    {
        var name = $"{User.FindFirst("firstName")?.Value} {User.FindFirst("lastName")?.Value}".Trim();
        return (await _teaching.CreateProcessCheckAsync(Caller, request, name, ct)).ToActionResult(this, "Değerlendirme atandı");
    }

    [HttpGet("process-checks")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ExamDto>>>> ProcessChecks(CancellationToken ct) =>
        Ok(new ApiResponse<IReadOnlyList<ExamDto>>(true, await _teaching.ProcessChecksOfAsync(Caller, ct)));

    [HttpGet("process-checks/{id:guid}/results")]
    public async Task<ActionResult<ApiResponse<ProcessCheckResultsDto>>> ProcessCheckResults(Guid id, CancellationToken ct) =>
        (await _teaching.ProcessCheckResultsAsync(Caller, id, ct)).ToActionResult(this);
}

/// <summary>Administrators publish Tema / Ünite değerlendirmeleri for a grade.</summary>
[ApiController]
[Route("api/kampus/admin")]
[Authorize(Roles = UserRoles.Administrators)]
public sealed class KampusAdminController : ControllerBase
{
    private readonly KampusTeachingService _teaching;

    public KampusAdminController(KampusTeachingService teaching)
    {
        _teaching = teaching;
    }

    [HttpPost("exams")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> CreateThemeExam([FromBody] CreateThemeExamRequest request, CancellationToken ct) =>
        (await _teaching.CreateThemeExamAsync(User.GetCaller(), request, ct)).ToActionResult(this, "Değerlendirme yayımlandı");
}
