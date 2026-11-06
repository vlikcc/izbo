using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.DTOs;
using Shared.Internal;
using Shared.Models;
using Shouldly;
using UserService.Data;
using UserService.Services;

namespace EduPlatform.IntegrationTests;

/// <summary>Parent ↔ student links: who may be linked, by which route, and what a link allows.</summary>
[Collection("postgres")]
public class GuardianLinkTests
{
    private static readonly Guid ParentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherParentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid TeenId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    private static readonly string Password = TestPasswords.Strong();
    private static readonly string NewPassword = TestPasswords.Strong();

    private readonly PostgresFixture _postgres;

    public GuardianLinkTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Opening_a_child_account_links_it_to_the_parent()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var auth = new RecordingAccountStateClient();
        var guardians = CreateService(db, auth);

        var result = await guardians.CreateChildAsync(ParentId, new CreateChildRequest("Ela", "Yılmaz", "Ela.Yilmaz", Password, 3));

        result.Outcome.ShouldBe(CreateChildOutcome.Created);
        result.Child!.Username.ShouldBe("ela.yilmaz");
        result.Child.GradeLevel.ShouldBe(3);
        auth.CreatedChildren.Single().Username.ShouldBe("ela.yilmaz");
        (await guardians.GetChildrenAsync(ParentId)).Select(c => c.Id).ShouldBe([result.Child.Id]);
        (await guardians.IsGuardianAsync(ParentId, result.Child.Id)).ShouldBeTrue();
        (await guardians.IsGuardianAsync(OtherParentId, result.Child.Id)).ShouldBeFalse();
    }

    [SkippableFact]
    public async Task A_taken_user_name_or_an_unreachable_auth_service_creates_nothing()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var auth = new RecordingAccountStateClient();
        auth.TakenUsernames.Add("ela.yilmaz");
        var guardians = CreateService(db, auth);

        (await guardians.CreateChildAsync(ParentId, new CreateChildRequest("Ela", "Yılmaz", "ela.yilmaz", Password, 3)))
            .Outcome.ShouldBe(CreateChildOutcome.UsernameTaken);

        auth.Available = false;
        (await guardians.CreateChildAsync(ParentId, new CreateChildRequest("Can", "Yılmaz", "can.yilmaz", Password, 5)))
            .Outcome.ShouldBe(CreateChildOutcome.AuthServiceUnavailable);

        (await db.GuardianLinks.CountAsync()).ShouldBe(0);
    }

    [SkippableFact]
    public async Task A_link_code_links_one_parent_once()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var guardians = CreateService(db);

        var code = await guardians.IssueLinkCodeAsync(TeenId);
        code.ShouldNotBeNull();
        code.Code.Length.ShouldBe(8);

        // Typed the way people copy codes: lower case, grouped with a dash.
        var typed = $"{code.Code[..4].ToLowerInvariant()}-{code.Code[4..]}";
        (await guardians.LinkChildAsync(ParentId, typed)).Outcome.ShouldBe(LinkChildOutcome.Linked);
        (await guardians.LinkChildAsync(OtherParentId, code.Code)).Outcome.ShouldBe(LinkChildOutcome.InvalidCode);
        (await guardians.IsGuardianAsync(ParentId, TeenId)).ShouldBeTrue();
        (await guardians.IsGuardianAsync(OtherParentId, TeenId)).ShouldBeFalse();
    }

    [SkippableFact]
    public async Task Issuing_a_new_code_retires_the_previous_one_and_expired_codes_fail()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var guardians = CreateService(db);

        var first = await guardians.IssueLinkCodeAsync(TeenId);
        var second = await guardians.IssueLinkCodeAsync(TeenId);

        (await guardians.LinkChildAsync(ParentId, first!.Code)).Outcome.ShouldBe(LinkChildOutcome.InvalidCode);

        await db.GuardianLinkCodes.ExecuteUpdateAsync(c => c.SetProperty(x => x.ExpiresAt, DateTime.UtcNow.AddMinutes(-1)));
        (await guardians.LinkChildAsync(ParentId, second!.Code)).Outcome.ShouldBe(LinkChildOutcome.InvalidCode);
    }

    [SkippableFact]
    public async Task Only_students_can_issue_link_codes()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var guardians = CreateService(db);

        (await guardians.IssueLinkCodeAsync(ParentId)).ShouldBeNull();
    }

    [SkippableFact]
    public async Task A_parent_may_reset_only_the_user_name_accounts_they_opened()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var auth = new RecordingAccountStateClient();
        var guardians = CreateService(db, auth);

        var child = (await guardians.CreateChildAsync(ParentId, new CreateChildRequest("Ela", "Yılmaz", "ela.yilmaz", Password, 3))).Child!;
        var code = await guardians.IssueLinkCodeAsync(TeenId);
        await guardians.LinkChildAsync(ParentId, code!.Code);

        (await guardians.ResetChildPasswordAsync(ParentId, child.Id, NewPassword)).ShouldBe(ResetChildPasswordOutcome.Updated);
        // The teen registered with their own address and keeps control of their credentials.
        (await guardians.ResetChildPasswordAsync(ParentId, TeenId, NewPassword)).ShouldBe(ResetChildPasswordOutcome.NotAllowed);
        (await guardians.ResetChildPasswordAsync(OtherParentId, child.Id, NewPassword)).ShouldBe(ResetChildPasswordOutcome.NotAllowed);
        auth.Passwords.ShouldBe([(child.Id, NewPassword)]);
    }

    [SkippableFact]
    public async Task Unlinking_removes_access_but_keeps_the_account()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var guardians = CreateService(db);
        var code = await guardians.IssueLinkCodeAsync(TeenId);
        await guardians.LinkChildAsync(ParentId, code!.Code);

        (await guardians.UnlinkChildAsync(ParentId, TeenId)).ShouldBeTrue();

        (await guardians.IsGuardianAsync(ParentId, TeenId)).ShouldBeFalse();
        (await db.Users.AnyAsync(u => u.Id == TeenId)).ShouldBeTrue();
        (await guardians.UnlinkChildAsync(ParentId, TeenId)).ShouldBeFalse();
    }

    [SkippableFact]
    public async Task A_parent_cannot_link_more_than_the_limit()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        db.GuardianLinks.AddRange(Enumerable.Range(0, GuardianService.MaxChildrenPerParent)
            .Select(_ => new GuardianLink { Id = Guid.NewGuid(), ParentId = ParentId, StudentId = Guid.NewGuid() }));
        await db.SaveChangesAsync();
        var guardians = CreateService(db);

        (await guardians.CreateChildAsync(ParentId, new CreateChildRequest("Ela", "Yılmaz", "ela.yilmaz", Password, 3)))
            .Outcome.ShouldBe(CreateChildOutcome.TooManyChildren);
    }

    [SkippableFact]
    public async Task A_login_re_sync_keeps_the_school_profile()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var users = new UserManagementService(db, new NullAuditLogger(), new RecordingAccountStateClient(), NullLogger<UserManagementService>.Instance);

        // AuthService does not keep school fields, so its login mirror carries none.
        await users.UpsertProfileAsync(new AccountProfileSync(TeenId, "teen@test.local", "Deniz", "Ak", "Student", null, true));

        var teen = await db.Users.AsNoTracking().SingleAsync(u => u.Id == TeenId);
        teen.GradeLevel.ShouldBe(11);
        teen.ExamTarget.ShouldBe(ExamTarget.Yks);
    }

    private async Task<UserDbContext> SeededDbAsync()
    {
        var db = new UserDbContext(new DbContextOptionsBuilder<UserDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("guardian_links"))
            .Options);
        await db.Database.EnsureCreatedAsync();
        await db.GuardianLinkCodes.ExecuteDeleteAsync();
        await db.GuardianLinks.ExecuteDeleteAsync();
        await db.Users.ExecuteDeleteAsync();

        db.Users.AddRange(
            new User { Id = ParentId, Email = "veli@test.local", FirstName = "Ayşe", LastName = "Yılmaz", Role = UserRole.Parent },
            new User { Id = OtherParentId, Email = "baska@test.local", FirstName = "Mehmet", LastName = "Kara", Role = UserRole.Parent },
            new User
            {
                Id = TeenId, Email = "teen@test.local", FirstName = "Deniz", LastName = "Ak", Role = UserRole.Student,
                GradeLevel = 11, ExamTarget = ExamTarget.Yks
            });
        await db.SaveChangesAsync();
        return db;
    }

    private static GuardianService CreateService(UserDbContext db, RecordingAccountStateClient? auth = null)
    {
        auth ??= new RecordingAccountStateClient();
        var users = new UserManagementService(db, new NullAuditLogger(), auth, NullLogger<UserManagementService>.Instance);
        return new GuardianService(db, users, auth, new NullAuditLogger(), NullLogger<GuardianService>.Instance);
    }
}
