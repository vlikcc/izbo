using Shared.Models;

namespace ContentService.Services.Media;

public sealed record UploadCheck(bool IsValid, string? Error, string Extension, string ContentType)
{
    public static UploadCheck Fail(string error) => new(false, error, string.Empty, string.Empty);
}

/// <summary>
/// Which files each content type accepts. The extension narrows the claim and the first bytes confirm
/// it, so a renamed executable is refused before anything reaches object storage.
/// </summary>
public static class ContentUploadRules
{
    /// <summary>Bytes needed to recognise every accepted container.</summary>
    public const int SniffLength = 16;

    private static readonly Dictionary<string, string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp4"] = "video/mp4",
        [".m4v"] = "video/mp4",
        [".mov"] = "video/quicktime",
        [".mkv"] = "video/x-matroska",
        [".webm"] = "video/webm",
    };

    public static UploadCheck Check(ContentItemType type, string? fileName, ReadOnlySpan<byte> head)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();

        switch (type)
        {
            case ContentItemType.Video:
            case ContentItemType.SolvedQuestionVideo:
                if (!VideoExtensions.TryGetValue(extension, out var videoType))
                {
                    return UploadCheck.Fail("Videos must be MP4, MOV, M4V, MKV or WebM files.");
                }

                return LooksLikeVideo(head)
                    ? new UploadCheck(true, null, extension, videoType)
                    : UploadCheck.Fail("The file's contents are not a supported video container.");

            case ContentItemType.Pdf:
            case ContentItemType.Worksheet:
            case ContentItemType.EBook:
                if (extension != ".pdf")
                {
                    return UploadCheck.Fail("Documents must be PDF files.");
                }

                return head.StartsWith("%PDF-"u8)
                    ? new UploadCheck(true, null, ".pdf", "application/pdf")
                    : UploadCheck.Fail("The file's contents are not a PDF document.");

            default:
                return UploadCheck.Fail("This content type does not take a file upload.");
        }
    }

    private static bool LooksLikeVideo(ReadOnlySpan<byte> head)
    {
        // ISO base media (MP4/MOV/M4V): a box size followed by a known box type.
        if (head.Length >= 8)
        {
            var box = head.Slice(4, 4);
            if (box.SequenceEqual("ftyp"u8) || box.SequenceEqual("moov"u8) || box.SequenceEqual("mdat"u8) ||
                box.SequenceEqual("wide"u8) || box.SequenceEqual("free"u8) || box.SequenceEqual("skip"u8))
            {
                return true;
            }
        }

        // Matroska / WebM: EBML magic.
        return head.Length >= 4 && head[0] == 0x1A && head[1] == 0x45 && head[2] == 0xDF && head[3] == 0xA3;
    }
}
