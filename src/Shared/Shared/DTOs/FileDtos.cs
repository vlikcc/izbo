namespace Shared.DTOs;

/// <summary>
/// A stored file as exposed to clients. Deliberately omits the storage path: object keys are an
/// internal detail and knowing them would let a client address objects directly.
/// </summary>
public record FileDto(
    Guid Id,
    string FileName,
    string ContentType,
    string Type,
    long Size,
    Guid UploadedBy,
    Guid? EntityId,
    DateTime UploadedAt);

public record FileUploadResponse(
    Guid Id,
    string FileName,
    long Size);

public record PresignedUrlResponse(string Url, DateTime ExpiresAt);

