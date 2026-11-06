using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Models;
using Shouldly;
using UserService.Data;
using UserService.Services.Promotion;

namespace EduPlatform.IntegrationTests;

/// <summary>Moving every student up a grade at the end of the school year.</summary>
[Collection("postgres")]
public class GradePromotionTests
{
    private readonly PostgresFixture _postgres;

    public GradePromotionTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Students_move_up_once_a_year_8th_grade_LGS_is_cleared_and_12th_grade_stays()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var first = Student(1);
        var lgs = Student(8, ExamTarget.Lgs);
        var eighthNoExam = Student(8);
        var yks = Student(11, ExamTarget.Yks);
        var twelfth = Student(12, ExamTarget.Yks);
        var noGrade = Student(null);
        var deleted = Student(5);
        deleted.DeletedAt = DateTime.UtcNow;
        var parent = new User { Id = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@test.local", FirstName = "V", LastName = "Eli", Role = UserRole.Parent, GradeLevel = 4 };
        db.Users.AddRange(first, lgs, eighthNoExam, yks, twelfth, noGrade, deleted, parent);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var service = CreateService(db);

        var preview = await service.RunAsync(2027, dryRun: true, triggeredBy: null);
        preview.AlreadyRan.ShouldBeFalse();
        preview.Promoted.ShouldBe(4);
        preview.LgsCleared.ShouldBe(1);
        preview.StayingInTwelfth.ShouldBe(1);
        preview.Steps.ShouldBe([new PromotionStep(1, 2, 1), new PromotionStep(8, 9, 2), new PromotionStep(11, 12, 1)]);
        (await GradeOf(db, first.Id)).ShouldBe(1, "a dry run changes nothing");
        (await db.PromotionRuns.CountAsync()).ShouldBe(0);

        var admin = Guid.NewGuid();
        var run = await service.RunAsync(2027, dryRun: false, triggeredBy: admin);
        run.Promoted.ShouldBe(4);
        run.LgsCleared.ShouldBe(1);

        (await GradeOf(db, first.Id)).ShouldBe(2);
        var movedLgs = await db.Users.AsNoTracking().SingleAsync(u => u.Id == lgs.Id);
        movedLgs.GradeLevel.ShouldBe(9);
        movedLgs.ExamTarget.ShouldBe(ExamTarget.None);
        (await GradeOf(db, eighthNoExam.Id)).ShouldBe(9);
        var movedYks = await db.Users.AsNoTracking().SingleAsync(u => u.Id == yks.Id);
        movedYks.GradeLevel.ShouldBe(12);
        movedYks.ExamTarget.ShouldBe(ExamTarget.Yks);
        (await GradeOf(db, twelfth.Id)).ShouldBe(12);
        (await GradeOf(db, noGrade.Id)).ShouldBeNull();
        (await GradeOf(db, deleted.Id)).ShouldBe(5);
        (await GradeOf(db, parent.Id)).ShouldBe(4);

        var stored = await db.PromotionRuns.AsNoTracking().SingleAsync(r => r.Year == 2027);
        stored.Promoted.ShouldBe(4);
        stored.TriggeredBy.ShouldBe(admin);

        // A second run in the same year — a restart, or the admin clicking twice — does nothing.
        var again = await service.RunAsync(2027, dryRun: false, triggeredBy: null);
        again.AlreadyRan.ShouldBeTrue();
        (await GradeOf(db, first.Id)).ShouldBe(2);

        // Unless forced.
        (await service.RunAsync(2027, dryRun: false, triggeredBy: admin, force: true)).AlreadyRan.ShouldBeFalse();
        (await GradeOf(db, first.Id)).ShouldBe(3);
        (await db.PromotionRuns.CountAsync()).ShouldBe(1);
    }

    private static User Student(int? grade, ExamTarget? target = null) => new()
    {
        Id = Guid.NewGuid(),
        Username = "ogr" + Guid.NewGuid().ToString("N")[..10],
        FirstName = "Öğ",
        LastName = "Renci",
        Role = UserRole.Student,
        GradeLevel = grade,
        ExamTarget = target
    };

    private static Task<int?> GradeOf(UserDbContext db, Guid id) =>
        db.Users.AsNoTracking().Where(u => u.Id == id).Select(u => u.GradeLevel).SingleAsync();

    private static GradePromotionService CreateService(UserDbContext db) =>
        new(db, new NullAuditLogger(), TimeProvider.System, NullLogger<GradePromotionService>.Instance);

    private async Task<UserDbContext> CreateDbAsync()
    {
        var db = new UserDbContext(new DbContextOptionsBuilder<UserDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("promotion_" + Guid.NewGuid().ToString("N")[..12]))
            .Options);
        await db.Database.MigrateAsync();
        return db;
    }
}
