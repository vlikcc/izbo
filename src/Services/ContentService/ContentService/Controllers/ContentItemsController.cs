using ContentService.Services;
using ContentService.Services.Media;
using ContentService.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Controllers;

[ApiController]
[Route("api/content")]
[Authorize]
public class ContentItemsController : ControllerBase
{
    private readonly IContentItemService _items;
    private readonly IContentStorage _storage;
    private readonly IGuardianAccessClient _guardianAccess;
    private readonly ContentOptions _options;
    private readonly ILogger<ContentItemsController> _logger;

    public ContentItemsController(
        IContentItemService items,
        IContentStorage storage,
        IOptions<ContentOptions> options,
        IGuardianAccessClient guardianAccess,
        ILogger<ContentItemsController> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _items = items;
        _storage = storage;
        _guardianAccess = guardianAccess;
        _options = options.Value;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    // ---- Authoring ----

    [HttpPost("items")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Create([FromBody] CreateContentItemRequest request, CancellationToken cancellationToken) =>
        (await _items.CreateAsync(request, Caller, cancellationToken)).ToActionResult(this, "Content created");

    [HttpGet("items/mine")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<PagedResponse<ContentItemSummaryDto>>>> GetMine(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<PagedResponse<ContentItemSummaryDto>>(
            true, await _items.GetMineAsync(Caller, new PagedRequest(page, pageSize), cancellationToken)));

    [HttpGet("items/{id:guid}")]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Get(Guid id, CancellationToken cancellationToken) =>
        (await _items.GetAsync(id, Caller, cancellationToken)).ToActionResult(this);

    [HttpPut("items/{id:guid}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Update(Guid id, [FromBody] UpdateContentItemRequest request, CancellationToken cancellationToken) =>
        (await _items.UpdateAsync(id, request, Caller, cancellationToken)).ToActionResult(this, "Content updated");

    [HttpDelete("items/{id:guid}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        (await _items.DeleteAsync(id, Caller, cancellationToken)).ToActionResult(this, "Content deleted");

    /// <summary>
    /// Multipart upload streamed straight to object storage — the body is never buffered in memory or on
    /// disk here, so multi-gigabyte lesson videos do not need matching RAM. Limit: Content:MaxUploadMb.
    /// </summary>
    [HttpPost("items/{id:guid}/upload")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    [DisableRequestSizeLimit]
    [DisableFormValueModelBinding]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Upload(Guid id, CancellationToken cancellationToken)
    {
        var maxBytes = _options.MaxUploadBytes;
        var envelope = maxBytes + (1024 * 1024);

        var sizeFeature = HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (sizeFeature is { IsReadOnly: false })
        {
            sizeFeature.MaxRequestBodySize = envelope;
        }

        if (Request.ContentLength > envelope)
        {
            return TooLarge(maxBytes);
        }

        if (!MediaTypeHeaderValue.TryParse(Request.ContentType, out var mediaType) ||
            !mediaType.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<ContentItemDto>(false, null, "Send the file as multipart/form-data"));
        }

        var boundary = HeaderUtilities.RemoveQuotes(mediaType.Boundary).Value;
        if (string.IsNullOrWhiteSpace(boundary) || boundary.Length > 200)
        {
            return BadRequest(new ApiResponse<ContentItemDto>(false, null, "Missing multipart boundary"));
        }

        var reader = new MultipartReader(boundary, Request.Body) { BodyLengthLimit = maxBytes };

        try
        {
            MultipartSection? section;
            while ((section = await reader.ReadNextSectionAsync(cancellationToken)) is not null)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition) ||
                    !disposition.IsFileDisposition())
                {
                    continue;
                }

                var fileName = disposition.FileNameStar.HasValue
                    ? disposition.FileNameStar.Value
                    : HeaderUtilities.RemoveQuotes(disposition.FileName).Value;

                var result = await _items.UploadAsync(id, section.Body, fileName ?? string.Empty, Caller, cancellationToken);
                return result.ToActionResult(this, "File uploaded");
            }
        }
        catch (UploadTooLargeException)
        {
            return TooLarge(maxBytes);
        }
        catch (InvalidDataException ex)
        {
            // MultipartReader reports malformed bodies and its own length limit this way.
            _logger.LogWarning(ex, "Rejected malformed upload for content item {ItemId}", id);
            return ex.Message.Contains("length limit", StringComparison.OrdinalIgnoreCase)
                ? TooLarge(maxBytes)
                : BadRequest(new ApiResponse<ContentItemDto>(false, null, "The upload is not valid multipart data"));
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return TooLarge(maxBytes);
        }
        catch (ContentStorageException ex)
        {
            _logger.LogError(ex, "Upload for content item {ItemId} could not be stored", id);
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiResponse<ContentItemDto>(false, null, "Dosya şu anda kaydedilemedi. Lütfen tekrar deneyin."));
        }

        return BadRequest(new ApiResponse<ContentItemDto>(false, null, "No file part in the request"));
    }

    [HttpPost("items/{id:guid}/retry-processing")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> RetryProcessing(Guid id, CancellationToken cancellationToken) =>
        (await _items.RetryProcessingAsync(id, Caller, cancellationToken)).ToActionResult(this, "Queued for processing");

    // ---- Review workflow ----

    [HttpPost("items/{id:guid}/submit")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Submit(Guid id, CancellationToken cancellationToken) =>
        (await _items.SubmitAsync(id, Caller, cancellationToken)).ToActionResult(this, "Submitted for review");

    [HttpPost("items/{id:guid}/review")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Review(Guid id, [FromBody] ReviewContentRequest request, CancellationToken cancellationToken) =>
        (await _items.ReviewAsync(id, request, Caller, cancellationToken)).ToActionResult(this, "Review recorded");

    [HttpPost("items/{id:guid}/publish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Publish(Guid id, CancellationToken cancellationToken) =>
        (await _items.PublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Published");

    [HttpPost("items/{id:guid}/unpublish")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<ContentItemDto>>> Unpublish(Guid id, CancellationToken cancellationToken) =>
        (await _items.UnpublishAsync(id, Caller, cancellationToken)).ToActionResult(this, "Unpublished");

    [HttpGet("review-queue")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<PagedResponse<ContentItemDto>>>> ReviewQueue(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<PagedResponse<ContentItemDto>>(
            true, await _items.GetReviewQueueAsync(new PagedRequest(page, pageSize), cancellationToken)));

    // ---- Playback ----

    /// <summary>
    /// HLS playlists and segments, streamed from object storage behind the same access check as the item.
    /// Only flat names the transcoder produces are accepted, so the path can never leave the item's prefix.
    /// </summary>
    [HttpGet("items/{id:guid}/hls/{file}")]
    public async Task<IActionResult> Hls(Guid id, string file, CancellationToken cancellationToken)
    {
        if (!HlsFileName.IsValid(file))
        {
            return NotFound();
        }

        var item = await _items.FindViewableAsync(id, Caller, cancellationToken);
        if (item is null || !item.IsVideo || item.ProcessingStatus != ContentProcessingStatus.Ready || item.HlsPrefix is null)
        {
            return NotFound();
        }

        var key = item.HlsPrefix + file;
        var stat = await _storage.StatAsync(key, cancellationToken);
        if (stat is null)
        {
            return NotFound();
        }

        Response.ContentType = HlsFileName.ContentTypeFor(file);
        Response.ContentLength = stat.Size;
        Response.Headers.CacheControl = "private, max-age=3600";
        Response.Headers.XContentTypeOptions = "nosniff";
        await _storage.CopyToAsync(key, Response.Body, cancellationToken: cancellationToken);
        return new EmptyResult();
    }

    /// <summary>The document itself (PDF), inline, with byte-range support for in-browser viewers.</summary>
    [HttpGet("items/{id:guid}/file")]
    public async Task<IActionResult> File(Guid id, CancellationToken cancellationToken)
    {
        var item = await _items.FindViewableAsync(id, Caller, cancellationToken);
        if (item is null || !item.IsDocument || item.ProcessingStatus != ContentProcessingStatus.Ready || item.StorageKey is null)
        {
            return NotFound();
        }

        var size = item.FileSize ?? (await _storage.StatAsync(item.StorageKey, cancellationToken))?.Size;
        if (size is null or <= 0)
        {
            return NotFound();
        }

        Response.Headers.AcceptRanges = "bytes";
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.CacheControl = "private, max-age=3600";
        Response.Headers.ContentDisposition = new ContentDispositionHeaderValue("inline")
        {
            FileNameStar = item.OriginalFileName ?? "document.pdf"
        }.ToString();

        var range = ByteRange.Parse(Request.Headers.Range, size.Value);
        if (range.Kind == ByteRangeKind.Unsatisfiable)
        {
            Response.Headers.ContentRange = $"bytes */{size.Value}";
            return StatusCode(StatusCodes.Status416RangeNotSatisfiable);
        }

        Response.ContentType = item.FileContentType ?? "application/pdf";

        if (range.Kind == ByteRangeKind.Partial)
        {
            Response.StatusCode = StatusCodes.Status206PartialContent;
            Response.Headers.ContentRange = $"bytes {range.Start}-{range.End}/{size.Value}";
            Response.ContentLength = range.Length;
            await _storage.CopyToAsync(item.StorageKey, Response.Body, range.Start, range.Length, cancellationToken);
        }
        else
        {
            Response.ContentLength = size.Value;
            await _storage.CopyToAsync(item.StorageKey, Response.Body, cancellationToken: cancellationToken);
        }

        return new EmptyResult();
    }

    [HttpGet("items/{id:guid}/thumbnail")]
    public async Task<IActionResult> Thumbnail(Guid id, CancellationToken cancellationToken)
    {
        var item = await _items.FindViewableAsync(id, Caller, cancellationToken);
        if (item?.ThumbnailKey is null)
        {
            return NotFound();
        }

        return await StreamThumbnailAsync(_storage, Response, item.ThumbnailKey, cacheControl: "private, max-age=3600", cancellationToken)
            ? new EmptyResult()
            : NotFound();
    }

    internal static async Task<bool> StreamThumbnailAsync(
        IContentStorage storage, HttpResponse response, string key, string cacheControl, CancellationToken cancellationToken)
    {
        var stat = await storage.StatAsync(key, cancellationToken);
        if (stat is null)
        {
            return false;
        }

        response.ContentType = "image/jpeg";
        response.ContentLength = stat.Size;
        response.Headers.CacheControl = cacheControl;
        response.Headers.XContentTypeOptions = "nosniff";
        await storage.CopyToAsync(key, response.Body, cancellationToken: cancellationToken);
        return true;
    }

    // ---- Progress ----

    [HttpPut("items/{id:guid}/progress")]
    public async Task<ActionResult<ApiResponse<ContentProgressDto>>> SaveProgress(Guid id, [FromBody] UpdateProgressRequest request, CancellationToken cancellationToken) =>
        (await _items.SaveProgressAsync(id, request, Caller, cancellationToken)).ToActionResult(this);

    /// <summary>The caller's five most recent unfinished items, newest first.</summary>
    [HttpGet("progress/continue")]
    public async Task<ActionResult<ApiResponse<List<ContinueWatchingDto>>>> Continue(CancellationToken cancellationToken) =>
        Ok(new ApiResponse<List<ContinueWatchingDto>>(true, await _items.GetContinueAsync(Caller, 5, cancellationToken)));

    /// <summary>
    /// A student's study over the last <paramref name="days"/> days, for the student, a linked parent, or an
    /// administrator. Anyone else gets 404 so student ids cannot be probed.
    /// </summary>
    [HttpGet("progress/student/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<StudentContentActivityDto>>> StudentActivity(
        Guid studentId,
        [FromQuery] int days = 7,
        CancellationToken cancellationToken = default)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller, cancellationToken))
        {
            return NotFound(new ApiResponse<StudentContentActivityDto>(false, null, "Student not found"));
        }

        var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 90));
        return Ok(new ApiResponse<StudentContentActivityDto>(
            true, await _items.GetStudentActivityAsync(studentId, since, 5, cancellationToken)));
    }

    private ObjectResult TooLarge(long maxBytes) =>
        StatusCode(StatusCodes.Status413PayloadTooLarge,
            new ApiResponse<ContentItemDto>(false, null, $"The file is larger than {maxBytes / (1024 * 1024)} MB"));
}
