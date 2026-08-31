using HomeworkService.Data;
using HomeworkService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class HomeworkOwnershipTests
{
    private readonly PostgresFixture _postgres;

    public HomeworkOwnershipTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Instructor_cannot_create_homework_in_a_classroom_they_do_not_teach()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();

        var access = new FakeClassroomAccessClient();
        var service = new HomeworkManagementService(db, new NoopQuotaGuard(), access, new NullAuditLogger(), NullLogger<HomeworkManagementService>.Instance);
        var stranger = new Caller(Guid.NewGuid(), UserRole.Instructor);

        var created = await service.CreateHomeworkAsync(
            new CreateHomeworkRequest(
                Guid.NewGuid(),
                "Ödev",
                "Açıklama",
                null,
                100,
                DateTime.UtcNow.AddDays(7),
                false,
                0),
            stranger);

        created.ShouldBeNull();
        db.Homeworks.Count().ShouldBe(0);
    }

    private HomeworkDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<HomeworkDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("homework_ownership"))
            .Options;
        return new HomeworkDbContext(options);
    }
}
