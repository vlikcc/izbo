using FileService.Data;
using Microsoft.EntityFrameworkCore;
using Minio;
using Minio.DataModel.Args;
using Shared.DTOs;
using Shared.Models;

namespace FileService.Services;

public interface IFileManagementService
{
    Task<FileUploadResponse> UploadFileAsync(Stream fileStream, string fileName, string contentType, FileType type, Guid uploadedBy, Guid? entityId = null);
    Task<FileMetadata?> GetFileAsync(Guid id);
    Task<List<FileMetadata>> GetFilesByEntityAsync(Guid entityId);
    Task<PresignedUrlResponse> GetPresignedUploadUrlAsync(string fileName, string contentType, int expiresMinutes = 15);
    Task<PresignedUrlResponse> GetPresignedDownloadUrlAsync(Guid fileId, int expiresMinutes = 60);
    Task<bool> DeleteFileAsync(Guid id);
    Task<Stream?> DownloadFileAsync(Guid id);
}

public class FileManagementService : IFileManagementService
{
    private readonly FileDbContext _context;
    private readonly IMinioClient _minioClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FileManagementService> _logger;
    private readonly string _bucketName;

    public FileManagementService(
        FileDbContext context,
        IMinioClient minioClient,
        IConfiguration configuration,
        ILogger<FileManagementService> logger)
    {
        _context = context;
        _minioClient = minioClient;
        _configuration = configuration;
        _logger = logger;
        _bucketName = _configuration["MinIO:BucketName"] ?? "eduplatform";
    }

    public async Task<FileUploadResponse> UploadFileAsync(Stream fileStream, string fileName, string contentType, FileType type, Guid uploadedBy, Guid? entityId = null)
    {
        // Ensure bucket exists
        var bucketExists = await _minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucketName));
        if (!bucketExists)
        {
            await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName));
        }

        var fileId = Guid.NewGuid();
        var storagePath = $"{type.ToString().ToLower()}/{fileId}/{fileName}";

        // Upload to MinIO
        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(storagePath)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType));

        // Save metadata
        var fileMetadata = new FileMetadata
        {
            Id = fileId,
            FileName = fileName,
            ContentType = contentType,
            Size = fileStream.Length,
            StoragePath = storagePath,
            Type = type,
            UploadedBy = uploadedBy,
            EntityId = entityId,
            UploadedAt = DateTime.UtcNow
        };

        _context.Files.Add(fileMetadata);
        await _context.SaveChangesAsync();

        _logger.LogInformation("File {FileId} uploaded: {FileName}", fileId, fileName);

        return new FileUploadResponse(fileId, fileName, storagePath);
    }

    public async Task<FileMetadata?> GetFileAsync(Guid id)
    {
        return await _context.Files.FindAsync(id);
    }

    public async Task<List<FileMetadata>> GetFilesByEntityAsync(Guid entityId)
    {
        return await _context.Files
            .Where(f => f.EntityId == entityId)
            .OrderByDescending(f => f.UploadedAt)
            .ToListAsync();
    }

    public async Task<PresignedUrlResponse> GetPresignedUploadUrlAsync(string fileName, string contentType, int expiresMinutes = 15)
    {
        var fileId = Guid.NewGuid();
        var storagePath = $"uploads/{fileId}/{fileName}";

        var presignedUrl = await _minioClient.PresignedPutObjectAsync(new PresignedPutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(storagePath)
            .WithExpiry(expiresMinutes * 60));

        return new PresignedUrlResponse(presignedUrl, DateTime.UtcNow.AddMinutes(expiresMinutes));
    }

    public async Task<PresignedUrlResponse> GetPresignedDownloadUrlAsync(Guid fileId, int expiresMinutes = 60)
    {
        var file = await _context.Files.FindAsync(fileId);
        if (file == null)
            throw new FileNotFoundException("File not found");

        var presignedUrl = await _minioClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(file.StoragePath)
            .WithExpiry(expiresMinutes * 60));

        return new PresignedUrlResponse(presignedUrl, DateTime.UtcNow.AddMinutes(expiresMinutes));
    }

    public async Task<bool> DeleteFileAsync(Guid id)
    {
        var file = await _context.Files.FindAsync(id);
        if (file == null) return false;

        try
        {
            await _minioClient.RemoveObjectAsync(new RemoveObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(file.StoragePath));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete file from storage: {FileId}", id);
        }

        _context.Files.Remove(file);
        await _context.SaveChangesAsync();

        _logger.LogInformation("File {FileId} deleted", id);
        return true;
    }

    public async Task<Stream?> DownloadFileAsync(Guid id)
    {
        var file = await _context.Files.FindAsync(id);
        if (file == null) return null;

        var memoryStream = new MemoryStream();
        await _minioClient.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(file.StoragePath)
            .WithCallbackStream(stream => stream.CopyTo(memoryStream)));

        memoryStream.Position = 0;
        return memoryStream;
    }
}
