using ExamService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using System.Security.Claims;

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

    [HttpPost]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> CreateExam([FromBody] CreateExamRequest request)
    {
        var instructorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _examService.CreateExamAsync(request, instructorId);

        if (result == null)
            return BadRequest(new ApiResponse<ExamDto>(false, null, "Failed to create exam"));

        return Ok(new ApiResponse<ExamDto>(true, result, "Exam created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<ExamDto>>>> GetExams(
        [FromQuery] Guid? classroomId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _examService.GetExamsAsync(classroomId, new PagedRequest(page, pageSize));
        return Ok(new ApiResponse<PagedResponse<ExamDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> GetExam(Guid id)
    {
        var result = await _examService.GetExamAsync(id);

        if (result == null)
            return NotFound(new ApiResponse<ExamDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<ExamDto>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<ExamDto>>> UpdateExam(Guid id, [FromBody] UpdateExamRequest request)
    {
        var result = await _examService.UpdateExamAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<ExamDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<ExamDto>(true, result, "Exam updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteExam(Guid id)
    {
        var result = await _examService.DeleteExamAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Exam not found"));

        return Ok(new ApiResponse<bool>(true, true, "Exam deleted successfully"));
    }

    [HttpPost("{id}/publish")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> PublishExam(Guid id)
    {
        var result = await _examService.PublishExamAsync(id);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot publish exam. Make sure it has questions."));

        return Ok(new ApiResponse<bool>(true, true, "Exam published successfully"));
    }

    [HttpGet("{id}/questions")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<List<QuestionWithAnswerDto>>>> GetQuestions(Guid id)
    {
        var result = await _examService.GetQuestionsAsync(id);
        return Ok(new ApiResponse<List<QuestionWithAnswerDto>>(true, result));
    }

    [HttpPost("{id}/questions")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<QuestionWithAnswerDto>>> AddQuestion(Guid id, [FromBody] CreateQuestionRequest request)
    {
        var result = await _examService.AddQuestionAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<QuestionWithAnswerDto>(false, null, "Exam not found"));

        return Ok(new ApiResponse<QuestionWithAnswerDto>(true, result, "Question added successfully"));
    }

    [HttpPut("questions/{questionId}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateQuestion(Guid questionId, [FromBody] UpdateQuestionRequest request)
    {
        var result = await _examService.UpdateQuestionAsync(questionId, request);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Question not found"));

        return Ok(new ApiResponse<bool>(true, true, "Question updated successfully"));
    }

    [HttpDelete("questions/{questionId}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteQuestion(Guid questionId)
    {
        var result = await _examService.DeleteQuestionAsync(questionId);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Question not found"));

        return Ok(new ApiResponse<bool>(true, true, "Question deleted successfully"));
    }
}
