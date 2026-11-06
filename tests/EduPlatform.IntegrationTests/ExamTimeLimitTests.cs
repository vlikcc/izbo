using System.Text.Json;
using ExamService.Data;
using ExamService.Hubs;
using ExamService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class ExamTimeLimitTests
{
    private readonly PostgresFixture _postgres;

    public ExamTimeLimitTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Answer_within_the_time_limit_is_saved_and_a_letter_key_is_graded_correctly()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (exam, question) = await SeedExamAsync(db, endTime: DateTime.UtcNow.AddHours(1));
        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var session = await SeedSessionAsync(db, exam, student, startedAt: DateTime.UtcNow.AddMinutes(-5));
        var service = CreateService(db, new InMemoryDistributedCache());

        (await service.SaveAnswerAsync(session.Id, question.Id, "Ankara", student)).ShouldBeTrue();

        var result = await service.SubmitExamAsync(session.Id, student);

        result.ShouldNotBeNull();
        result.TotalScore.ShouldBe(10);
        result.QuestionResults.ShouldNotBeNull();
        result.QuestionResults.Single().CorrectAnswer.ShouldBe("Ankara");
        (await StatusOfAsync(session.Id)).ShouldBe(ExamSessionStatus.Graded);
    }

    [SkippableFact]
    public async Task Answer_after_the_duration_is_rejected_and_a_late_submit_is_timed_out()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (exam, question) = await SeedExamAsync(db, endTime: DateTime.UtcNow.AddHours(1));
        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        // 30-minute exam started 31 minutes ago: past the deadline and the 30-second grace.
        var session = await SeedSessionAsync(db, exam, student, startedAt: DateTime.UtcNow.AddMinutes(-31));
        var cache = new InMemoryDistributedCache();
        // The answer the student saved while time was still running.
        await cache.SetStringAsync(
            $"exam_answers:{session.Id}",
            JsonSerializer.Serialize(new Dictionary<string, string> { [question.Id.ToString()] = "Ankara" }));
        var service = CreateService(db, cache);

        (await service.SaveAnswerAsync(session.Id, question.Id, "İstanbul", student)).ShouldBeFalse();

        var result = await service.SubmitExamAsync(session.Id, student);

        result.ShouldNotBeNull();
        result.TotalScore.ShouldBe(10, "the in-time answer is graded; the late one never replaced it");
        (await StatusOfAsync(session.Id)).ShouldBe(ExamSessionStatus.TimedOut);

        (await service.GetResultAsync(session.Id, student)).ShouldNotBeNull();
    }

    [SkippableFact]
    public async Task Answer_after_the_exam_end_time_is_rejected_even_with_duration_left()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (exam, question) = await SeedExamAsync(db, endTime: DateTime.UtcNow.AddMinutes(-1));
        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var session = await SeedSessionAsync(db, exam, student, startedAt: DateTime.UtcNow.AddMinutes(-5));
        var service = CreateService(db, new InMemoryDistributedCache());

        (await service.SaveAnswerAsync(session.Id, question.Id, "Ankara", student)).ShouldBeFalse();
    }

    private static ExamSessionService CreateService(ExamDbContext db, IDistributedCache cache) =>
        new(db, cache, new NullHubContext<ExamHub>(), new FakeClassroomAccessClient(), NullLogger<ExamSessionService>.Instance);

    private static async Task<(Exam Exam, Question Question)> SeedExamAsync(ExamDbContext db, DateTime endTime)
    {
        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            ClassroomId = Guid.NewGuid(),
            Title = "Süreli sınav",
            DurationMinutes = 30,
            StartTime = DateTime.UtcNow.AddHours(-2),
            EndTime = endTime,
            TotalPoints = 10,
            ShuffleOptions = true,
            ShowResults = true,
            Status = ExamStatus.InProgress,
            CreatedAt = DateTime.UtcNow
        };
        var question = new Question
        {
            Id = Guid.NewGuid(),
            ExamId = exam.Id,
            OrderIndex = 1,
            Type = QuestionType.MultipleChoice,
            Content = "Türkiye'nin başkenti?",
            Options = JsonSerializer.Serialize(new[] { "İstanbul", "Ankara", "İzmir" }),
            CorrectAnswer = "B",
            Points = 10
        };
        exam.Questions.Add(question);
        db.Exams.Add(exam);
        await db.SaveChangesAsync();
        return (exam, question);
    }

    private static async Task<ExamSession> SeedSessionAsync(ExamDbContext db, Exam exam, Caller student, DateTime startedAt)
    {
        var session = new ExamSession
        {
            Id = Guid.NewGuid(),
            ExamId = exam.Id,
            StudentId = student.UserId,
            StartedAt = startedAt,
            Status = ExamSessionStatus.InProgress,
            CreatedAt = startedAt
        };
        db.ExamSessions.Add(session);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return session;
    }

    private async Task<ExamSessionStatus> StatusOfAsync(Guid sessionId)
    {
        await using var db = new ExamDbContext(Options());
        return await db.ExamSessions.Where(s => s.Id == sessionId).Select(s => s.Status).SingleAsync();
    }

    private async Task<ExamDbContext> CreateDbAsync()
    {
        var db = new ExamDbContext(Options());
        await db.Database.EnsureCreatedAsync();
        return db;
    }

    private DbContextOptions<ExamDbContext> Options() =>
        new DbContextOptionsBuilder<ExamDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("exam_time_limit"))
            .Options;
}
