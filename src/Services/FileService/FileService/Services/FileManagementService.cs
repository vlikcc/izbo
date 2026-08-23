using FileService.Data;
using Microsoft.EntityFrameworkCore;
using Minio;
using Minio.DataModel.Args;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace FileService.Services;

public interface IFileManagementService
{
    Task<FileUploadResponse> UploadFileAsync(Stream fileStream, string fileName, string contentType, FileType type, Guid uploadedBy, Guid? entityId = null, CancellationToken cancellationToken = default);
    Task<FileDto?> GetFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<List<FileDto>?> GetFilesByEntityAsync(Guid entityId, Caller caller, CancellationToken cancellationToken = default);
    Task<PresignedUrlResponse?> GetPresignedDownloadUrlAsync(Guid fileId, Caller caller, int expiresMinutes = 60, CancellationToken cancellationToken = default);
    Task<bool> DeleteFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<FileDownload?> DownloadFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
}

/// <summary>A file's bytes together with the metadata needed to serve them.</summary>
public sealed record FileDownload(Stream Content, string ContentType, string FileName);

public class FileManagementService : IFileManagementService
{
    private readonly FileDbContext _context;
    private readonly IMinioClient _minioClient;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<FileManagementService> _logger;
    private readonly string _bucketName;

    public FileManagementService(
        FileDbContext context,
        IMinioClient minioClient,
        IClassroomAccessClient classroomAccess,
        IConfiguration configuration,
        ILogger<FileManagementService> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _context = context;
        _minioClient = minioClient;
        _classroomAccess = classroomAccess;
        _logger = logger;
        _bucketName = configuration["MinIO:BucketName"] ?? "eduplatform";
    }

    public async Task<FileUploadResponse> UploadFileAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        FileType type,
        Guid uploadedBy,
        Guid? entityId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(fileStream);

        var bucketExists = await _minioClient.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), cancellationToken);
        if (!bucketExists)
        {
            await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName), cancellationToken);
        }

        var fileId = Guid.NewGuid();

        // The object key is derived entirely from server-side values. The client's file name is kept in
        // metadata only, so it can never influence the storage layout or escape the prefix.
        var storagePath = $"{type.ToString().ToLowerInvariant()}/{fileId:N}{StoredFileName.ExtensionOf(fileName)}";

        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(storagePath)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType), cancellationToken);

        var fileMetadata = new FileMetadata
        {
            Id = fileId,
            FileName = StoredFileName.Sanitize(fileName),
            ContentType = contentType,
            Size = fileStream.Length,
            StoragePath = storagePath,
            Type = type,
            UploadedBy = uploadedBy,
            EntityId = entityId,
            UploadedAt = DateTime.UtcNow
        };

        _context.Files.Add(fileMetadata);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("File {FileId} uploaded by {UserId}", fileId, uploadedBy);

        return new FileUploadResponse(fileId, fileMetadata.FileName, fileMetadata.Size);
    }

    public async Task<FileDto?> GetFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var file = await FindReadableAsync(id, caller, cancellationToken);
        return file == null ? null : MapToDto(file);
    }

    public async Task<List<FileDto>?> GetFilesByEntityAsync(Guid entityId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        // Files are grouped by the classroom they belong to, so listing them requires classroom access.
        // Callers who are not members are told the entity has no files rather than being shown them.
        if (!await _classroomAccess.CanViewAsync(entityId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to list files for entity {EntityId} without classroom access",
                caller.UserId, entityId);
            return null;
        }

        return await _context.Files
            .AsNoTracking()
            .Where(f => f.EntityId == entityId)
            .OrderByDescending(f => f.UploadedAt)
            .Select(f => new FileDto(
                f.Id, f.FileName, f.ContentType, f.Type.ToString(),
                f.Size, f.UploadedBy, f.EntityId, f.UploadedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<PresignedUrlResponse?> GetPresignedDownloadUrlAsync(
        Guid fileId,
        Caller caller,
        int expiresMinutes = 60,
        CancellationToken cancellationToken = default)
    {
        var file = await FindReadableAsync(fileId, caller, cancellationToken);
        if (file == null) return null;

        // A presigned URL bypasses this service entirely once issued, so cap how long it stays valid.
        var expiry = Math.Clamp(expiresMinutes, 1, 60);

        var presignedUrl = await _minioClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(file.StoragePath)
            .WithExpiry(expiry * 60));

        return new PresignedUrlResponse(presignedUrl, DateTime.UtcNow.AddMinutes(expiry));
    }

    public async Task<bool> DeleteFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var file = await _context.Files.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (file == null) return false;

        // Deleting is stricter than reading: only the uploader or an administrator may remove a file.
        if (!caller.CanActFor(file.UploadedBy))
        {
            _logger.LogWarning(
                "User {UserId} attempted to delete file {FileId} uploaded by {UploaderId}",
                caller.UserId, id, file.UploadedBy);
            return false;
        }

        try
        {
            await _minioClient.RemoveObjectAsync(new RemoveObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(file.StoragePath), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The metadata row is still removed: leaving it behind would make the file undeletable.
            _logger.LogWarning(ex, "Failed to delete file from storage: {FileId}", id);
        }

        _context.Files.Remove(file);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("File {FileId} deleted by {UserId}", id, caller.UserId);
        return true;
    }

    public async Task<FileDownload?> DownloadFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var file = await FindReadableAsync(id, caller, cancellationToken);
        if (file == null) return null;

        var memoryStream = new MemoryStream();
        await _minioClient.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(file.StoragePath)
            .WithCallbackStream((stream, ct) => stream.CopyToAsync(memoryStream, ct)), cancellationToken);

        memoryStream.Position = 0;
        return new FileDownload(memoryStream, file.ContentType, file.FileName);
    }

    /// <summary>
    /// Returns the file only when the caller may read it: the uploader, an administrator, or a member of
    /// the classroom the file is attached to. Everyone else is told the file does not exist, so file ids
    /// cannot be probed.
    /// </summary>
    private async Task<FileMetadata?> FindReadableAsync(Guid id, Caller caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var file = await _context.Files
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

        if (file == null) return null;

        if (caller.CanActFor(file.UploadedBy))
        {
            return file;
        }

        if (file.EntityId.HasValue &&
            await _classroomAccess.CanViewAsync(file.EntityId.Value, caller, cancellationToken))
        {
            return file;
        }

        _logger.LogWarning(
            "User {UserId} attempted to read file {FileId} uploaded by {UploaderId}",
            caller.UserId, id, file.UploadedBy);
        return null;
    }

    private static FileDto MapToDto(FileMetadata f) => new(
        f.Id,
        f.FileName,
        f.ContentType,
        f.Type.ToString(),
        f.Size,
        f.UploadedBy,
        f.EntityId,
        f.UploadedAt);
}
