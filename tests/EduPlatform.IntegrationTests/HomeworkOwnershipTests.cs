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

    [SkippableFact]
    public async Task Homework_can_point_students_to_a_topic_test_and_the_link_can_be_removed()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb("homework_links");
        await db.Database.MigrateAsync();

        var classroomId = Guid.NewGuid();
        var topicId = Guid.NewGuid();
        var teacher = new Caller(Guid.NewGuid(), UserRole.Instructor);
        var student = Guid.NewGuid();
        var access = new FakeClassroomAccessClient();
        access.Manageable.Add(classroomId);
        access.Viewable.Add(classroomId);
        access.StudentClassrooms[student] = [classroomId];
        var service = new HomeworkManagementService(db, new NoopQuotaGuard(), access, new NullAuditLogger(), NullLogger<HomeworkManagementService>.Instance);

        var created = (await service.CreateHomeworkAsync(
            new CreateHomeworkRequest(classroomId, "Bölme testi", "Konu testini çöz.", null, 100, DateTime.UtcNow.AddDays(3), false, 0,
                HomeworkLinkKind.TopicTest, topicId, "  Bölme  "),
            teacher))!;

        (created.LinkKind, created.LinkTargetId, created.LinkTitle).ShouldBe((HomeworkLinkKind.TopicTest, (Guid?)topicId, "Bölme"));
        var seen = (await service.GetStudentHomeworkAsync(student)).ShouldHaveSingleItem().Homework;
        (seen.LinkKind, seen.LinkTargetId).ShouldBe((HomeworkLinkKind.TopicTest, (Guid?)topicId));

        var cleared = (await service.UpdateHomeworkAsync(created.Id,
            new UpdateHomeworkRequest(null, null, null, null, null, null, null, HomeworkLinkKind.None, topicId, "x"), teacher))!;
        (cleared.LinkKind, cleared.LinkTargetId, cleared.LinkTitle).ShouldBe((HomeworkLinkKind.None, (Guid?)null, (string?)null));

        db.ChangeTracker.Clear();
        (await db.Homeworks.SingleAsync(h => h.Id == created.Id)).LinkKind.ShouldBe(HomeworkLinkKind.None);
    }

    private HomeworkDbContext CreateDb(string database = "homework_ownership")
    {
        var options = new DbContextOptionsBuilder<HomeworkDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor(database))
            .Options;
        return new HomeworkDbContext(options);
    }
}
