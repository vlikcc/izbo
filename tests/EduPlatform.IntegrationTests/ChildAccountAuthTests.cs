using AuthService.Data;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.DTOs;
using Shared.Internal;
using Shared.Models;
using Shouldly;
using System.IdentityModel.Tokens.Jwt;

namespace EduPlatform.IntegrationTests;

/// <summary>
/// Parent role, user-name accounts a parent opens for a child, and role changes reaching the token issuer.
/// </summary>
[Collection("postgres")]
public class ChildAccountAuthTests
{
    private static readonly string Password = TestPasswords.Strong();
    private static readonly string OtherPassword = TestPasswords.Strong();

    /// <summary>The sign-in name of the child account most tests open.</summary>
    private const string ChildUsername = "ela.yilmaz";
    private const string UnknownUsername = "nobody.here";

    private readonly PostgresFixture _postgres;

    public ChildAccountAuthTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task A_parent_can_register_with_the_parent_role()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var directory = new RecordingAccountDirectoryClient();
        var auth = CreateService(db, directory);

        var result = await auth.RegisterAsync(
            new RegisterRequest("veli@example.com", Password, "Ayşe", "Yılmaz", null, "Parent"),
            ClientFingerprint.Unknown);

        result.Outcome.ShouldBe(RegistrationOutcome.Created);
        (await db.Users.SingleAsync()).Role.ShouldBe(UserRole.Parent);
        directory.Mirrored.Single().Role.ShouldBe("Parent");
    }

    [SkippableFact]
    public async Task Registration_cannot_ask_for_an_administrative_role()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);

        await auth.RegisterAsync(
            new RegisterRequest("sneaky@example.com", Password, "Sneaky", "User", null, "SuperAdmin"),
            ClientFingerprint.Unknown);

        (await db.Users.SingleAsync()).Role.ShouldBe(UserRole.Student);
    }

    [SkippableFact]
    public async Task A_student_registration_carries_the_grade_to_the_directory()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var directory = new RecordingAccountDirectoryClient();
        var auth = CreateService(db, directory);

        await auth.RegisterAsync(
            new RegisterRequest("ogrenci@example.com", Password, "Can", "Demir", null, "Student", 8, "Lgs"),
            ClientFingerprint.Unknown);

        var mirrored = directory.Mirrored.Single();
        mirrored.GradeLevel.ShouldBe(8);
        mirrored.ExamTarget.ShouldBe("Lgs");
    }

    [SkippableFact]
    public async Task A_child_account_signs_in_by_user_name_and_its_token_has_no_email()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);

        var child = await auth.CreateChildAccountAsync(
            new CreateChildAccountRequest("Ela", "Yılmaz", "Ela.Yilmaz", Password, 3, null));

        child.ShouldNotBeNull();
        child.Username.ShouldBe(ChildUsername);
        child.Email.ShouldBeNull();

        var login = await auth.LoginAsync(new LoginRequest(Email: null, Password: Password, Username: ChildUsername), ClientFingerprint.Unknown);

        login.ShouldNotBeNull();
        login.User.Username.ShouldBe(ChildUsername);
        var token = new JwtSecurityTokenHandler().ReadJwtToken(login.AccessToken);
        token.Claims.ShouldNotContain(c => c.Type == JwtRegisteredClaimNames.Email);
        token.Claims.ShouldContain(c => c.Type == "username" && c.Value == ChildUsername);
    }

    [SkippableFact]
    public async Task A_wrong_password_or_unknown_user_name_is_rejected()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);
        await auth.CreateChildAccountAsync(new CreateChildAccountRequest("Ela", "Yılmaz", ChildUsername, Password, 3, null));

        (await auth.LoginAsync(new LoginRequest(Email: null, Password: OtherPassword, Username: ChildUsername), ClientFingerprint.Unknown)).ShouldBeNull();
        (await auth.LoginAsync(new LoginRequest(Email: null, Password: Password, Username: UnknownUsername), ClientFingerprint.Unknown)).ShouldBeNull();
    }

    [SkippableFact]
    public async Task A_taken_user_name_is_refused()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);

        var first = await auth.CreateChildAccountAsync(new CreateChildAccountRequest("Ela", "Yılmaz", ChildUsername, Password, 3, null));
        var second = await auth.CreateChildAccountAsync(new CreateChildAccountRequest("Ela", "Kaya", "ELA.YILMAZ", Password, 4, null));

        first.ShouldNotBeNull();
        second.ShouldBeNull();
    }

    [SkippableFact]
    public async Task A_deactivated_child_account_cannot_sign_in()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);
        var child = await auth.CreateChildAccountAsync(new CreateChildAccountRequest("Ela", "Yılmaz", ChildUsername, Password, 3, null));

        await auth.SetAccountActiveAsync(child!.Id, isActive: false);

        (await auth.LoginAsync(new LoginRequest(Email: null, Password: Password, Username: ChildUsername), ClientFingerprint.Unknown)).ShouldBeNull();
    }

    [SkippableFact]
    public async Task A_role_change_is_applied_to_new_tokens_and_ends_existing_sessions()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db, requireVerification: false);
        await auth.RegisterAsync(
            new RegisterRequest("ogretmen@example.com", Password, "Ali", "Kaya", null, "Student", 10),
            ClientFingerprint.Unknown);
        var before = await auth.LoginAsync(new LoginRequest("ogretmen@example.com", Password), ClientFingerprint.Unknown);
        var userId = (await db.Users.SingleAsync()).Id;

        (await auth.SetAccountRoleAsync(userId, UserRole.Instructor)).ShouldBeTrue();

        (await auth.RefreshTokenAsync(before!.RefreshToken, ClientFingerprint.Unknown)).ShouldBeNull();
        var after = await auth.LoginAsync(new LoginRequest("ogretmen@example.com", Password), ClientFingerprint.Unknown);
        after!.User.Role.ShouldBe("Instructor");
    }

    [SkippableFact]
    public async Task Setting_a_password_replaces_the_old_one()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var auth = CreateService(db);
        var child = await auth.CreateChildAccountAsync(new CreateChildAccountRequest("Ela", "Yılmaz", ChildUsername, Password, 3, null));

        (await auth.SetAccountPasswordAsync(child!.Id, OtherPassword)).ShouldBeTrue();

        (await auth.LoginAsync(new LoginRequest(Email: null, Password: Password, Username: ChildUsername), ClientFingerprint.Unknown)).ShouldBeNull();
        (await auth.LoginAsync(new LoginRequest(Email: null, Password: OtherPassword, Username: ChildUsername), ClientFingerprint.Unknown)).ShouldNotBeNull();
    }

    private async Task<AuthDbContext> FreshDbAsync()
    {
        var db = new AuthDbContext(new DbContextOptionsBuilder<AuthDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("auth_child_accounts"))
            .Options);
        await db.Database.EnsureCreatedAsync();
        await db.RefreshTokens.ExecuteDeleteAsync();
        await db.Users.ExecuteDeleteAsync();
        return db;
    }

    /// <summary>
    /// Verification is required by default so the user-name tests prove it does not lock out accounts that
    /// have no address to verify.
    /// </summary>
    private static AuthenticationService CreateService(
        AuthDbContext db,
        IAccountDirectoryClient? directory = null,
        bool requireVerification = true)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT:Secret"] = "unit-test-secret-key-32-characters!",
                ["JWT:Issuer"] = "EduPlatform",
                ["JWT:Audience"] = "EduPlatformUsers",
                ["Email:RequireVerification"] = requireVerification ? "true" : "false"
            })
            .Build();

        return new AuthenticationService(
            db,
            configuration,
            new NullAccountEmailService(),
            new NullAuditLogger(),
            directory ?? new RecordingAccountDirectoryClient(),
            NullLogger<AuthenticationService>.Instance);
    }
}
