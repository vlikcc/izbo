using Shared.DTOs;
using Shared.Text;
using Shared.Validation;
using Shouldly;

namespace EduPlatform.UnitTests;

public class RegistrationValidationTests
{
    private static readonly string Password = TestPasswords.Strong();
    private const string ChildUsername = "ela.yilmaz";

    private static RegisterRequest Register(string? role, int? grade = null, string? examTarget = null) =>
        new("kisi@example.com", Password, "Ad", "Soyad", null, role, grade, examTarget);

    [Theory]
    [InlineData("Student")]
    [InlineData(null)]
    public void A_student_must_choose_a_grade(string? role)
    {
        new RegisterRequestValidator().Validate(Register(role)).IsValid.ShouldBeFalse();
        new RegisterRequestValidator().Validate(Register(role, 13)).IsValid.ShouldBeFalse();
        new RegisterRequestValidator().Validate(Register(role, 5)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("Parent")]
    [InlineData("Instructor")]
    public void Parents_and_teachers_do_not_need_a_grade(string role)
    {
        new RegisterRequestValidator().Validate(Register(role)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("SuperAdmin")]
    [InlineData("Hacker")]
    public void Registration_rejects_roles_outside_self_service(string role)
    {
        new RegisterRequestValidator().Validate(Register(role, 5)).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData("Lgs", true)]
    [InlineData("yks", true)]
    [InlineData("None", true)]
    [InlineData("", true)]
    [InlineData("Kpss", false)]
    [InlineData("7", false)]
    public void Exam_target_must_be_a_known_exam(string target, bool valid)
    {
        new RegisterRequestValidator().Validate(Register("Student", 8, target)).IsValid.ShouldBe(valid);
    }

    [Fact]
    public void Login_needs_an_email_or_a_user_name()
    {
        var validator = new LoginRequestValidator();

        validator.Validate(new LoginRequest(null, Password)).IsValid.ShouldBeFalse();
        validator.Validate(new LoginRequest("not-an-email", Password)).IsValid.ShouldBeFalse();
        validator.Validate(new LoginRequest("kisi@example.com", Password)).IsValid.ShouldBeTrue();
        validator.Validate(new LoginRequest(Email: null, Password: Password, Username: ChildUsername)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("ela.yilmaz", true)]
    [InlineData("Ela_2015", true)]
    [InlineData("ela", false)]
    [InlineData("ela yilmaz", false)]
    [InlineData("ela@ev", false)]
    [InlineData("çağla", false)]
    [InlineData("", false)]
    public void User_names_are_short_ascii_without_at_signs(string username, bool valid)
    {
        UsernameRules.IsValid(username).ShouldBe(valid);
    }

    [Fact]
    public void A_child_account_needs_a_valid_name_password_and_grade()
    {
        var validator = new CreateChildRequestValidator();

        validator.Validate(new CreateChildRequest("Ela", "Yılmaz", ChildUsername, Password, 3)).IsValid.ShouldBeTrue();
        validator.Validate(new CreateChildRequest("Ela", "Yılmaz", ChildUsername, new string('a', 5), 3)).IsValid.ShouldBeFalse();
        validator.Validate(new CreateChildRequest("Ela", "Yılmaz", ChildUsername, Password, 0)).IsValid.ShouldBeFalse();
        validator.Validate(new CreateChildRequest("Ela", "Yılmaz", "e", Password, 3)).IsValid.ShouldBeFalse();
    }
}
