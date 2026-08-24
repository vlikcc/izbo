using FileService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace FileService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IFileManagementService _fileService;
    private readonly ILogger<FilesController> _logger;

    public FilesController(IFileManagementService fileService, ILogger<FilesController> logger)
    {
        _fileService = fileService;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost("upload")]
    [RequestSizeLimit(FileUploadRules.AbsoluteMaxBytes)]
    public async Task<ActionResult<ApiResponse<FileUploadResponse>>> UploadFile(
        IFormFile file,
        [FromQuery] string type = "Other",
        [FromQuery] Guid? entityId = null,
        CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<FileUploadResponse>(false, null, "No file provided"));

        if (!Enum.TryParse<FileType>(type, ignoreCase: true, out var declaredType))
            declaredType = FileType.Other;

        await using var stream = file.OpenReadStream();

        var validation = await FileUploadRules.ValidateAsync(stream, file.FileName, declaredType, file.Length, cancellationToken);
        if (!validation.IsValid)
        {
            _logger.LogWarning(
                "Rejected upload of {FileName} by {UserId}: {Reason}",
                file.FileName, Caller.UserId, validation.Error);
            return BadRequest(new ApiResponse<FileUploadResponse>(false, null, validation.Error));
        }

        var result = await _fileService.UploadFileAsync(
            stream, file.FileName, validation, Caller, entityId, cancellationToken);

        if (result == null)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ApiResponse<FileUploadResponse>(false, null, "You cannot attach files to that classroom"));
        }

        return Ok(new ApiResponse<FileUploadResponse>(true, result, "File uploaded successfully"));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<FileDto>>> GetFile(Guid id, CancellationToken cancellationToken)
    {
        var result = await _fileService.GetFileAsync(id, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<FileDto>(false, null, "File not found"));

        return Ok(new ApiResponse<FileDto>(true, result));
    }

    [HttpGet("entity/{entityId}")]
    public async Task<ActionResult<ApiResponse<List<FileDto>>>> GetFilesByEntity(Guid entityId, CancellationToken cancellationToken)
    {
        var result = await _fileService.GetFilesByEntityAsync(entityId, Caller, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<List<FileDto>>(false, null, "No files found"));

        return Ok(new ApiResponse<List<FileDto>>(true, result));
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, CancellationToken cancellationToken)
    {
        var download = await _fileService.OpenDownloadAsync(id, Caller, cancellationToken);
        if (download == null)
            return NotFound();

        Response.ContentType = download.ContentType;
        Response.ContentLength = download.Size;

        // `attachment` stops the browser rendering an upload inline, which would let stored markup run in
        // the application's origin; `nosniff` stops it disregarding the declared type and doing so anyway.
        Response.Headers.ContentDisposition =
            new ContentDispositionHeaderValue("attachment") { FileNameStar = download.FileName }.ToString();
        Response.Headers.XContentTypeOptions = "nosniff";

        // Streamed straight through rather than buffered: files run to hundreds of megabytes, and holding
        // one per concurrent download in memory is what takes the service down.
        await download.CopyToAsync(Response.Body, cancellationToken);

        return new EmptyResult();
    }

    [HttpGet("{id}/presigned-url")]
    public async Task<ActionResult<ApiResponse<PresignedUrlResponse>>> GetPresignedDownloadUrl(
        Guid id,
        [FromQuery] int expiresMinutes = 60,
        CancellationToken cancellationToken = default)
    {
        var result = await _fileService.GetPresignedDownloadUrlAsync(id, Caller, expiresMinutes, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<PresignedUrlResponse>(false, null, "File not found"));

        return Ok(new ApiResponse<PresignedUrlResponse>(true, result));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteFile(Guid id, CancellationToken cancellationToken)
    {
        var result = await _fileService.DeleteFileAsync(id, Caller, cancellationToken);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "File not found"));

        return Ok(new ApiResponse<bool>(true, true, "File deleted"));
    }
}
