using FileService.Services;
using Shared.Models;
using Shouldly;

namespace EduPlatform.UnitTests;

public class FileUploadRulesTests
{
    [Fact]
    public async Task Rejects_disallowed_extensions()
    {
        await using var stream = new MemoryStream([0x4D, 0x5A]);
        var result = await FileUploadRules.ValidateAsync(stream, "payload.exe", FileType.Other, 2);
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Rejects_a_png_extension_with_jpeg_bytes()
    {
        await using var stream = new MemoryStream([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        var result = await FileUploadRules.ValidateAsync(stream, "photo.png", FileType.Image, stream.Length);
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Accepts_a_png_with_matching_signature()
    {
        var png =
            new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }
            .Concat(new byte[8])
            .ToArray();
        await using var stream = new MemoryStream(png);
        var result = await FileUploadRules.ValidateAsync(stream, "photo.png", FileType.Image, png.Length);
        result.IsValid.ShouldBeTrue();
        result.ContentType.ShouldBe("image/png");
    }
}
