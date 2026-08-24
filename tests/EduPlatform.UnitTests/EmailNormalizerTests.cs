using Shared.Text;
using Shouldly;

namespace EduPlatform.UnitTests;

public class EmailNormalizerTests
{
    [Fact]
    public void Lower_cases_with_the_invariant_culture()
    {
        EmailNormalizer.Normalize("  Admin@EduPlatform.LOCAL ").ShouldBe("admin@eduplatform.local");
    }
}
