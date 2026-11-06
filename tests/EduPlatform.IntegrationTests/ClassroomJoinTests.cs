using ClassroomService.Data;
using ClassroomService.Services;
using HomeworkService.Data;
using HomeworkService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Subscription;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>Students joining with a classroom code, and the parent's read-only view of a student's homework.</summary>
[Collection("postgres")]
public class ClassroomJoinTests
{
    private readonly PostgresFixture _postgres;

    public ClassroomJoinTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    private static readonly Caller Teacher = new(Guid.NewGuid(), UserRole.Instructor);

    [SkippableFact]
    public async Task A_student_joins_with_the_code_however_it_is_typed()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshClassroomDbAsync();
        var service = CreateClassroomService(db);
        var created = await service.CreateClassroomAsync(new CreateClassroomRequest("Fen", "5-A", null), Teacher.UserId);
        created!.InviteCode.ShouldNotBeNullOrEmpty();
        var student = new Caller(Guid.NewGuid(), UserRole.Student);

        var typed = $" {created.InviteCode![..4].ToLowerInvariant()}-{created.InviteCode[4..]} ";
        var joined = await service.JoinByCodeAsync(typed, student);
        var again = await service.JoinByCodeAsync(created.InviteCode, student);

        joined.Outcome.ShouldBe(JoinClassroomOutcome.Joined);
        joined.Classroom!.InviteCode.ShouldBeNull();
        again.Outcome.ShouldBe(JoinClassroomOutcome.AlreadyEnrolled);
        (await service.GetAccessAsync(created.Id, student))!.IsEnrolled.ShouldBeTrue();
    }

    [SkippableFact]
    public async Task Only_students_join_and_unknown_codes_find_nothing()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshClassroomDbAsync();
        var service = CreateClassroomService(db);
        var created = await service.CreateClassroomAsync(new CreateClassroomRequest("Fen", "5-A", null), Teacher.UserId);

        (await service.JoinByCodeAsync(created!.InviteCode!, new Caller(Guid.NewGuid(), UserRole.Parent)))
            .Outcome.ShouldBe(JoinClassroomOutcome.NotAllowed);
        (await service.JoinByCodeAsync(created.InviteCode!, new Caller(Guid.NewGuid(), UserRole.Instructor)))
            .Outcome.ShouldBe(JoinClassroomOutcome.NotAllowed);
        (await service.JoinByCodeAsync("ZZZZZZZZ", new Caller(Guid.NewGuid(), UserRole.Student)))
            .Outcome.ShouldBe(JoinClassroomOutcome.NotFound);
        (await service.JoinByCodeAsync("", new Caller(Guid.NewGuid(), UserRole.Student)))
            .Outcome.ShouldBe(JoinClassroomOutcome.NotFound);
    }

    [SkippableFact]
    public async Task The_teachers_capacity_applies_when_students_join_by_code()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshClassroomDbAsync();
        // The teacher's plan allows two students; at join time the caller is the student, whose own plan
        // must not decide.
        var service = CreateClassroomService(db, new FixedLimitQuotaGuard(2));
        var created = await service.CreateClassroomAsync(new CreateClassroomRequest("Fen", "5-A", null), Teacher.UserId);

        for (var i = 0; i < 2; i++)
        {
            (await service.JoinByCodeAsync(created!.InviteCode!, new Caller(Guid.NewGuid(), UserRole.Student)))
                .Outcome.ShouldBe(JoinClassroomOutcome.Joined);
        }

        var studentService = CreateClassroomService(db, new NoopQuotaGuard());
        (await studentService.JoinByCodeAsync(created!.InviteCode!, new Caller(Guid.NewGuid(), UserRole.Student)))
            .Outcome.ShouldBe(JoinClassroomOutcome.Full);
    }

    [SkippableFact]
    public async Task Regenerating_the_code_retires_the_old_one_and_only_the_owner_can()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshClassroomDbAsync();
        var service = CreateClassroomService(db);
        var created = await service.CreateClassroomAsync(new CreateClassroomRequest("Fen", "5-A", null), Teacher.UserId);
        var oldCode = created!.InviteCode!;

        (await service.RegenerateInviteCodeAsync(created.Id, new Caller(Guid.NewGuid(), UserRole.Instructor))).ShouldBeNull();
        var newCode = await service.RegenerateInviteCodeAsync(created.Id, Teacher);

        newCode.ShouldNotBeNull();
        newCode.ShouldNotBe(oldCode);
        (await service.JoinByCodeAsync(oldCode, new Caller(Guid.NewGuid(), UserRole.Student))).Outcome.ShouldBe(JoinClassroomOutcome.NotFound);
        (await service.JoinByCodeAsync(newCode, new Caller(Guid.NewGuid(), UserRole.Student))).Outcome.ShouldBe(JoinClassroomOutcome.Joined);
    }

    [SkippableFact]
    public async Task Only_the_teacher_sees_the_code_on_the_classroom()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshClassroomDbAsync();
        var service = CreateClassroomService(db);
        var created = await service.CreateClassroomAsync(new CreateClassroomRequest("Fen", "5-A", null), Teacher.UserId);
        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        await service.JoinByCodeAsync(created!.InviteCode!, student);

        (await service.GetClassroomAsync(created.Id, Teacher))!.InviteCode.ShouldBe(created.InviteCode);
        (await service.GetClassroomAsync(created.Id, student))!.InviteCode.ShouldBeNull();
    }

    [SkippableFact]
    public async Task A_parent_sees_the_students_homework_with_their_own_submissions_only()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = new HomeworkDbContext(new DbContextOptionsBuilder<HomeworkDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("student_homework_view"))
            .Options);
        await db.Database.EnsureCreatedAsync();

        var classroomId = Guid.NewGuid();
        var studentId = Guid.NewGuid();
        var classmateId = Guid.NewGuid();
        var access = new FakeClassroomAccessClient { Manageable = { classroomId } };
        access.StudentClassrooms[studentId] = [classroomId];
        var service = new HomeworkManagementService(db, new NoopQuotaGuard(), access, new NullAuditLogger(), NullLogger<HomeworkManagementService>.Instance);

        var due = DateTime.UtcNow.AddDays(3);
        var done = await service.CreateHomeworkAsync(new CreateHomeworkRequest(classroomId, "Kesirler", "Sayfa 12", null, 100, due, false, 0), Teacher);
        var open = await service.CreateHomeworkAsync(new CreateHomeworkRequest(classroomId, "Ondalık", "Sayfa 20", null, 100, due.AddDays(1), false, 0), Teacher);
        await service.CreateHomeworkAsync(new CreateHomeworkRequest(Guid.NewGuid(), "Başka sınıf", "-", null, 100, due, false, 0), new Caller(Guid.NewGuid(), UserRole.Admin));

        access.Viewable.Add(classroomId);
        await service.SubmitHomeworkAsync(done!.Id, new SubmitHomeworkRequest("Cevaplar", null), new Caller(studentId, UserRole.Student));
        await service.SubmitHomeworkAsync(open!.Id, new SubmitHomeworkRequest("Sınıf arkadaşı", null), new Caller(classmateId, UserRole.Student));

        var view = await service.GetStudentHomeworkAsync(studentId);

        view.Select(v => v.Homework.Title).ShouldBe(["Ondalık", "Kesirler"]);
        view.Single(v => v.Homework.Id == done.Id).Submission!.StudentId.ShouldBe(studentId);
        view.Single(v => v.Homework.Id == open.Id).Submission.ShouldBeNull();
        (await service.GetStudentHomeworkAsync(Guid.NewGuid())).ShouldBeEmpty();
    }

    private async Task<ClassroomDbContext> FreshClassroomDbAsync()
    {
        var db = new ClassroomDbContext(new DbContextOptionsBuilder<ClassroomDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("classroom_join"))
            .Options);
        await db.Database.EnsureCreatedAsync();
        await db.Enrollments.ExecuteDeleteAsync();
        await db.Classrooms.ExecuteDeleteAsync();
        return db;
    }

    private static ClassroomManagementService CreateClassroomService(ClassroomDbContext db, IQuotaGuard? quota = null) =>
        new(db, quota ?? new NoopQuotaGuard(), NullLogger<ClassroomManagementService>.Instance);

    private sealed class FixedLimitQuotaGuard(long limit) : IQuotaGuard
    {
        public Task EnsureFeatureAsync(string featureCode, CancellationToken ct = default) => Task.CompletedTask;

        public Task TryConsumeAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default) => Task.CompletedTask;

        public Task ReleaseAsync(QuotaMetric metric, long amount = 1, CancellationToken ct = default) => Task.CompletedTask;

        public Task<long> GetLimitAsync(QuotaMetric metric, CancellationToken ct = default) =>
            Task.FromResult(metric == QuotaMetric.MaxStudentsPerClassroom ? limit : -1L);
    }
}
