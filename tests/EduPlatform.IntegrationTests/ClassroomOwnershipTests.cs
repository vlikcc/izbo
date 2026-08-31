using ClassroomService.Data;
using ClassroomService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class ClassroomOwnershipTests
{
    private readonly PostgresFixture _postgres;

    public ClassroomOwnershipTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Instructor_cannot_update_a_classroom_they_do_not_own()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();

        var owner = new Caller(Guid.NewGuid(), UserRole.Instructor);
        var stranger = new Caller(Guid.NewGuid(), UserRole.Instructor);
        var service = new ClassroomManagementService(db, new NoopQuotaGuard(), NullLogger<ClassroomManagementService>.Instance);

        var created = await service.CreateClassroomAsync(
            new CreateClassroomRequest("Cebir", "11. sınıf", null),
            owner.UserId);

        created.ShouldNotBeNull();

        var updated = await service.UpdateClassroomAsync(
            created.Id,
            new UpdateClassroomRequest("Ele geçirildi", null, null),
            stranger);

        updated.ShouldBeNull();

        var stored = await db.Classrooms.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        stored.Name.ShouldBe("Cebir");
    }

    [SkippableFact]
    public async Task Student_not_enrolled_cannot_read_a_classroom()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();

        var owner = new Caller(Guid.NewGuid(), UserRole.Instructor);
        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var service = new ClassroomManagementService(db, new NoopQuotaGuard(), NullLogger<ClassroomManagementService>.Instance);

        var created = await service.CreateClassroomAsync(
            new CreateClassroomRequest("Geometri", "", null),
            owner.UserId);

        created.ShouldNotBeNull();

        var visible = await service.GetClassroomAsync(created.Id, student);
        visible.ShouldBeNull();
    }

    private ClassroomDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ClassroomDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("classroom_ownership"))
            .Options;
        return new ClassroomDbContext(options);
    }
}
