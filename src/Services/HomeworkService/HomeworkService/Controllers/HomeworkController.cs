using HomeworkService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using System.Security.Claims;

namespace HomeworkService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HomeworkController : ControllerBase
{
    private readonly IHomeworkManagementService _homeworkService;
    private readonly ILogger<HomeworkController> _logger;

    public HomeworkController(IHomeworkManagementService homeworkService, ILogger<HomeworkController> logger)
    {
        _homeworkService = homeworkService;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> CreateHomework([FromBody] CreateHomeworkRequest request)
    {
        var result = await _homeworkService.CreateHomeworkAsync(request);

        if (result == null)
            return BadRequest(new ApiResponse<HomeworkDto>(false, null, "Failed to create homework"));

        return Ok(new ApiResponse<HomeworkDto>(true, result, "Homework created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<HomeworkDto>>>> GetHomeworks(
        [FromQuery] Guid? classroomId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _homeworkService.GetHomeworksAsync(classroomId, new PagedRequest(page, pageSize));
        return Ok(new ApiResponse<PagedResponse<HomeworkDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> GetHomework(Guid id)
    {
        var result = await _homeworkService.GetHomeworkAsync(id);

        if (result == null)
            return NotFound(new ApiResponse<HomeworkDto>(false, null, "Homework not found"));

        return Ok(new ApiResponse<HomeworkDto>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> UpdateHomework(Guid id, [FromBody] UpdateHomeworkRequest request)
    {
        var result = await _homeworkService.UpdateHomeworkAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<HomeworkDto>(false, null, "Homework not found"));

        return Ok(new ApiResponse<HomeworkDto>(true, result, "Homework updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteHomework(Guid id)
    {
        var result = await _homeworkService.DeleteHomeworkAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Homework not found"));

        return Ok(new ApiResponse<bool>(true, true, "Homework deleted successfully"));
    }

    [HttpPost("{id}/submit")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> SubmitHomework(Guid id, [FromBody] SubmitHomeworkRequest request)
    {
        var studentId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _homeworkService.SubmitHomeworkAsync(id, studentId, request);

        if (result == null)
            return BadRequest(new ApiResponse<SubmissionDto>(false, null, "Failed to submit homework. Due date may have passed."));

        return Ok(new ApiResponse<SubmissionDto>(true, result, "Homework submitted successfully"));
    }

    [HttpGet("{id}/my-submission")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> GetMySubmission(Guid id)
    {
        var studentId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _homeworkService.GetSubmissionAsync(id, studentId);

        if (result == null)
            return NotFound(new ApiResponse<SubmissionDto>(false, null, "Submission not found"));

        return Ok(new ApiResponse<SubmissionDto>(true, result));
    }

    [HttpGet("{id}/submissions")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<List<SubmissionDto>>>> GetSubmissions(Guid id)
    {
        var result = await _homeworkService.GetSubmissionsAsync(id);
        return Ok(new ApiResponse<List<SubmissionDto>>(true, result));
    }

    [HttpPost("submissions/{submissionId}/grade")]
    [Authorize(Roles = "Instructor,Admin")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> GradeSubmission(Guid submissionId, [FromBody] GradeSubmissionRequest request)
    {
        var gradedBy = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _homeworkService.GradeSubmissionAsync(submissionId, request, gradedBy);

        if (result == null)
            return NotFound(new ApiResponse<SubmissionDto>(false, null, "Submission not found"));

        return Ok(new ApiResponse<SubmissionDto>(true, result, "Submission graded successfully"));
    }
}
