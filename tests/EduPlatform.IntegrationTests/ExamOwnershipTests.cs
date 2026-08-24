using ExamService.Data;
using ExamService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class ExamOwnershipTests
{
    private readonly PostgresFixture _postgres;

    public ExamOwnershipTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Student_outside_the_classroom_cannot_read_an_exam()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();

        var classroomId = Guid.NewGuid();
        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            Title = "Quiz 1",
            DurationMinutes = 30,
            StartTime = DateTime.UtcNow.AddHours(-1),
            EndTime = DateTime.UtcNow.AddHours(1),
            Status = ExamStatus.Published,
            CreatedAt = DateTime.UtcNow
        };
        db.Exams.Add(exam);
        await db.SaveChangesAsync();

        var access = new FakeClassroomAccessClient();
        var service = new ExamManagementService(db, new NullDistributedCache(), access, NullLogger<ExamManagementService>.Instance);
        var outsider = new Caller(Guid.NewGuid(), UserRole.Student);

        var result = await service.GetExamAsync(exam.Id, outsider);
        result.ShouldBeNull();
    }

    [SkippableFact]
    public async Task Enrolled_student_can_read_a_published_exam()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = CreateDb();
        await db.Database.EnsureCreatedAsync();

        var classroomId = Guid.NewGuid();
        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            Title = "Quiz 1",
            DurationMinutes = 30,
            StartTime = DateTime.UtcNow.AddHours(-1),
            EndTime = DateTime.UtcNow.AddHours(1),
            Status = ExamStatus.Published,
            CreatedAt = DateTime.UtcNow
        };
        db.Exams.Add(exam);
        await db.SaveChangesAsync();

        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var access = new FakeClassroomAccessClient();
        access.Viewable.Add(classroomId);
        var service = new ExamManagementService(db, new NullDistributedCache(), access, NullLogger<ExamManagementService>.Instance);

        var result = await service.GetExamAsync(exam.Id, student);
        result.ShouldNotBeNull();
        result.Title.ShouldBe("Quiz 1");
    }

    private ExamDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ExamDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("exam_ownership"))
            .Options;
        return new ExamDbContext(options);
    }
}
