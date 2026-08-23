using ExamService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ExamService.Controllers;

[ApiController]
[Route("api/exam-sessions")]
[Authorize]
public class ExamSessionController : ControllerBase
{
    private readonly IExamSessionService _sessionService;
    private readonly ILogger<ExamSessionController> _logger;

    public ExamSessionController(IExamSessionService sessionService, ILogger<ExamSessionController> logger)
    {
        _sessionService = sessionService;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost("start/{examId}")]
    public async Task<ActionResult<ApiResponse<StartExamResponse>>> StartExam(Guid examId, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _sessionService.StartExamAsync(examId, Caller, ipAddress, userAgent, cancellationToken);

        if (result == null)
            return BadRequest(new ApiResponse<StartExamResponse>(false, null, "Cannot start exam. Check if exam is available."));

        return Ok(new ApiResponse<StartExamResponse>(true, result, "Exam started successfully"));
    }

    [HttpPost("{sessionId}/answer")]
    public async Task<ActionResult<ApiResponse<bool>>> SaveAnswer(Guid sessionId, [FromBody] SubmitAnswerRequest request, CancellationToken cancellationToken)
    {
        var result = await _sessionService.SaveAnswerAsync(sessionId, request.QuestionId, request.Answer, Caller, cancellationToken);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Failed to save answer"));

        return Ok(new ApiResponse<bool>(true, true, "Answer saved"));
    }

    [HttpPost("{sessionId}/submit")]
    public async Task<ActionResult<ApiResponse<ExamResultDto>>> SubmitExam(Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _sessionService.SubmitExamAsync(sessionId, Caller, cancellationToken);

        if (result == null)
            return BadRequest(new ApiResponse<ExamResultDto>(false, null, "Failed to submit exam"));

        return Ok(new ApiResponse<ExamResultDto>(true, result, "Exam submitted successfully"));
    }

    [HttpGet("my-sessions")]
    public async Task<ActionResult<ApiResponse<List<ExamSessionDto>>>> GetMySessions(CancellationToken cancellationToken)
    {
        var result = await _sessionService.GetStudentSessionsAsync(Caller.UserId, cancellationToken);
        return Ok(new ApiResponse<List<ExamSessionDto>>(true, result));
    }

    [HttpGet("{sessionId}")]
    public async Task<ActionResult<ApiResponse<ExamSessionDto>>> GetSession(Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _sessionService.GetSessionAsync(sessionId, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<ExamSessionDto>(false, null, "Session not found"));

        return Ok(new ApiResponse<ExamSessionDto>(true, result));
    }

    [HttpGet("{sessionId}/result")]
    public async Task<ActionResult<ApiResponse<ExamResultDto>>> GetResult(Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _sessionService.GetResultAsync(sessionId, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<ExamResultDto>(false, null, "Result not available"));

        return Ok(new ApiResponse<ExamResultDto>(true, result));
    }

    [HttpGet("exam/{examId}/active-count")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<int>>> GetActiveCount(Guid examId, CancellationToken cancellationToken)
    {
        var count = await _sessionService.GetActiveSessionCountAsync(examId, Caller, cancellationToken);
        return Ok(new ApiResponse<int>(true, count));
    }
}
