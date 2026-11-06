using ContentService.Services;
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

    public PublicContentController(ICurriculumService curriculum, IContentItemService items, IContentStorage storage)
    {
        _curriculum = curriculum;
        _items = items;
        _storage = storage;
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
}
