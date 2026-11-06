using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.Audit;
using Shared.Models;
using UserService.Data;

namespace UserService.Services.Promotion;

/// <summary>One row per school year in which every student moved up a grade.</summary>
public class PromotionRun
{
    public int Year { get; set; }
    public DateTime RanAt { get; set; }
    public int Promoted { get; set; }
    public int LgsCleared { get; set; }

    /// <summary>The administrator who ran it by hand; null for the scheduled run.</summary>
    public Guid? TriggeredBy { get; set; }
}

public class PromotionOptions
{
    public const string SectionName = "Promotion";

    public bool Enabled { get; set; } = true;

    /// <summary>The day (Europe/Istanbul) students move up a grade, after the school year has ended.</summary>
    public int Month { get; set; } = 8;

    public int Day { get; set; } = 15;

    /// <summary>
    /// How many days after that the scheduled run may still happen, if the service was down on the day. Outside
    /// the window nothing runs, so deploying in November does not promote everyone on the spot.
    /// </summary>
    public int WindowDays { get; set; } = 30;

    public int CheckIntervalMinutes { get; set; } = 60;
}

public record PromotionStep(int From, int To, int Students);

public record PromotionResult(int Year, bool DryRun, bool AlreadyRan, DateTime? RanAt, int Promoted, int LgsCleared, int StayingInTwelfth, List<PromotionStep> Steps);

public static class PromotionRules
{
    private static readonly TimeZoneInfo Istanbul = FindIstanbul();

    public const int LastGrade = 12;

    /// <summary>The grade after the summer: one up, and 12 stays 12 (graduates keep their last grade).</summary>
    public static int? NextGrade(int? grade) => grade is >= 1 and < LastGrade ? grade + 1 : grade;

    /// <summary>LGS is the exam at the end of 8th grade; moving to 9th leaves nothing to prepare for.</summary>
    public static bool ClearsLgs(int? grade, ExamTarget? target) => grade == 8 && target == ExamTarget.Lgs;

    public static int IstanbulYear(DateTime utcNow) => TimeZoneInfo.ConvertTimeFromUtc(utcNow, Istanbul).Year;

    /// <summary>The school year whose scheduled run is due at <paramref name="utcNow"/>, or null outside the window.</summary>
    public static int? DueYear(DateTime utcNow, PromotionOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), Istanbul);
        var day = new DateTime(local.Year, options.Month, Math.Min(options.Day, DateTime.DaysInMonth(local.Year, options.Month)));
        return local >= day && local < day.AddDays(Math.Max(1, options.WindowDays)) ? local.Year : null;
    }

    private static TimeZoneInfo FindIstanbul()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("Europe/Istanbul", TimeSpan.FromHours(3), "Istanbul", "Istanbul");
        }
    }
}

public interface IGradePromotionService
{
    /// <summary>
    /// Moves every student up a grade (1–11 → +1, 12 stays; 8th-graders preparing for LGS lose that target).
    /// Runs once per year; <paramref name="force"/> runs again anyway. A dry run only counts.
    /// </summary>
    Task<PromotionResult> RunAsync(int year, bool dryRun, Guid? triggeredBy, bool force = false, CancellationToken cancellationToken = default);
}

public class GradePromotionService : IGradePromotionService
{
    private readonly UserDbContext _db;
    private readonly IAuditLogger _audit;
    private readonly TimeProvider _clock;
    private readonly ILogger<GradePromotionService> _logger;

    public GradePromotionService(UserDbContext db, IAuditLogger audit, TimeProvider clock, ILogger<GradePromotionService> logger)
    {
        _db = db;
        _audit = audit;
        _clock = clock;
        _logger = logger;
    }

    private IQueryable<User> Students => _db.Users.Where(u => u.Role == UserRole.Student && u.DeletedAt == null);

