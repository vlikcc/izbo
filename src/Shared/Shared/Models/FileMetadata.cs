namespace Shared.Models;

public enum FileType
{
    Image = 0,
    Document = 1,
    Video = 2,
    Audio = 3,
    Other = 4
}

public class FileMetadata
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public FileType Type { get; set; }
    public long Size { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public Guid UploadedBy { get; set; }
    public Guid? EntityId { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual User? Uploader { get; set; }
}
