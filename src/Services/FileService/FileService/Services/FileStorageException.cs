namespace FileService.Services;

/// <summary>
/// The object store did not accept a write. Distinct from a validation or permission failure: the
/// request was fine and the caller can retry, so it is answered with 503 rather than 4xx.
/// </summary>
public sealed class FileStorageException : Exception
{
    public FileStorageException() { }

    public FileStorageException(string message) : base(message) { }

    public FileStorageException(string message, Exception innerException) : base(message, innerException) { }
}
