using FileService.Services;
using Shouldly;

namespace EduPlatform.UnitTests;

public class StoredFileNameTests
{
    [Fact]
    public void Strips_directory_components()
    {
        StoredFileName.Sanitize(@"..\..\etc\passwd").ShouldBe("passwd");
    }

    [Fact]
    public void Replaces_unsafe_characters()
    {
        StoredFileName.Sanitize("notes<script>.pdf").ShouldBe("notes_script_.pdf");
    }

    [Fact]
    public void Reads_a_short_alphanumeric_extension()
    {
        StoredFileName.ExtensionOf("photo.PNG").ShouldBe(".png");
    }
}
