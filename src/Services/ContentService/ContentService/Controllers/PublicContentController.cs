using ContentService.Services;
using ContentService.Services.Questions;
using ContentService.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;

namespace ContentService.Controllers;

/// <summary>
/// Unauthenticated catalogue data for the public level pages (/sinif/5-sinif, /lgs, /yks). Exposes only
/// published content: counts, names and thumbnails — never the media itself.
/// </summary>
[ApiController]
[Route("api/content/public")]
[AllowAnonymous]
public class PublicContentController : ControllerBase
{
    private const string PublicCache = "public, max-age=300";

    private readonly ICurriculumService _curriculum;
    private readonly IContentItemService _items;
    private readonly IContentStorage _storage;
    private readonly IQuestionBankService _questions;

    public PublicContentController(
        ICurriculumService curriculum,
        IContentItemService items,
        IContentStorage storage,
        IQuestionBankService questions)
    {
        _curriculum = curriculum;
        _items = items;
        _storage = storage;
        _questions = questions;
    }

    [HttpGet("levels")]
    public async Task<ActionResult<ApiResponse<List<LevelDto>>>> GetLevels(CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = PublicCache;
        return Ok(new ApiResponse<List<LevelDto>>(true, await _curriculum.GetPublicLevelsAsync(cancellationToken)));
    }

    [HttpGet("levels/{slug}")]
    public async Task<ActionResult<ApiResponse<PublicLevelDto>>> GetLevel(string slug, CancellationToken cancellationToken)
    {
        var level = await _curriculum.GetPublicLevelAsync(slug, cancellationToken);
        if (level is null)
        {
            return NotFound(new ApiResponse<PublicLevelDto>(false, null, "Level not found"));
        }

        Response.Headers.CacheControl = PublicCache;
        return Ok(new ApiResponse<PublicLevelDto>(true, level));
    }

    [HttpGet("items/{id:guid}/thumbnail")]
    public async Task<IActionResult> Thumbnail(Guid id, CancellationToken cancellationToken)
    {
        var item = await _items.FindPublishedAsync(id, cancellationToken);
        if (item?.ThumbnailKey is null)
        {
            return NotFound();
        }

        return await ContentItemsController.StreamThumbnailAsync(_storage, Response, item.ThumbnailKey, PublicCache, cancellationToken)
            ? new EmptyResult()
            : NotFound();
    }

    /// <summary>
    /// A question image. Public because <c>&lt;img&gt;</c> cannot send a bearer token; the id is random and only
    /// reaches a student inside a test. Assets never change once stored, so they cache for a year.
    /// </summary>
    [HttpGet("question-assets/{id:guid}")]
    public async Task<IActionResult> QuestionAsset(Guid id, CancellationToken cancellationToken)
    {
        var asset = await _questions.FindAssetAsync(id, cancellationToken);
        var stat = asset is null ? null : await _storage.StatAsync(asset.StorageKey, cancellationToken);
        if (asset is null || stat is null)
        {
            return NotFound();
        }

        Response.ContentType = asset.ContentType;
        Response.ContentLength = stat.Size;
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers.XContentTypeOptions = "nosniff";
        await _storage.CopyToAsync(asset.StorageKey, Response.Body, cancellationToken: cancellationToken);
        return new EmptyResult();
    }
}
