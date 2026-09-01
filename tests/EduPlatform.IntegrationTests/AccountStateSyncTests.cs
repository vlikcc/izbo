using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.Internal;
using Shared.Models;
using Shouldly;
using UserService.Data;
using UserService.Services;

namespace EduPlatform.IntegrationTests;

/// <summary>
/// The admin directory and the authentication store hold separate copies of a user. Disabling an
/// account used to write only the directory's copy, so the panel showed "Pasif" while the account kept
/// logging in. These tests pin the flag to the store that actually gates login.
/// </summary>
[Collection("postgres")]
public class AccountStateSyncTests
{
    private readonly PostgresFixture _postgres;

    public AccountStateSyncTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    private static readonly Guid AdminId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid StudentId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private UserDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<UserDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("account_state_sync"))
            .Options);

    /// <summary>Fresh rows per test; the catalog is shared across the collection.</summary>
    private async Task<UserDbContext> SeededDbAsync()
    {
        var db = CreateDb();
        await db.Database.EnsureCreatedAsync();
        await db.Users.ExecuteDeleteAsync();
        db.Users.AddRange(
            new User { Id = AdminId, Email = "admin@test.local", FirstName = "Sys", LastName = "Admin", Role = UserRole.SuperAdmin, IsActive = true },
            new User { Id = StudentId, Email = "student@test.local", FirstName = "Test", LastName = "Student", Role = UserRole.Student, IsActive = false });
        await db.SaveChangesAsync();
        return db;
    }

    private static UserManagementService CreateService(UserDbContext db, IAccountStateClient accountState) =>
        new(db, new NullAuditLogger(), accountState, NullLogger<UserManagementService>.Instance);

    private static Caller Admin => new(AdminId, UserRole.SuperAdmin);

    [SkippableFact]
    public async Task Activating_a_user_pushes_the_flag_to_the_authentication_store()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var authStore = new RecordingAccountStateClient();
        var service = CreateService(db, authStore);

        var outcome = await service.SetUserActiveAsync(StudentId, isActive: true, Admin);

        outcome.ShouldBe(SetActiveOutcome.Updated);
        // The whole point: the directory row alone proves nothing about whether the person can log in.
        authStore.Applied.ShouldContain((StudentId, true));
        (await db.Users.FirstAsync(u => u.Id == StudentId)).IsActive.ShouldBeTrue();
    }

    [SkippableFact]
    public async Task Deactivating_a_user_pushes_the_flag_to_the_authentication_store()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var authStore = new RecordingAccountStateClient();
        var service = CreateService(db, authStore);

        var outcome = await service.SetUserActiveAsync(StudentId, isActive: false, Admin);

        outcome.ShouldBe(SetActiveOutcome.Updated);
        authStore.Applied.ShouldContain((StudentId, false));
    }

    [SkippableFact]
    public async Task An_unreachable_authentication_store_fails_the_change_instead_of_half_applying_it()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var authStore = new RecordingAccountStateClient { Available = false };
        var service = CreateService(db, authStore);

        var outcome = await service.SetUserActiveAsync(StudentId, isActive: true, Admin);

        outcome.ShouldBe(SetActiveOutcome.AuthServiceUnavailable);
        // Leaving the directory saying "Aktif" while login still refuses is the failure this guards.
        (await db.Users.FirstAsync(u => u.Id == StudentId)).IsActive.ShouldBeFalse();
    }

    [SkippableFact]
    public async Task Deactivating_your_own_account_is_refused_and_never_reaches_the_authentication_store()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var authStore = new RecordingAccountStateClient();
        var service = CreateService(db, authStore);

        var outcome = await service.SetUserActiveAsync(AdminId, isActive: false, Admin);

        outcome.ShouldBe(SetActiveOutcome.Forbidden);
        authStore.Applied.ShouldBeEmpty();
    }

    [SkippableFact]
    public async Task An_unknown_user_reports_not_found()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var service = CreateService(db, new RecordingAccountStateClient());

        var outcome = await service.SetUserActiveAsync(Guid.NewGuid(), isActive: true, Admin);

        outcome.ShouldBe(SetActiveOutcome.NotFound);
    }

    [SkippableFact]
    public async Task A_mirrored_account_appears_in_the_directory_under_the_same_id()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();
        await db.Users.ExecuteDeleteAsync();
        var service = CreateService(db, new RecordingAccountStateClient());
        var accountId = Guid.NewGuid();

        var synced = await service.UpsertProfileAsync(
            new AccountProfileSync(accountId, "New.User@Test.Local", "New", "User", "Instructor", null, true));

        synced.ShouldBeTrue();
        var profile = await db.Users.SingleAsync();
        // Same id in both services is what makes the admin toggle able to address the account at all.
        profile.Id.ShouldBe(accountId);
        profile.Email.ShouldBe("new.user@test.local");
        profile.Role.ShouldBe(UserRole.Instructor);
    }

    [SkippableFact]
    public async Task Re_mirroring_refreshes_identity_without_resetting_administered_fields()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var service = CreateService(db, new RecordingAccountStateClient());

        // Login re-syncs on every sign-in; it must not undo an admin's role or activation decision.
        await service.UpsertProfileAsync(
            new AccountProfileSync(StudentId, "renamed@test.local", "Renamed", "Student", "SuperAdmin", null, true));

        var profile = await db.Users.FirstAsync(u => u.Id == StudentId);
        profile.FirstName.ShouldBe("Renamed");
        profile.Email.ShouldBe("renamed@test.local");
        profile.Role.ShouldBe(UserRole.Student);
        profile.IsActive.ShouldBeFalse();
    }

    [SkippableFact]
    public async Task Mirroring_adopts_an_existing_profile_that_shares_the_address()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var service = CreateService(db, new RecordingAccountStateClient());

        // Accounts seeded before ids were shared already have a row under a different id; inserting a
        // second one would collide on the unique e-mail index.
        await service.UpsertProfileAsync(
            new AccountProfileSync(Guid.NewGuid(), "student@test.local", "Test", "Student", "Student", null, true));

        (await db.Users.CountAsync()).ShouldBe(2);
    }

    [SkippableFact]
    public async Task A_deleted_profile_is_not_resurrected_by_a_re_sync()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await SeededDbAsync();
        var service = CreateService(db, new RecordingAccountStateClient());
        var student = await db.Users.FirstAsync(u => u.Id == StudentId);
        student.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var synced = await service.UpsertProfileAsync(
            new AccountProfileSync(StudentId, "student@test.local", "Test", "Student", "Student", null, true));

        synced.ShouldBeFalse();
        (await db.Users.FirstAsync(u => u.Id == StudentId)).DeletedAt.ShouldNotBeNull();
    }
}