    public async Task<PromotionResult> RunAsync(int year, bool dryRun, Guid? triggeredBy, bool force = false, CancellationToken cancellationToken = default)
    {
        var previous = await _db.PromotionRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Year == year, cancellationToken);
        var counts = await Students
            .Where(u => u.GradeLevel != null)
            .GroupBy(u => u.GradeLevel!.Value)
            .Select(g => new { Grade = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var lgs = await Students.CountAsync(u => u.GradeLevel == 8 && u.ExamTarget == ExamTarget.Lgs, cancellationToken);

        var steps = counts
            .Where(c => c.Grade is >= 1 and < PromotionRules.LastGrade)
            .OrderBy(c => c.Grade)
            .Select(c => new PromotionStep(c.Grade, c.Grade + 1, c.Count))
            .ToList();
        var twelfth = counts.Where(c => c.Grade == PromotionRules.LastGrade).Sum(c => c.Count);
        var promoted = steps.Sum(s => s.Students);

        if (dryRun || (previous is not null && !force))
        {
            return new PromotionResult(year, dryRun, previous is not null, previous?.RanAt, promoted, lgs, twelfth, steps);
        }

        var now = _clock.GetUtcNow().UtcDateTime;
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // The year's row is claimed first: a second instance running at the same moment fails on the key.
        if (previous is null)
        {
            _db.PromotionRuns.Add(new PromotionRun { Year = year, RanAt = now, TriggeredBy = triggeredBy });
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync(cancellationToken);
                _db.ChangeTracker.Clear();
                var winner = await _db.PromotionRuns.AsNoTracking().FirstAsync(r => r.Year == year, cancellationToken);
                return new PromotionResult(year, false, true, winner.RanAt, winner.Promoted, winner.LgsCleared, twelfth, steps);
            }
        }

        var lgsCleared = await Students
            .Where(u => u.GradeLevel == 8 && u.ExamTarget == ExamTarget.Lgs)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.ExamTarget, ExamTarget.None)
                .SetProperty(u => u.UpdatedAt, now), cancellationToken);
        var moved = await Students
            .Where(u => u.GradeLevel >= 1 && u.GradeLevel < PromotionRules.LastGrade)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.GradeLevel, u => u.GradeLevel + 1)
                .SetProperty(u => u.UpdatedAt, now), cancellationToken);

        await _db.PromotionRuns
            .Where(r => r.Year == year)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.RanAt, now)
                .SetProperty(r => r.Promoted, moved)
                .SetProperty(r => r.LgsCleared, lgsCleared)
                .SetProperty(r => r.TriggeredBy, triggeredBy), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        _db.ChangeTracker.Clear();

        await _audit.WriteAsync(new AuditRecord("GradePromotion", triggeredBy, "PromotionRun", year.ToString(System.Globalization.CultureInfo.InvariantCulture),
            $"promoted={moved}; lgsCleared={lgsCleared}; force={force}"), cancellationToken);
        _logger.LogInformation("Grade promotion {Year}: {Promoted} students moved up, {LgsCleared} LGS targets cleared", year, moved, lgsCleared);

        return new PromotionResult(year, false, false, now, moved, lgsCleared, twelfth, steps);
    }
}

/// <summary>Checks every hour whether the year's promotion day has come, and runs it once.</summary>
public sealed class PromotionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IOptions<PromotionOptions> _options;
    private readonly TimeProvider _clock;
    private readonly ILogger<PromotionWorker> _logger;

    public PromotionWorker(IServiceScopeFactory scopes, IOptions<PromotionOptions> options, TimeProvider clock, ILogger<PromotionWorker> logger)
    {
        _scopes = scopes;
        _options = options;
        _clock = clock;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = _options.Value;
        if (!options.Enabled)
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, options.CheckIntervalMinutes)), _clock);
        do
        {
            try
            {
                if (PromotionRules.DueYear(_clock.GetUtcNow().UtcDateTime, options) is { } year)
                {
                    await using var scope = _scopes.CreateAsyncScope();
                    var service = scope.ServiceProvider.GetRequiredService<IGradePromotionService>();
                    await service.RunAsync(year, dryRun: false, triggeredBy: null, force: false, stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Grade promotion check failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
