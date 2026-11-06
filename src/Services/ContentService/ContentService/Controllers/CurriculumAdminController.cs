using ContentService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ContentService.Controllers;

/// <summary>Curriculum editing and spreadsheet import. Administrators only.</summary>
[ApiController]
[Route("api/content/curriculum")]
[Authorize(Roles = UserRoles.Administrators)]
public class CurriculumAdminController : ControllerBase
{
    private const long MaxImportBytes = 10 * 1024 * 1024;

    private readonly ICurriculumService _curriculum;

    public CurriculumAdminController(ICurriculumService curriculum) => _curriculum = curriculum;

    private Caller Caller => User.GetCaller();

    [HttpPost("subjects")]
    public async Task<ActionResult<ApiResponse<SubjectDto>>> CreateSubject([FromBody] CreateSubjectRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.CreateSubjectAsync(request, cancellationToken)).ToActionResult(this, "Subject created");

    [HttpPut("subjects/{id:guid}")]
    public async Task<ActionResult<ApiResponse<SubjectDto>>> UpdateSubject(Guid id, [FromBody] UpdateSubjectRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.UpdateSubjectAsync(id, request, cancellationToken)).ToActionResult(this, "Subject updated");

    [HttpDelete("subjects/{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteSubject(Guid id, CancellationToken cancellationToken) =>
        (await _curriculum.DeleteSubjectAsync(id, Caller, cancellationToken)).ToActionResult(this, "Subject deleted");

    [HttpPost("units")]
    public async Task<ActionResult<ApiResponse<CurriculumUnitDto>>> CreateUnit([FromBody] CreateUnitRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.CreateUnitAsync(request, cancellationToken)).ToActionResult(this, "Unit created");

    [HttpPut("units/{id:guid}")]
    public async Task<ActionResult<ApiResponse<CurriculumUnitDto>>> UpdateUnit(Guid id, [FromBody] UpdateUnitRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.UpdateUnitAsync(id, request, cancellationToken)).ToActionResult(this, "Unit updated");

    [HttpDelete("units/{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteUnit(Guid id, CancellationToken cancellationToken) =>
        (await _curriculum.DeleteUnitAsync(id, Caller, cancellationToken)).ToActionResult(this, "Unit deleted");

    [HttpPost("topics")]
    public async Task<ActionResult<ApiResponse<TopicDto>>> CreateTopic([FromBody] CreateTopicRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.CreateTopicAsync(request, cancellationToken)).ToActionResult(this, "Topic created");

    [HttpPut("topics/{id:guid}")]
    public async Task<ActionResult<ApiResponse<TopicDto>>> UpdateTopic(Guid id, [FromBody] UpdateTopicRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.UpdateTopicAsync(id, request, cancellationToken)).ToActionResult(this, "Topic updated");

    [HttpDelete("topics/{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTopic(Guid id, CancellationToken cancellationToken) =>
        (await _curriculum.DeleteTopicAsync(id, Caller, cancellationToken)).ToActionResult(this, "Topic deleted");

    [HttpPost("outcomes")]
    public async Task<ActionResult<ApiResponse<LearningOutcomeDto>>> CreateOutcome([FromBody] CreateOutcomeRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.CreateOutcomeAsync(request, cancellationToken)).ToActionResult(this, "Outcome created");

    [HttpPut("outcomes/{id:guid}")]
    public async Task<ActionResult<ApiResponse<LearningOutcomeDto>>> UpdateOutcome(Guid id, [FromBody] UpdateOutcomeRequest request, CancellationToken cancellationToken) =>
        (await _curriculum.UpdateOutcomeAsync(id, request, cancellationToken)).ToActionResult(this, "Outcome updated");

    [HttpDelete("outcomes/{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteOutcome(Guid id, CancellationToken cancellationToken) =>
        (await _curriculum.DeleteOutcomeAsync(id, Caller, cancellationToken)).ToActionResult(this, "Outcome deleted");

    /// <summary>
    /// Imports an .xlsx or .csv with columns Seviye, Ders, Ünite, Konu, Kazanım Kodu, Açıklama. Re-running
    /// the same file changes nothing. Any invalid row rejects the whole file (400 with the row errors);
    /// <paramref name="dryRun"/> reports what would change without writing.
    /// </summary>
    [HttpPost("import")]
    [RequestSizeLimit(MaxImportBytes + (1024 * 1024))]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxImportBytes + (1024 * 1024))]
    public async Task<ActionResult<ApiResponse<CurriculumImportResult>>> Import(
        IFormFile file,
        [FromQuery] bool dryRun = false,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<CurriculumImportResult>(false, null, "No file provided"));
        }

        if (file.Length > MaxImportBytes)
        {
            return BadRequest(new ApiResponse<CurriculumImportResult>(false, null, "The file is larger than 10 MB"));
        }

        // The xlsx reader needs a seekable stream; 10 MB is small enough to hold.
        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        var result = await _curriculum.ImportAsync(buffer, file.FileName, dryRun, Caller, cancellationToken);
        if (result.IsOk && result.Value!.Errors.Count > 0)
        {
            return BadRequest(new ApiResponse<CurriculumImportResult>(
                false, result.Value, "The file has invalid rows; nothing was imported",
                result.Value.Errors.Select(e => $"Row {e.Row}: {e.Message}").ToList()));
        }

        return result.ToActionResult(this, dryRun ? "Dry run complete; nothing was written" : "Curriculum imported");
    }
}
