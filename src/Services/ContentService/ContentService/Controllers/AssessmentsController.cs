using ContentService.Services.Assessments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ContentService.Controllers;

/// <summary>Mock exams and placement tests: learners list them; administrators build and publish them.</summary>
[ApiController]
[Route("api/content/assessments")]
[Authorize]
public class AssessmentsController : ControllerBase
{
    private readonly IAssessmentService _assessments;

    public AssessmentsController(IAssessmentService assessments) => _assessments = assessments;

    private Caller Caller => User.GetCaller();

    /// <summary>Published tests for the comma-separated level slugs (e.g. <c>8-sinif,lgs</c>); all levels when empty.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<AssessmentSummaryDto>>>> List([FromQuery] string? levels, CancellationToken cancellationToken)
    {
        var slugs = (levels ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return Ok(new ApiResponse<List<AssessmentSummaryDto>>(true, await _assessments.ListForLearnerAsync(slugs, Caller, cancellationToken)));
    }

    [HttpGet("admin")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<PagedResponse<AssessmentSummaryDto>>>> ListAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<PagedResponse<AssessmentSummaryDto>>(true, await _assessments.ListAllAsync(new PagedRequest(page, pageSize), cancellationToken)));

    [HttpGet("{id:guid}/admin")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> Detail(Guid id, CancellationToken cancellationToken) =>
        (await _assessments.GetDetailAsync(id, cancellationToken)).ToActionResult(this);

    [HttpPost]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> Create([FromBody] SaveAssessmentRequest request, CancellationToken cancellationToken) =>
        (await _assessments.CreateAsync(request, Caller, cancellationToken)).ToActionResult(this, "Test created");

    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> Update(Guid id, [FromBody] SaveAssessmentRequest request, CancellationToken cancellationToken) =>
        (await _assessments.UpdateAsync(id, request, cancellationToken)).ToActionResult(this, "Test updated");

    [HttpPut("{id:guid}/sections")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> SaveSections(Guid id, [FromBody] SaveSectionsRequest request, CancellationToken cancellationToken) =>
        (await _assessments.SaveSectionsAsync(id, request, cancellationToken)).ToActionResult(this, "Questions saved");

    [HttpPost("{id:guid}/publish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> Publish(Guid id, CancellationToken cancellationToken) =>
        (await _assessments.PublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Published");

    [HttpPost("{id:guid}/unpublish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<AssessmentDetailDto>>> Unpublish(Guid id, CancellationToken cancellationToken) =>
        (await _assessments.UnpublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Unpublished");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        (await _assessments.DeleteAsync(id, Caller, cancellationToken)).ToActionResult(this, "Test deleted");

    [HttpPost("suggest-questions")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<List<Guid>>>> Suggest([FromBody] SuggestQuestionsRequest request, CancellationToken cancellationToken) =>
        Ok(new ApiResponse<List<Guid>>(true, await _assessments.SuggestQuestionsAsync(request, cancellationToken)));
}
