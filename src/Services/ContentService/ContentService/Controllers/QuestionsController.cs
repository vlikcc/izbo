using ContentService.Services.Questions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Controllers;

/// <summary>
/// The question bank: teachers and administrators write questions tied to the curriculum; teachers'
/// questions reach the bank through administrator review, the same way their content does.
/// Students never read the bank directly — they meet questions inside tests, without the answer key.
/// </summary>
[ApiController]
[Route("api/content/questions")]
[Authorize(Roles = UserRoles.ContentManagers)]
public class QuestionsController : ControllerBase
{
    private const long MaxImportBytes = 10 * 1024 * 1024;

    private readonly IQuestionBankService _questions;

    public QuestionsController(IQuestionBankService questions) => _questions = questions;

    private Caller Caller => User.GetCaller();

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<BankQuestionDto>>>> List(
        [FromQuery] Guid? levelId,
        [FromQuery] Guid? subjectId,
        [FromQuery] Guid? unitId,
        [FromQuery] Guid? topicId,
        [FromQuery] Guid? outcomeId,
        [FromQuery] QuestionDifficulty? difficulty,
        [FromQuery] ContentStatus? status,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new QuestionListQuery(levelId, subjectId, unitId, topicId, outcomeId, difficulty, status, mine, search, page, pageSize);
        return Ok(new ApiResponse<PagedResponse<BankQuestionDto>>(true, await _questions.ListAsync(query, Caller, cancellationToken)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Get(Guid id, CancellationToken cancellationToken) =>
        (await _questions.GetAsync(id, Caller, cancellationToken)).ToActionResult(this);

    [HttpPost]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Create([FromBody] SaveBankQuestionRequest request, CancellationToken cancellationToken) =>
        (await _questions.CreateAsync(request, Caller, cancellationToken)).ToActionResult(this, "Question created");

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Update(Guid id, [FromBody] SaveBankQuestionRequest request, CancellationToken cancellationToken) =>
        (await _questions.UpdateAsync(id, request, Caller, cancellationToken)).ToActionResult(this, "Question updated");

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        (await _questions.DeleteAsync(id, Caller, cancellationToken)).ToActionResult(this, "Question deleted");

    // ---- Review workflow ----

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Submit(Guid id, CancellationToken cancellationToken) =>
        (await _questions.SubmitAsync(id, Caller, cancellationToken)).ToActionResult(this, "Submitted for review");

    [HttpPost("{id:guid}/review")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Review(Guid id, [FromBody] ReviewContentRequest request, CancellationToken cancellationToken) =>
        (await _questions.ReviewAsync(id, request, Caller, cancellationToken)).ToActionResult(this, "Review recorded");

    [HttpPost("{id:guid}/publish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Publish(Guid id, CancellationToken cancellationToken) =>
        (await _questions.PublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Published");

    [HttpPost("{id:guid}/unpublish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<BankQuestionDto>>> Unpublish(Guid id, CancellationToken cancellationToken) =>
        (await _questions.UnpublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Unpublished");

    [HttpGet("review-queue")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<PagedResponse<BankQuestionDto>>>> ReviewQueue(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<PagedResponse<BankQuestionDto>>(
            true, await _questions.GetReviewQueueAsync(new PagedRequest(page, pageSize), cancellationToken)));

    // ---- Images and import ----

    /// <summary>A PNG, JPEG or WebP for a question or option, at most 2 MB. Returns the asset id to reference.</summary>
    [HttpPost("assets")]
    [RequestSizeLimit(QuestionImageRules.MaxBytes + (256 * 1024))]
    [RequestFormLimits(MultipartBodyLengthLimit = QuestionImageRules.MaxBytes + (256 * 1024))]
    public async Task<ActionResult<ApiResponse<QuestionAssetDto>>> UploadAsset(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<QuestionAssetDto>(false, null, "No file provided"));
        }

        await using var stream = file.OpenReadStream();
        return (await _questions.UploadAssetAsync(stream, file.FileName, Caller, cancellationToken)).ToActionResult(this, "Image uploaded");
    }

    /// <summary>
    /// Imports an .xlsx or .csv with columns Seviye, Ders, Ünite, Konu, Kazanım Kodu, Soru, A–E, Doğru,
    /// Zorluk, Açıklama into the existing curriculum. Any invalid row rejects the whole file (400 with the
    /// row errors); <paramref name="dryRun"/> reports what would change without writing.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Roles = UserRoles.Administrators)]
    [RequestSizeLimit(MaxImportBytes + (1024 * 1024))]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxImportBytes + (1024 * 1024))]
    public async Task<ActionResult<ApiResponse<QuestionImportResult>>> Import(
        IFormFile file,
        [FromQuery] bool dryRun = false,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<QuestionImportResult>(false, null, "No file provided"));
        }

        if (file.Length > MaxImportBytes)
        {
            return BadRequest(new ApiResponse<QuestionImportResult>(false, null, "The file is larger than 10 MB"));
        }

        // The xlsx reader needs a seekable stream; 10 MB is small enough to hold.
        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        var result = await _questions.ImportAsync(buffer, file.FileName, dryRun, Caller, cancellationToken);
        if (result.IsOk && result.Value!.Errors.Count > 0)
        {
            return BadRequest(new ApiResponse<QuestionImportResult>(
                false, result.Value, "The file has invalid rows; nothing was imported",
                result.Value.Errors.Select(e => $"Row {e.Row}: {e.Message}").ToList()));
        }

        return result.ToActionResult(this, dryRun ? "Dry run complete; nothing was written" : "Questions imported");
    }
}
