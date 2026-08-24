using AuthService.Data;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.DTOs;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class AuthEnumerationTests
{
    private readonly PostgresFixture _postgres;

    public AuthEnumerationTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Registering_an_existing_address_does_not_create_a_second_user()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();
        var auth = CreateService(db);

        var request = new RegisterRequest(
            "ada@example.com",
            "Correct-Horse-9",
            "Ada",
            "Lovelace",
            null,
            "Student");

        var first = await auth.RegisterAsync(request, ClientFingerprint.Unknown);
        var second = await auth.RegisterAsync(request, ClientFingerprint.Unknown);

        first.Outcome.ShouldBe(RegistrationOutcome.Created);
        second.Outcome.ShouldBe(RegistrationOutcome.AlreadyRegistered);
        db.Users.Count().ShouldBe(1);
    }

    [SkippableFact]
    public async Task Login_with_an_unknown_address_returns_null_like_a_wrong_password()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();
        var auth = CreateService(db);

        var missing = await auth.LoginAsync(
            new LoginRequest("nobody@example.com", "Correct-Horse-9"),
            ClientFingerprint.Unknown);

        missing.ShouldBeNull();
    }

    private AuthDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AuthDbContext>()
            .UseNpgsql(_postgres.ConnectionString)
            .Options;
        return new AuthDbContext(options);
    }

    private static AuthenticationService CreateService(AuthDbContext db)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT:Secret"] = "unit-test-secret-key-32-characters!",
                ["JWT:Issuer"] = "EduPlatform",
                ["JWT:Audience"] = "EduPlatformUsers",
                ["JWT:AccessTokenExpirationMinutes"] = "15",
                ["JWT:RefreshTokenExpirationDays"] = "7"
            })
            .Build();

        return new AuthenticationService(db, configuration, NullLogger<AuthenticationService>.Instance);
    }
}
