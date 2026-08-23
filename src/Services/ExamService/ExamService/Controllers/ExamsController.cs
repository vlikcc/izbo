using ExamService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ExamService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExamsController : ControllerBase
{
    private readonly IExamManagementService _examService;
    private readonly ILogger<ExamsController> _logger;

    public ExamsController(IExamManagementService examService, ILogger<ExamsController> logger)
    {
        _examService = examService;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ExamDto>>> CreateExam([FromBody] CreateExamRequest request, CancellationToken cancellationToken)
    {
        var result = await _examService.CreateExamAsync(request, Caller, cancellationToken);

        if (result == null)
            return BadRequest(new ApiResponse<ExamDto>(false, null, "Failed to create exam"));

        return Ok(new ApiResponse<ExamDto>(true, result, "Exam created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<ExamDto>>>> GetExams(
        [FromQuery] Guid? classroomId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _examService.GetExamsAsync(classroomId, new PagedRequest(page, pageSize), Caller, cancellationToken);
        return Ok(new ApiResponse<PagedResponse<ExamDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> GetExam(Guid id, CancellationToken cancellationToken)
    {
        var result = await _examService.GetExamAsync(id, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<ExamDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<ExamDto>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ExamDto>>> UpdateExam(Guid id, [FromBody] UpdateExamRequest request, CancellationToken cancellationToken)
    {
        var result = await _examService.UpdateExamAsync(id, request, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<ExamDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<ExamDto>(true, result, "Exam updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteExam(Guid id, CancellationToken cancellationToken)
    {
        var result = await _examService.DeleteExamAsync(id, Caller, cancellationToken);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Exam not found"));

        return Ok(new ApiResponse<bool>(true, true, "Exam deleted successfully"));
    }

    [HttpPost("{id}/publish")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> PublishExam(Guid id, CancellationToken cancellationToken)
    {
        var result = await _examService.PublishExamAsync(id, Caller, cancellationToken);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot publish exam. Make sure it has questions."));

        return Ok(new ApiResponse<bool>(true, true, "Exam published successfully"));
    }

    [HttpGet("{id}/questions")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<List<QuestionWithAnswerDto>>>> GetQuestions(Guid id, CancellationToken cancellationToken)
    {
        var result = await _examService.GetQuestionsAsync(id, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<List<QuestionWithAnswerDto>>(false, null, "Exam not found"));

        return Ok(new ApiResponse<List<QuestionWithAnswerDto>>(true, result));
    }

    [HttpPost("{id}/questions")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<QuestionWithAnswerDto>>> AddQuestion(Guid id, [FromBody] CreateQuestionRequest request, CancellationToken cancellationToken)
    {
        var result = await _examService.AddQuestionAsync(id, request, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<QuestionWithAnswerDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<QuestionWithAnswerDto>(true, result, "Question added successfully"));
    }

    [HttpPut("questions/{questionId}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateQuestion(Guid questionId, [FromBody] UpdateQuestionRequest request, CancellationToken cancellationToken)
    {
        var result = await _examService.UpdateQuestionAsync(questionId, request, Caller, cancellationToken);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Question not found"));

        return Ok(new ApiResponse<bool>(true, true, "Question updated successfully"));
    }

    [HttpDelete("questions/{questionId}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteQuestion(Guid questionId, CancellationToken cancellationToken)
    {
        var result = await _examService.DeleteQuestionAsync(questionId, Caller, cancellationToken);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Question not found"));

        return Ok(new ApiResponse<bool>(true, true, "Question deleted successfully"));
    }
}
