using Shared.Extensions;
using Shouldly;

namespace EduPlatform.UnitTests;

public class NpgsqlPoolingTests
{
    [Fact]
    public void Adds_pool_limits_when_absent()
    {
        var result = NpgsqlPooling.Apply("Host=localhost;Database=edu;Username=postgres;Password=secret");

        result.ShouldContain("Maximum Pool Size=50");
        result.ShouldContain("Minimum Pool Size=1");
        result.ShouldContain("Timeout=15");
    }

    [Fact]
    public void Leaves_an_explicit_max_pool_size_alone()
    {
        var result = NpgsqlPooling.Apply("Host=localhost;Maximum Pool Size=12");
        result.ShouldContain("Maximum Pool Size=12");
    }
}
