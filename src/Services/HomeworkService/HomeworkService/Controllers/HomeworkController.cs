using HomeworkService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

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

    private Caller Caller => User.GetCaller();

    [HttpPost]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> CreateHomework([FromBody] CreateHomeworkRequest request, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.CreateHomeworkAsync(request, Caller, cancellationToken);

        if (result == null)
            return BadRequest(new ApiResponse<HomeworkDto>(false, null, "Failed to create homework"));

        return Ok(new ApiResponse<HomeworkDto>(true, result, "Homework created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<HomeworkDto>>>> GetHomeworks(
        [FromQuery] Guid? classroomId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _homeworkService.GetHomeworksAsync(classroomId, new PagedRequest(page, pageSize), Caller, cancellationToken);
        return Ok(new ApiResponse<PagedResponse<HomeworkDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> GetHomework(Guid id, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.GetHomeworkAsync(id, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<HomeworkDto>(false, null, "Homework not found"));

        return Ok(new ApiResponse<HomeworkDto>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<HomeworkDto>>> UpdateHomework(Guid id, [FromBody] UpdateHomeworkRequest request, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.UpdateHomeworkAsync(id, request, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<HomeworkDto>(false, null, "Homework not found"));

        return Ok(new ApiResponse<HomeworkDto>(true, result, "Homework updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteHomework(Guid id, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.DeleteHomeworkAsync(id, Caller, cancellationToken);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Homework not found"));

        return Ok(new ApiResponse<bool>(true, true, "Homework deleted successfully"));
    }

    [HttpPost("{id}/submit")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> SubmitHomework(Guid id, [FromBody] SubmitHomeworkRequest request, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.SubmitHomeworkAsync(id, request, Caller, cancellationToken);

        if (result == null)
            return BadRequest(new ApiResponse<SubmissionDto>(false, null, "Failed to submit homework. The due date may have passed or it may already be graded."));

        return Ok(new ApiResponse<SubmissionDto>(true, result, "Homework submitted successfully"));
    }

    [HttpGet("{id}/my-submission")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> GetMySubmission(Guid id, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.GetSubmissionAsync(id, Caller.UserId, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<SubmissionDto>(false, null, "Submission not found"));

        return Ok(new ApiResponse<SubmissionDto>(true, result));
    }

    [HttpGet("{id}/submissions")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<List<SubmissionDto>>>> GetSubmissions(Guid id, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.GetSubmissionsAsync(id, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<List<SubmissionDto>>(false, null, "Homework not found"));

        return Ok(new ApiResponse<List<SubmissionDto>>(true, result));
    }

    [HttpPost("submissions/{submissionId}/grade")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> GradeSubmission(Guid submissionId, [FromBody] GradeSubmissionRequest request, CancellationToken cancellationToken)
    {
        var result = await _homeworkService.GradeSubmissionAsync(submissionId, request, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<SubmissionDto>(false, null, "Submission not found"));

        return Ok(new ApiResponse<SubmissionDto>(true, result, "Submission graded successfully"));
    }
}
