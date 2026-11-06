using ContentService.Services.Assessments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ContentService.Controllers;

/// <summary>
/// Taking tests and reading results. A student works on their own attempts; a linked parent and
/// administrators read results and mastery. Anyone else gets 404, so attempt and student ids can't be probed.
/// </summary>
[ApiController]
[Route("api/content")]
[Authorize]
public class AttemptsController : ControllerBase
{
    private readonly IAttemptService _attempts;
    private readonly IGuardianAccessClient _guardianAccess;

    public AttemptsController(IAttemptService attempts, IGuardianAccessClient guardianAccess)
    {
        _attempts = attempts;
        _guardianAccess = guardianAccess;
    }

    private Caller Caller => User.GetCaller();

    /// <summary>Starts a topic or unit test from the bank, or resumes the one already running.</summary>
    [HttpPost("practice")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> StartPractice([FromBody] StartPracticeRequest request, CancellationToken cancellationToken) =>
        (await _attempts.StartPracticeAsync(request, Caller, cancellationToken)).ToActionResult(this);

    [HttpPost("assessments/{id:guid}/start")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> StartAssessment(Guid id, CancellationToken cancellationToken) =>
        (await _attempts.StartAssessmentAsync(id, Caller, cancellationToken)).ToActionResult(this);

    [HttpGet("attempts/{id:guid}")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> Get(Guid id, CancellationToken cancellationToken) =>
        (await _attempts.GetAsync(id, Caller, cancellationToken)).ToActionResult(this);

    [HttpPut("attempts/{id:guid}/answers/{order:int}")]
    public async Task<ActionResult<ApiResponse<bool>>> SaveAnswer(Guid id, int order, [FromBody] SaveAnswerRequest request, CancellationToken cancellationToken) =>
        (await _attempts.SaveAnswerAsync(id, order, request, Caller, cancellationToken)).ToActionResult(this);

    [HttpPost("attempts/{id:guid}/submit")]
    public async Task<ActionResult<ApiResponse<AttemptSummaryDto>>> Submit(Guid id, CancellationToken cancellationToken) =>
        (await _attempts.SubmitAsync(id, Caller, cancellationToken)).ToActionResult(this, "Test finished");

    [HttpGet("attempts/{id:guid}/report")]
    public async Task<ActionResult<ApiResponse<AttemptReportDto>>> Report(Guid id, CancellationToken cancellationToken)
    {
        var owner = await _attempts.FindOwnerAsync(id, cancellationToken);
        if (owner is null || !await _guardianAccess.CanViewStudentAsync(owner.Value, Caller, cancellationToken))
        {
            return NotFound(new ApiResponse<AttemptReportDto>(false, null, "Attempt not found"));
        }

        var report = await _attempts.GetReportAsync(id, cancellationToken);
        return report is null
            ? NotFound(new ApiResponse<AttemptReportDto>(false, null, "Attempt not found"))
            : Ok(new ApiResponse<AttemptReportDto>(true, report));
    }

    [HttpGet("attempts/me")]
    public async Task<ActionResult<ApiResponse<List<AttemptSummaryDto>>>> Mine([FromQuery] int take = 20, CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<List<AttemptSummaryDto>>(true, await _attempts.ListForUserAsync(Caller.UserId, take, cancellationToken)));

    [HttpGet("attempts/student/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<List<AttemptSummaryDto>>>> ForStudent(Guid studentId, [FromQuery] int take = 10, CancellationToken cancellationToken = default)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller, cancellationToken))
        {
            return NotFound(new ApiResponse<List<AttemptSummaryDto>>(false, null, "Student not found"));
        }

        return Ok(new ApiResponse<List<AttemptSummaryDto>>(true, await _attempts.ListForUserAsync(studentId, take, cancellationToken)));
    }

    /// <summary>Per-topic success over the last <paramref name="days"/> days, optionally for one subject.</summary>
    [HttpGet("mastery/me")]
    public async Task<ActionResult<ApiResponse<MasteryDto>>> MyMastery(
        [FromQuery] Guid? subjectId, [FromQuery] int days = 90, CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<MasteryDto>(true, await _attempts.GetMasteryAsync(Caller.UserId, subjectId, days, cancellationToken)));

    [HttpGet("mastery/student/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<MasteryDto>>> StudentMastery(
        Guid studentId, [FromQuery] Guid? subjectId, [FromQuery] int days = 90, CancellationToken cancellationToken = default)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller, cancellationToken))
        {
            return NotFound(new ApiResponse<MasteryDto>(false, null, "Student not found"));
        }

        return Ok(new ApiResponse<MasteryDto>(true, await _attempts.GetMasteryAsync(studentId, subjectId, days, cancellationToken)));
    }
}
