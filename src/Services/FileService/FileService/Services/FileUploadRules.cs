using Shared.Models;
using System.Collections.Frozen;

namespace FileService.Services;

/// <summary>
/// Server-side upload policy. A client controls the file name, the declared content type and the bytes,
/// so none of those are trusted: the extension must be on an allowlist, the leading bytes must match a
/// signature that agrees with the extension, and the size limit depends on the declared file type.
/// </summary>
public static class FileUploadRules
{
    private const long Megabyte = 1024 * 1024;

    /// <summary>
    /// Ceiling enforced on the request itself, matching the most permissive per-type limit. Its job is to
    /// stop an oversized body from being read at all; the per-type limits below then apply.
    /// </summary>
    public const int AbsoluteMaxBytes = 200 * 1024 * 1024;

    private static readonly FrozenDictionary<FileType, long> MaxSizeByType = new Dictionary<FileType, long>
    {
        [FileType.Image] = 10 * Megabyte,
        [FileType.Document] = 25 * Megabyte,
        [FileType.Audio] = 50 * Megabyte,
        [FileType.Video] = 200 * Megabyte,
        [FileType.Other] = 25 * Megabyte
    }.ToFrozenDictionary();

    /// <summary>
    /// Allowed extensions with the content type the server will store. The stored content type comes from
    /// this table rather than from the request, so a client cannot label an executable as an image.
    /// </summary>
    private static readonly FrozenDictionary<string, AllowedFormat> AllowedFormats = new Dictionary<string, AllowedFormat>(StringComparer.Ordinal)
    {
        // Images
        [".jpg"] = new("image/jpeg", FileType.Image, Signatures.Jpeg),
        [".jpeg"] = new("image/jpeg", FileType.Image, Signatures.Jpeg),
        [".png"] = new("image/png", FileType.Image, Signatures.Png),
        [".gif"] = new("image/gif", FileType.Image, Signatures.Gif),
        [".webp"] = new("image/webp", FileType.Image, Signatures.Riff),

        // Documents
        [".pdf"] = new("application/pdf", FileType.Document, Signatures.Pdf),
        [".doc"] = new("application/msword", FileType.Document, Signatures.OleCompoundFile),
        [".docx"] = new("application/vnd.openxmlformats-officedocument.wordprocessingml.document", FileType.Document, Signatures.Zip),
        [".xls"] = new("application/vnd.ms-excel", FileType.Document, Signatures.OleCompoundFile),
        [".xlsx"] = new("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", FileType.Document, Signatures.Zip),
        [".ppt"] = new("application/vnd.ms-powerpoint", FileType.Document, Signatures.OleCompoundFile),
        [".pptx"] = new("application/vnd.openxmlformats-officedocument.presentationml.presentation", FileType.Document, Signatures.Zip),
        [".zip"] = new("application/zip", FileType.Document, Signatures.Zip),

        // Plain text has no signature to check, so it is served as text/plain and never as HTML.
        [".txt"] = new("text/plain", FileType.Document, []),
        [".csv"] = new("text/csv", FileType.Document, []),

        // Audio and video
        [".mp3"] = new("audio/mpeg", FileType.Audio, Signatures.Mp3),
        [".wav"] = new("audio/wav", FileType.Audio, Signatures.Riff),
        [".m4a"] = new("audio/mp4", FileType.Audio, Signatures.Mp4),
        [".mp4"] = new("video/mp4", FileType.Video, Signatures.Mp4),
        [".webm"] = new("video/webm", FileType.Video, Signatures.Matroska)
    }.ToFrozenDictionary(StringComparer.Ordinal);

    /// <summary>Longest signature plus the offset it can start at.</summary>
    private const int HeaderBytesToRead = 16;

