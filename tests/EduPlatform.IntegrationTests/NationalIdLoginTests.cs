using System.Security.Cryptography;
using AuthService.Data;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>
/// YZ Kampüs T.C. Kimlik No sign-in: checksum, one answer for every kind of failure, a lockout that does not
/// reveal which numbers are registered, and the number never stored in the clear.
/// </summary>
[Collection("postgres")]
public class NationalIdLoginTests
{
    private const string StudentNumber = "10000001754";
    private const string UnknownNumber = "10000001068";
    private const string DemoNumber = "12345678910";

    private static readonly string Password = "Kampus" + TestPasswords.Strong();

    private readonly PostgresFixture _postgres;

    public NationalIdLoginTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task A_student_signs_in_with_number_and_password_and_the_number_is_stored_encrypted()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, protector, _) = Create(db);
        var userId = await CreateStudentAsync(db, service);

        var result = await service.LoginAsync(new NationalIdLoginRequest(" 100 000 017 54 ", Password, "ogrenci"), ClientFingerprint.Unknown);

        result.Status.ShouldBe(NationalIdLoginStatus.Success);
        result.Auth!.User.Id.ShouldBe(userId);
        result.Auth.AccessToken.ShouldNotContain(StudentNumber);

        var stored = await db.NationalIdCredentials.SingleAsync();
        stored.LookupHash.ShouldNotContain(StudentNumber);
        stored.Ciphertext.ShouldNotContain(StudentNumber);
        protector.Decrypt(stored.Ciphertext).ShouldBe(StudentNumber);
    }

    [SkippableFact]
    public async Task Wrong_password_unknown_number_wrong_role_and_disabled_account_fail_the_same_way()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, _) = Create(db);
        var userId = await CreateStudentAsync(db, service);

        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password + "x"), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);
        (await service.LoginAsync(new NationalIdLoginRequest(UnknownNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);
        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password, "veli"), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);

        await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);
    }

    [SkippableFact]
    public async Task Malformed_numbers_are_refused_before_any_lookup_and_the_demo_number_needs_the_flag()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (strict, _, _) = Create(db);

        (await strict.LoginAsync(new NationalIdLoginRequest("10000001755", Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.InvalidNumber);
        (await strict.LoginAsync(new NationalIdLoginRequest(DemoNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.InvalidNumber);
        (await strict.LoginAsync(new NationalIdLoginRequest(StudentNumber, ""), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.MissingPassword);
        (await strict.AssignAsync(Guid.NewGuid(), DemoNumber)).ShouldBe(NationalIdAssignmentStatus.InvalidNumber);
        (await db.NationalIdLoginThrottles.CountAsync()).ShouldBe(0, "format errors are not failed sign-ins");

        var (demo, _, _) = Create(db, allowDemo: true);
        var userId = await CreateUserAsync(db);
        (await demo.AssignAsync(userId, DemoNumber)).ShouldBe(NationalIdAssignmentStatus.Updated);
        (await demo.LoginAsync(new NationalIdLoginRequest(DemoNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Success);
    }

    [SkippableFact]
    public async Task Five_failures_lock_the_number_even_for_the_right_password_until_the_lock_expires()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, time) = Create(db);
        await CreateStudentAsync(db, service);

        for (var i = 0; i < 4; i++)
        {
            (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, "Yanlis" + i), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);
        }

        var fifth = await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, "Yanlis5"), ClientFingerprint.Unknown);
        fifth.Status.ShouldBe(NationalIdLoginStatus.LockedOut);
        fifth.RetryAfterSeconds.ShouldBe(300);

        var locked = await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password), ClientFingerprint.Unknown);
        locked.Status.ShouldBe(NationalIdLoginStatus.LockedOut);

        time.Advance(TimeSpan.FromSeconds(301));
        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Success);
        (await db.NationalIdLoginThrottles.CountAsync()).ShouldBe(0, "a successful sign-in clears the counter");
    }

    [SkippableFact]
    public async Task An_unregistered_number_locks_exactly_like_a_registered_one()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, _) = Create(db);

        var statuses = new List<NationalIdLoginStatus>();
        for (var i = 0; i < 6; i++)
        {
            statuses.Add((await service.LoginAsync(new NationalIdLoginRequest(UnknownNumber, Password), ClientFingerprint.Unknown)).Status);
        }

        statuses.ShouldBe([
            NationalIdLoginStatus.Rejected, NationalIdLoginStatus.Rejected, NationalIdLoginStatus.Rejected, NationalIdLoginStatus.Rejected,
            NationalIdLoginStatus.LockedOut, NationalIdLoginStatus.LockedOut
        ]);
    }

    [SkippableFact]
    public async Task Concurrent_failures_are_all_counted()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using (var db = await FreshDbAsync())
        {
        }

        var time = new MutableTime(DateTimeOffset.UtcNow);
        await Task.WhenAll(Enumerable.Range(0, 4).Select(async i =>
        {
            await using var db = CreateDb();
            var (service, _, _) = Create(db, time: time);
            await service.LoginAsync(new NationalIdLoginRequest(UnknownNumber, "Yanlis" + i), ClientFingerprint.Unknown);
        }));

        await using var check = CreateDb();
        (await check.NationalIdLoginThrottles.SingleAsync()).FailedCount.ShouldBe(4);
    }

    [SkippableFact]
    public async Task A_number_belongs_to_one_account()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, _) = Create(db);
        var first = await CreateUserAsync(db);
        var second = await CreateUserAsync(db);

        (await service.AssignAsync(first, StudentNumber)).ShouldBe(NationalIdAssignmentStatus.Updated);
        (await service.AssignAsync(second, StudentNumber)).ShouldBe(NationalIdAssignmentStatus.InUse);
        (await service.AssignAsync(first, StudentNumber)).ShouldBe(NationalIdAssignmentStatus.Updated, "re-assigning the same number is idempotent");
        (await service.AssignAsync(Guid.NewGuid(), UnknownNumber)).ShouldBe(NationalIdAssignmentStatus.UserNotFound);
    }

    [SkippableFact]
    public async Task Without_keys_the_sign_in_is_unavailable_rather_than_storing_numbers_unprotected()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, _) = Create(db, configured: false);

        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Unavailable);
        (await service.AssignAsync(Guid.NewGuid(), StudentNumber)).ShouldBe(NationalIdAssignmentStatus.Unavailable);
    }

    [SkippableFact]
    public async Task Changing_the_password_checks_the_current_one_and_the_kampus_rules()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var (service, _, _) = Create(db);
        var auth = CreateAuth(db);
        var userId = await CreateStudentAsync(db, service);
        var next = "Yeni" + TestPasswords.Strong();

        (await auth.ChangePasswordAsync(userId, new ChangeOwnPasswordRequest("yanlis", next, next), ClientFingerprint.Unknown)).Error.ShouldBe("Mevcut şifre hatalı.");
        (await auth.ChangePasswordAsync(userId, new ChangeOwnPasswordRequest(Password, "kisa", "kisa"), ClientFingerprint.Unknown)).Error.ShouldNotBeNull();
        (await auth.ChangePasswordAsync(userId, new ChangeOwnPasswordRequest(Password, next, next + "x"), ClientFingerprint.Unknown)).Error.ShouldBe("Yeni şifreler birbiriyle aynı değil.");
        (await auth.ChangePasswordAsync(userId, new ChangeOwnPasswordRequest(Password, Password, Password), ClientFingerprint.Unknown)).Error.ShouldBe("Yeni şifre eskisiyle aynı olamaz.");

        var ok = await auth.ChangePasswordAsync(userId, new ChangeOwnPasswordRequest(Password, next, next), ClientFingerprint.Unknown);
        ok.Error.ShouldBeNull();
        ok.Auth.ShouldNotBeNull();
        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, Password), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Rejected);
        (await service.LoginAsync(new NationalIdLoginRequest(StudentNumber, next), ClientFingerprint.Unknown)).Status.ShouldBe(NationalIdLoginStatus.Success);
    }

    [Theory]
    [InlineData(UserRole.Student, "ogrenci", true)]
    [InlineData(UserRole.Instructor, "ogretmen", true)]
    [InlineData(UserRole.Parent, "veli", true)]
    [InlineData(UserRole.Parent, null, true)]
    [InlineData(UserRole.Student, "veli", false)]
    [InlineData(UserRole.Admin, "ogretmen", false)]
    [InlineData(UserRole.Student, "yonetici", false)]
    public void The_role_picker_must_match_the_account(UserRole actual, string? requested, bool matches) =>
        NationalIdAuthService.RoleMatches(actual, requested).ShouldBe(matches);

    [Fact]
    public void Lookup_hashes_depend_on_the_key_and_ciphertexts_are_never_repeated()
    {
        var a = Protector(Key(), Key());
        var b = Protector(Key(), Key());

        a.LookupHash(StudentNumber).ShouldBe(a.LookupHash(StudentNumber));
        a.LookupHash(StudentNumber).ShouldNotBe(b.LookupHash(StudentNumber));
        a.Encrypt(StudentNumber).ShouldNotBe(a.Encrypt(StudentNumber));
        a.Decrypt(a.Encrypt(StudentNumber)).ShouldBe(StudentNumber);
        Should.Throw<CryptographicException>(() => b.Decrypt(a.Encrypt(StudentNumber)));
        Protector(null, Key()).IsConfigured.ShouldBeFalse();
        Protector(Key(), Convert.ToBase64String(new byte[16])).IsConfigured.ShouldBeFalse();
    }

    private static string Key() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    private static NationalIdProtector Protector(string? lookup, string? encryption) =>
        new(Options.Create(new NationalIdOptions { LookupKey = lookup, EncryptionKey = encryption }));

    private static (NationalIdAuthService Service, NationalIdProtector Protector, MutableTime Time) Create(
        AuthDbContext db, bool allowDemo = false, bool configured = true, MutableTime? time = null)
    {
        var options = Options.Create(new NationalIdOptions
        {
            LookupKey = configured ? LookupKey : null,
            EncryptionKey = configured ? EncryptionKey : null,
            AllowDemoNumbers = allowDemo
        });
        var protector = new NationalIdProtector(options);
        time ??= new MutableTime(DateTimeOffset.UtcNow);
        var service = new NationalIdAuthService(db, protector, options, CreateAuth(db), new NullAuditLogger(), time, NullLogger<NationalIdAuthService>.Instance);
        return (service, protector, time);
    }

    private static readonly string LookupKey = Key();
    private static readonly string EncryptionKey = Key();

    private static AuthenticationService CreateAuth(AuthDbContext db) => new(
        db,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JWT:Secret"] = "unit-test-secret-key-32-characters!",
            ["JWT:Issuer"] = "EduPlatform",
            ["JWT:Audience"] = "EduPlatformUsers"
        }).Build(),
        new NullAccountEmailService(),
        new NullAuditLogger(),
        new RecordingAccountDirectoryClient(),
        NullLogger<AuthenticationService>.Instance);

    private static async Task<Guid> CreateUserAsync(AuthDbContext db, UserRole role = UserRole.Student)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "k" + Guid.NewGuid().ToString("N")[..12],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password),
            FirstName = "Ada",
            LastName = "Yıldız",
            Role = role
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    private static async Task<Guid> CreateStudentAsync(AuthDbContext db, NationalIdAuthService service)
    {
        var id = await CreateUserAsync(db);
        (await service.AssignAsync(id, StudentNumber)).ShouldBe(NationalIdAssignmentStatus.Updated);
        return id;
    }

    private AuthDbContext CreateDb() => new(new DbContextOptionsBuilder<AuthDbContext>()
        .UseNpgsql(_postgres.ConnectionStringFor("auth_national_id"))
        .Options);

    private async Task<AuthDbContext> FreshDbAsync()
    {
        var db = CreateDb();
        await db.Database.MigrateAsync();
        await db.NationalIdLoginThrottles.ExecuteDeleteAsync();
        await db.NationalIdCredentials.ExecuteDeleteAsync();
        await db.RefreshTokens.ExecuteDeleteAsync();
        await db.Users.ExecuteDeleteAsync();
        return db;
    }
}
