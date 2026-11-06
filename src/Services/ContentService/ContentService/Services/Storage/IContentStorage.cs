namespace ContentService.Services.Storage;

/// <summary>
/// Object storage for content media. Abstracted so the content workflow can be exercised in tests
/// without a MinIO server, and so the MinIO SDK's quirks stay in one place.
/// </summary>
public interface IContentStorage
{
    /// <summary>
    /// Streams <paramref name="data"/> to <paramref name="key"/>. <paramref name="size"/> may be -1 when
    /// the length is not known up front (a multipart request body). Returns the bytes actually stored.
    /// </summary>
    Task<long> PutAsync(string key, Stream data, long size, string contentType, CancellationToken cancellationToken = default);

    /// <summary>Null when the object does not exist.</summary>
    Task<StoredObjectInfo?> StatAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>Copies the object, or the byte range starting at <paramref name="offset"/>, to <paramref name="destination"/>.</summary>
    Task CopyToAsync(string key, Stream destination, long offset = 0, long? length = null, CancellationToken cancellationToken = default);

    Task DeleteAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>Removes every object whose key starts with <paramref name="prefix"/>.</summary>
    Task DeletePrefixAsync(string prefix, CancellationToken cancellationToken = default);
}

public sealed record StoredObjectInfo(long Size, string ContentType);

/// <summary>The object store did not accept a write.</summary>
public sealed class ContentStorageException : Exception
{
    public ContentStorageException() { }

    public ContentStorageException(string message) : base(message) { }

    public ContentStorageException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>Object keys. Every key is built from server-side ids only, never from client input.</summary>
public static class ContentStorageKeys
{
    public static string ItemPrefix(Guid itemId) => $"content/{itemId:N}/";

    public static string Source(Guid itemId, string extension) => $"{ItemPrefix(itemId)}source{extension}";

    public static string HlsPrefix(Guid itemId) => $"{ItemPrefix(itemId)}hls/";

    public static string Thumbnail(Guid itemId) => $"{ItemPrefix(itemId)}thumbnail.jpg";
}
