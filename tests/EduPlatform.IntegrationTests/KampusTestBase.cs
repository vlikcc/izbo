using ContentService.Kampus;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Kampus.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Models;

namespace EduPlatform.IntegrationTests;

public abstract class KampusTestBase
{
    /// <summary>Tuesday 10 Nov 2026, noon in Istanbul: the first cup week (index 0).</summary>
    internal static readonly DateTimeOffset Start = new(2026, 11, 10, 9, 0, 0, TimeSpan.Zero);

    internal static readonly KampusCatalog Catalog = KampusCatalog.LoadEmbedded();

    internal const string Topic = "k-dogal-karsilastirma";

    private readonly PostgresFixture _postgres;

    protected KampusTestBase(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    protected bool Available => _postgres.Available;

    internal MutableTime Time { get; } = new(Start);

    internal FakeKampusDirectory Directory { get; } = new();

    internal KampusDbContext CreateDb() => new(new DbContextOptionsBuilder<KampusDbContext>()
        .UseNpgsql(_postgres.ConnectionStringFor("kampus"), n => n.MigrationsHistoryTable(KampusDbContext.MigrationsHistoryTable))
        .Options);

    /// <summary>Migrates (which exercises the real migration) and empties every Kampüs table.</summary>
    internal async Task<KampusDbContext> FreshDbAsync()
    {
        var db = CreateDb();
        await db.Database.MigrateAsync();
        // Table names come from the model, not from input.
        var tables = string.Join(", ", db.Model.GetEntityTypes().Select(t => t.GetTableName()).Distinct().Select(t => "\"" + t + "\""));
#pragma warning disable EF1002, EF1003
        await db.Database.ExecuteSqlRawAsync("TRUNCATE " + tables);
#pragma warning restore EF1002, EF1003
        return db;
    }

    internal sealed record KampusServices(KampusLearnerService Learner, KampusCupService Cup, KampusAvatarService Avatar, KampusTeachingService Teaching);

    internal KampusServices Services(KampusDbContext db)
    {
        var clock = new KampusClock(Time);
        var cup = new KampusCupService(db, Catalog, clock, Directory);
        return new KampusServices(
            new KampusLearnerService(db, Catalog, clock, Directory, cup),
            cup,
            new KampusAvatarService(db, Catalog, clock),
            new KampusTeachingService(db, Catalog, clock, Directory));
    }

    internal Caller NewStudent(int grade = 3, Guid? classroom = null)
    {
        var caller = new Caller(Guid.NewGuid(), UserRole.Student);
        Directory.Grades[caller.UserId] = grade;
        Directory.StudentClassrooms[caller.UserId] = classroom is { } c ? [c] : [];
        return caller;
    }

    internal static Caller NewCaller(UserRole role) => new(Guid.NewGuid(), role);

    internal static CatalogTopic TopicData => Catalog.Topic(Topic)!;

    /// <summary>Every exercise answered at the first try, as the stop player reports it.</summary>
    internal static Dictionary<string, System.Text.Json.JsonElement> FirstTryAnswers() =>
        TopicData.Exercises.ToDictionary(q => q.Id, _ => KampusAnswers.Practice(0));

    internal static async Task<int> StarsAsync(KampusDbContext db, Guid studentId) =>
        await db.Rewards.Where(r => r.StudentId == studentId).SumAsync(r => r.Star);

    internal static async Task<int> KpAsync(KampusDbContext db, Guid studentId) =>
        await db.Wallets.Where(w => w.StudentId == studentId).Select(w => w.KpBalance).FirstOrDefaultAsync();

    /// <summary>This week's two required cup tasks done (week 0: an exercise and a lesson).</summary>
    internal async Task MakeCupReadyAsync(KampusDbContext db, Guid studentId)
    {
        var now = Time.GetUtcNow().UtcDateTime;
        foreach (var stop in new[] { "alistirma", "anlatim" })
        {
            db.Activities.Add(new KampusActivity
            {
                StudentId = studentId, Kind = "durak", Ref = Topic, StopId = stop, At = now,
                Day = KampusClock.DayOf(now), Week = KampusClock.WeekOf(now)
            });
        }

        await db.SaveChangesAsync();
    }

    internal async Task GiveStarsAsync(KampusDbContext db, Guid studentId, int stars)
    {
        var now = Time.GetUtcNow().UtcDateTime;
        db.Rewards.Add(new KampusReward
        {
            StudentId = studentId, Kind = "yildiz", Ref = "test:" + Guid.NewGuid().ToString("N"), Star = stars, AwardedAt = now,
            Day = KampusClock.DayOf(now), Week = KampusClock.WeekOf(now)
        });
        await db.SaveChangesAsync();
    }

    internal static async Task SetKpAsync(KampusDbContext db, Guid studentId, int kp)
    {
        db.Wallets.Add(new KampusWallet { StudentId = studentId, KpBalance = kp, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }
}