    public static async Task<UploadValidation> ValidateAsync(
        Stream content,
        string? fileName,
        FileType declaredType,
        long length,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(content);

        var extension = StoredFileName.ExtensionOf(fileName);
        if (extension.Length == 0 || !AllowedFormats.TryGetValue(extension, out var format))
        {
            return UploadValidation.Invalid(
                $"File type '{extension}' is not allowed. Allowed types: {string.Join(", ", AllowedFormats.Keys.Order())}");
        }

        // The caller's label is accepted only when it agrees with the extension. Everything downstream —
        // the size limit, the stored content type, the storage prefix — then follows the extension, so
        // calling an .mp4 an image cannot buy it the image size limit.
        if (declaredType != FileType.Other && declaredType != format.Category)
        {
            return UploadValidation.Invalid(
                $"A '{extension}' file cannot be uploaded as {declaredType}; it is a {format.Category} file.");
        }

        var maxSize = MaxSizeByType[format.Category];
        if (length > maxSize)
        {
            return UploadValidation.Invalid(
                $"File is too large. The limit for {format.Category} uploads is {maxSize / Megabyte} MB.");
        }

        if (!await HasExpectedSignatureAsync(content, format, cancellationToken))
        {
            return UploadValidation.Invalid("The file contents do not match its extension.");
        }

        return UploadValidation.Valid(format.ContentType, format.Category);
    }

    private static async Task<bool> HasExpectedSignatureAsync(
        Stream content,
        AllowedFormat format,
        CancellationToken cancellationToken)
    {
        if (format.Signatures.Length == 0)
        {
            return true;
        }

        var header = new byte[HeaderBytesToRead];
        var read = await content.ReadAtLeastAsync(header, HeaderBytesToRead, throwOnEndOfStream: false, cancellationToken);

        // The stream is handed to the storage client next, which expects to start at the beginning.
        content.Position = 0;

        var actual = header.AsSpan(0, read);
        foreach (var signature in format.Signatures)
        {
            if (signature.Matches(actual))
            {
                return true;
            }
        }

        return false;
    }

    private sealed record AllowedFormat(string ContentType, FileType Category, FileSignature[] Signatures);

    /// <summary>A byte pattern expected at a fixed offset from the start of the file.</summary>
    private readonly record struct FileSignature(int Offset, byte[] Magic)
    {
        internal bool Matches(ReadOnlySpan<byte> header) =>
            header.Length >= Offset + Magic.Length &&
            header.Slice(Offset, Magic.Length).SequenceEqual(Magic);
    }

    private static class Signatures
    {
        internal static readonly FileSignature[] Jpeg = [new(0, [0xFF, 0xD8, 0xFF])];

        internal static readonly FileSignature[] Png = [new(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])];

        internal static readonly FileSignature[] Gif =
        [
            new(0, "GIF87a"u8.ToArray()),
            new(0, "GIF89a"u8.ToArray())
        ];

        /// <summary>Container for WebP and WAV; the format tag at offset 8 distinguishes them.</summary>
        internal static readonly FileSignature[] Riff = [new(0, "RIFF"u8.ToArray())];

        internal static readonly FileSignature[] Pdf = [new(0, "%PDF-"u8.ToArray())];

        /// <summary>Legacy Office binary format (also used by .doc, .xls and .ppt).</summary>
        internal static readonly FileSignature[] OleCompoundFile =
            [new(0, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])];

        /// <summary>OOXML documents are ZIP archives; the empty and spanned variants are also valid.</summary>
        internal static readonly FileSignature[] Zip =
        [
            new(0, [0x50, 0x4B, 0x03, 0x04]),
            new(0, [0x50, 0x4B, 0x05, 0x06]),
            new(0, [0x50, 0x4B, 0x07, 0x08])
        ];

        internal static readonly FileSignature[] Mp3 =
        [
            new(0, "ID3"u8.ToArray()),
            new(0, [0xFF, 0xFB]),
            new(0, [0xFF, 0xF3]),
            new(0, [0xFF, 0xF2])
        ];

        /// <summary>ISO base media files carry the 'ftyp' box four bytes in.</summary>
        internal static readonly FileSignature[] Mp4 = [new(4, "ftyp"u8.ToArray())];

        internal static readonly FileSignature[] Matroska = [new(0, [0x1A, 0x45, 0xDF, 0xA3])];
    }
}

/// <summary>
/// The outcome of checking an upload. On success it carries the content type and category the server will
/// record, both derived from the file's extension and verified against its leading bytes.
/// </summary>
public readonly record struct UploadValidation(bool IsValid, string ContentType, FileType Type, string? Error)
{
    internal static UploadValidation Valid(string contentType, FileType type) => new(true, contentType, type, null);

    internal static UploadValidation Invalid(string error) => new(false, string.Empty, FileType.Other, error);
}
