using Shared.Security;
using Shouldly;

namespace EduPlatform.UnitTests;

public class PasswordPolicyTests
{
    [Theory]
    [InlineData("Short1")]
    [InlineData("aaaaaaaaaa")]
    [InlineData("1234567890")]
    [InlineData("password123")]
    [InlineData("")]
    [InlineData(null)]
    public void Rejects_weak_passwords(string? password)
    {
        PasswordPolicy.Validate(password).ShouldNotBeNull();
    }

    [Fact]
    public void Accepts_a_long_mixed_password()
    {
        PasswordPolicy.IsAcceptable("correct horse 9").ShouldBeTrue();
    }
}
