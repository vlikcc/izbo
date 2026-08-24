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
    /// <summary>
    /// Stores an already validated upload. Returns <c>null</c> when <paramref name="entityId"/> names a
    /// classroom the caller is not a member of, since attaching a file there would publish it to that
    /// classroom.
    /// </summary>
    Task<FileUploadResponse?> UploadFileAsync(Stream fileStream, string fileName, UploadValidation validation, Caller caller, Guid? entityId = null, CancellationToken cancellationToken = default);

    Task<FileDto?> GetFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<List<FileDto>?> GetFilesByEntityAsync(Guid entityId, Caller caller, CancellationToken cancellationToken = default);
    Task<PresignedUrlResponse?> GetPresignedDownloadUrlAsync(Guid fileId, Caller caller, int expiresMinutes = 60, CancellationToken cancellationToken = default);
    Task<bool> DeleteFileAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Metadata for serving a file, with a callback that copies its bytes to a destination when the
    /// response is ready for them.
    /// </summary>
    Task<FileDownload?> OpenDownloadAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
}

/// <summary>What a caller needs to serve a stored file without ever holding all of it.</summary>
public sealed record FileDownload(
    string ContentType,
    string FileName,
    long Size,
    Func<Stream, CancellationToken, Task> CopyToAsync);

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

    public async Task<FileUploadResponse?> UploadFileAsync(
        Stream fileStream,
        string fileName,
        UploadValidation validation,
        Caller caller,
        Guid? entityId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(fileStream);
        ArgumentNullException.ThrowIfNull(caller);

        // An entity id is a classroom id, and files carrying one are readable by that classroom. Without
        // this check a student could plant a file in any classroom, or read back what one contains by
        // listing it afterwards.
        if (entityId.HasValue && !await _classroomAccess.CanViewAsync(entityId.Value, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to attach a file to classroom {ClassroomId} they do not belong to",
                caller.UserId, entityId.Value);
            return null;
        }

        var bucketExists = await _minioClient.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), cancellationToken);
        if (!bucketExists)
        {
            await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName), cancellationToken);
        }

        var fileId = Guid.NewGuid();

        // The object key is derived entirely from server-side values. The client's file name is kept in
        // metadata only, so it can never influence the storage layout or escape the prefix.
        var storagePath = $"{validation.Type.ToString().ToLowerInvariant()}/{fileId:N}{StoredFileName.ExtensionOf(fileName)}";

        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(storagePath)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(validation.ContentType), cancellationToken);

        var fileMetadata = new FileMetadata
        {
            Id = fileId,
            FileName = StoredFileName.Sanitize(fileName),
            ContentType = validation.ContentType,
            Size = fileStream.Length,
            StoragePath = storagePath,
            Type = validation.Type,
            UploadedBy = caller.UserId,
            EntityId = entityId,
            UploadedAt = DateTime.UtcNow
        };

        _context.Files.Add(fileMetadata);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("File {FileId} uploaded by {UserId}", fileId, caller.UserId);

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

    public async Task<FileDownload?> OpenDownloadAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var file = await FindReadableAsync(id, caller, cancellationToken);
        if (file == null) return null;

        return new FileDownload(
            file.ContentType,
            file.FileName,
            file.Size,
            (destination, ct) => _minioClient.GetObjectAsync(new GetObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(file.StoragePath)
                .WithCallbackStream((source, streamToken) => source.CopyToAsync(destination, streamToken)), ct));
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
