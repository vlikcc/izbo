using FileService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Models;
using System.Security.Claims;

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

    [HttpPost("upload")]
    [RequestSizeLimit(100_000_000)] // 100MB
    public async Task<ActionResult<ApiResponse<FileUploadResponse>>> UploadFile(
        IFormFile file,
        [FromQuery] string type = "Other",
        [FromQuery] Guid? entityId = null)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<FileUploadResponse>(false, null, "No file provided"));

        if (!Enum.TryParse<FileType>(type, out var fileType))
            fileType = FileType.Other;

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        using var stream = file.OpenReadStream();
        var result = await _fileService.UploadFileAsync(
            stream, file.FileName, file.ContentType, fileType, userId, entityId);

        return Ok(new ApiResponse<FileUploadResponse>(true, result, "File uploaded successfully"));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<FileMetadata>>> GetFile(Guid id)
    {
        var result = await _fileService.GetFileAsync(id);

        if (result == null)
            return NotFound(new ApiResponse<FileMetadata>(false, null, "File not found"));

        return Ok(new ApiResponse<FileMetadata>(true, result));
    }

    [HttpGet("entity/{entityId}")]
    public async Task<ActionResult<ApiResponse<List<FileMetadata>>>> GetFilesByEntity(Guid entityId)
    {
        var result = await _fileService.GetFilesByEntityAsync(entityId);
        return Ok(new ApiResponse<List<FileMetadata>>(true, result));
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadFile(Guid id)
    {
        var file = await _fileService.GetFileAsync(id);
        if (file == null)
            return NotFound();

        var stream = await _fileService.DownloadFileAsync(id);
        if (stream == null)
            return NotFound();

        return File(stream, file.ContentType, file.FileName);
    }

    [HttpGet("{id}/presigned-url")]
    public async Task<ActionResult<ApiResponse<PresignedUrlResponse>>> GetPresignedDownloadUrl(Guid id, [FromQuery] int expiresMinutes = 60)
    {
        try
        {
            var result = await _fileService.GetPresignedDownloadUrlAsync(id, expiresMinutes);
            return Ok(new ApiResponse<PresignedUrlResponse>(true, result));
        }
        catch (FileNotFoundException)
        {
            return NotFound(new ApiResponse<PresignedUrlResponse>(false, null, "File not found"));
        }
    }

    [HttpPost("presigned-upload")]
    public async Task<ActionResult<ApiResponse<PresignedUrlResponse>>> GetPresignedUploadUrl([FromBody] PresignedUploadRequest request)
    {
        var result = await _fileService.GetPresignedUploadUrlAsync(request.FileName, request.ContentType, request.ExpiresMinutes);
        return Ok(new ApiResponse<PresignedUrlResponse>(true, result));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteFile(Guid id)
    {
        var result = await _fileService.DeleteFileAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "File not found"));

        return Ok(new ApiResponse<bool>(true, true, "File deleted"));
    }
}

public record PresignedUploadRequest(string FileName, string ContentType, int ExpiresMinutes = 15);
