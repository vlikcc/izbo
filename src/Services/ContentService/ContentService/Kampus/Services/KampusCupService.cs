using System.Globalization;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shared.Authorization;

namespace ContentService.Kampus.Services;

/// <summary>
/// Yıldız Kupası, the weekly contest. Rules enforced here rather than in the browser:
/// <list type="bullet">
/// <item>Joining needs this week's two required tasks, is explicit and once per week.</item>
/// <item>Groups of <c>groupSize</c> (20) fill in join order, per grade, and never change during the week.</item>
/// <item>A nickname is an adjective + noun from the fixed lists and unique within its group.</item>
/// <item>Points are the week's ⭐; winners are the top 5 in groups of 12+, top 3 in 6–11, top 1 below,
/// with ties at the cut-off included.</item>
/// <item>Other children are only ever shown by nickname and emoji.</item>
/// </list>
/// </summary>
public sealed class KampusCupService
{
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    private readonly KampusDbContext _db;
    private readonly KampusCatalog _catalog;
    private readonly KampusClock _clock;
    private readonly IKampusDirectory _directory;

    public KampusCupService(KampusDbContext db, KampusCatalog catalog, KampusClock clock, IKampusDirectory directory)
    {
        _db = db;
        _catalog = catalog;
        _clock = clock;
        _directory = directory;
    }

    private CatalogCup Cup => _catalog.Data.Cup;

    public static int WinnersFor(int size, int topWinners) => size >= 12 ? topWinners : size >= 6 ? 3 : 1;

    public static string WeekKey(DateOnly week) => week.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public CupThemeDto Theme(DateOnly week)
    {
        var themes = Cup.Themes;
        var t = themes[Mod(KampusClock.WeekIndex(week), themes.Count)];
        return new CupThemeDto(t.Id, t.Name);
    }

    /// <summary>This week's two required tasks (the first fixed, the second rotating) and the optional bonus.</summary>
    public (IReadOnlyList<CatalogCupTask> Required, CatalogCupTask Bonus) Tasks(DateOnly week)
    {
        var wk = KampusClock.WeekIndex(week);
        var second = Cup.WeeklyTasks[Mod(wk, Cup.WeeklyTasks.Count)];
        var bonusPool = Cup.BonusTasks.Where(id => id != second).ToList();
        CatalogCupTask ById(string id) => Cup.TaskPool.Single(t => t.Id == id);
        return ([ById("calis"), ById(second)], ById(bonusPool[Mod(wk, bonusPool.Count)]));
    }

    public async Task<CupProgressDto> ProgressAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var week = _clock.ThisWeek;
        var activities = await _db.Activities
            .Where(a => a.StudentId == studentId && a.Week == week)
            .Select(a => new { a.Kind, a.Ref, a.StopId })
            .ToListAsync(cancellationToken);

        // The same stop of the same topic counts once a week; a book counts when its questions are done.
        var works = activities.Where(a => a.Kind == "durak").Select(a => (a.Ref, a.StopId)).Distinct().ToList();
        int Count(string stop) => stop switch
        {
            "kitap" => activities.Count(a => a.Kind == "kitap-tamam"),
            "oyun" => activities.Count(a => a.Kind == "oyun"),
            _ => works.Count(w => w.StopId == stop)
        };
        CupTaskDto Progress(CatalogCupTask t) =>
            new(t.Id, t.Stops, t.Label, t.Icon, Math.Min(1, t.Stops.Sum(Count)), 1);

        var (required, bonus) = Tasks(week);
        var tasks = required.Select(Progress).ToList();
        return new CupProgressDto(tasks, Progress(bonus), tasks.Count, tasks.Count(t => t.Done >= t.Target), tasks.All(t => t.Done >= t.Target));
    }

    public async Task<NickChoicesDto> NickChoicesAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        var grade = await _directory.GetOwnGradeAsync(caller, cancellationToken) ?? 0;
        var week = _clock.ThisWeek;
        var count = await _db.CupEntries.CountAsync(e => e.Week == week && e.Grade == grade, cancellationToken);
        var groupNo = count / Cup.GroupSize + 1;
        var taken = await TakenAsync(week, grade, groupNo, cancellationToken);
        var last = await _db.Wallets.Where(w => w.StudentId == caller.UserId).Select(w => w.Nick).FirstOrDefaultAsync(cancellationToken);
        return new NickChoicesDto(taken, last, UniqueNick(null, taken), Cup.NickAdjectives, Cup.NickNouns.Select(n => n.Name).ToList());
    }

    public async Task<ContentResult<CupEntryDto>> JoinAsync(Caller caller, string? nick, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<CupEntryDto>("Kupaya yalnızca öğrenciler katılabilir.");
        }

        var week = _clock.ThisWeek;
        var existing = await _db.CupEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Week == week && e.StudentId == caller.UserId, cancellationToken);
        if (existing is not null)
        {
            return ContentResult.Ok(ToDto(existing));
        }

        if (!(await ProgressAsync(caller.UserId, cancellationToken)).Ready)
        {
            return ContentResult.Invalid<CupEntryDto>("Önce bu haftanın iki görevini tamamla.");
        }

        nick = string.IsNullOrWhiteSpace(nick) ? null : string.Join(' ', nick.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (nick is not null && ParseNick(nick) is null)
        {
            return ContentResult.Invalid<CupEntryDto>("Takma ad listeden seçilmeli.");
        }

        var grade = await _directory.GetOwnGradeAsync(caller, cancellationToken);
        if (grade is null)
        {
            return ContentResult.Invalid<CupEntryDto>("Sınıf bilgin bulunamadı; kupaya katılmak için öğretmenine ya da velinize haber ver.");
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        // Serialises joins for one (week, grade) so join order — and therefore the group — is exact.
        var lockKey = $"kampus-cup:{WeekKey(week)}:{grade}";
        await _db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))", cancellationToken);

        var wallet = await KampusRewardSession.LockWalletAsync(_db, _clock, caller.UserId, cancellationToken);

        existing = await _db.CupEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Week == week && e.StudentId == caller.UserId, cancellationToken);
        if (existing is not null)
        {
            return ContentResult.Ok(ToDto(existing));
        }

        var seq = await _db.CupEntries.CountAsync(e => e.Week == week && e.Grade == grade, cancellationToken);
        var groupNo = seq / Cup.GroupSize + 1;
        var taken = await TakenAsync(week, grade.Value, groupNo, cancellationToken);

        if (nick is not null && taken.Contains(nick))
        {
            return ContentResult.Conflict<CupEntryDto>("Bu ad grubunda başka birinde var. Başka bir birleşim seç.");
        }

        nick ??= UniqueNick(wallet.Nick, taken);
        var entry = new KampusCupEntry
        {
            Week = week,
            StudentId = caller.UserId,
            Grade = grade.Value,
            Seq = seq,
            GroupNo = groupNo,
            Nick = nick,
            Emoji = ParseNick(nick)?.Emoji ?? string.Empty,
            JoinedAt = _clock.UtcNow
        };
        _db.CupEntries.Add(entry);
        wallet.Nick = nick;
        wallet.UpdatedAt = _clock.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return ContentResult.Conflict<CupEntryDto>("Bu ad grubunda başka birinde var. Başka bir birleşim seç.");
        }

        return ContentResult.Ok(ToDto(entry));
    }

    public async Task<CupBoardDto> BoardAsync(Guid studentId, DateOnly week, CancellationToken cancellationToken = default)
    {
        var mine = await _db.CupEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Week == week && e.StudentId == studentId, cancellationToken);
        if (mine is null)
        {
            return new CupBoardDto(WeekKey(week), [], null, 0, 0);
        }

        var members = await _db.CupEntries.AsNoTracking()
            .Where(e => e.Week == week && e.Grade == mine.Grade && e.GroupNo == mine.GroupNo)
            .ToListAsync(cancellationToken);
        var ids = members.Select(m => m.StudentId).ToList();
        var points = await _db.Rewards
            .Where(r => r.Week == week && ids.Contains(r.StudentId))
            .GroupBy(r => r.StudentId)
            .Select(g => new { StudentId = g.Key, Stars = g.Sum(r => r.Star) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Stars, cancellationToken);
        var groups = await _db.CupEntries.Where(e => e.Week == week && e.Grade == mine.Grade).Select(e => e.GroupNo).Distinct().CountAsync(cancellationToken);

        var ordered = members
            .Select(m => (Entry: m, Points: points.GetValueOrDefault(m.StudentId)))
            .OrderByDescending(x => x.Points)
            .ThenBy(x => x.Entry.Nick, StringComparer.Create(Turkish, ignoreCase: false))
            .ToList();
        var winners = WinnersFor(ordered.Count, Cup.Winners);

        var rows = new List<CupBoardRowDto>(ordered.Count);
        for (var i = 0; i < ordered.Count; i++)
        {
            // Equal points share a rank, so a tie at the cut-off line wins too.
            var rank = i > 0 && ordered[i - 1].Points == ordered[i].Points ? rows[i - 1].Rank : i + 1;
            rows.Add(new CupBoardRowDto(ordered[i].Entry.Nick, ordered[i].Entry.Emoji, ordered[i].Points, rank,
                ordered[i].Entry.StudentId == studentId, rank <= winners));
        }

        return new CupBoardDto(WeekKey(week), rows, mine.GroupNo, groups, winners);
    }

    /// <summary>Records the result of every finished week the student took part in (idempotent).</summary>
    public async Task SettleAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var thisWeek = _clock.ThisWeek;
        var settled = await _db.CupResults.Where(r => r.StudentId == studentId).Select(r => r.Week).ToListAsync(cancellationToken);
        var pending = await _db.CupEntries
            .Where(e => e.StudentId == studentId && e.Week < thisWeek && !settled.Contains(e.Week))
            .Select(e => e.Week)
            .ToListAsync(cancellationToken);

        foreach (var week in pending)
        {
            var board = await BoardAsync(studentId, week, cancellationToken);
            var me = board.Rows.FirstOrDefault(r => r.Me);
            _db.CupResults.Add(new KampusCupResult
            {
                StudentId = studentId,
                Week = week,
                CupId = Theme(week).Id,
                Rank = me?.Rank,
                Size = board.Rows.Count,
                GroupNo = board.Group ?? 0,
                Won = me?.Winner == true,
                Stars = me?.Points ?? 0
            });
        }

        if (pending.Count > 0)
        {
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Settled concurrently by another request; the stored result is the same.
                _db.ChangeTracker.Clear();
            }
        }
    }

    public async Task<IReadOnlyList<CupWonDto>> CupsWonAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        await SettleAsync(studentId, cancellationToken);
        var results = await _db.CupResults.AsNoTracking().Where(r => r.StudentId == studentId && r.Won).ToListAsync(cancellationToken);
        return results
            .OrderByDescending(r => r.Week)
            .Select(r => new CupWonDto(WeekKey(r.Week), r.CupId, ThemeById(r.CupId), r.Rank, r.Size, r.GroupNo, r.Won, r.Stars))
            .ToList();
    }

    public async Task<CupSummaryDto> SummaryAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        await SettleAsync(studentId, cancellationToken);
        var week = _clock.ThisWeek;
        var today = _clock.Today;
        var entry = await _db.CupEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Week == week && e.StudentId == studentId, cancellationToken);
        var board = await BoardAsync(studentId, week, cancellationToken);
        var me = board.Rows.FirstOrDefault(r => r.Me);
        var points = await _db.Rewards.Where(r => r.StudentId == studentId && r.Week == week).SumAsync(r => r.Star, cancellationToken);
        var starsToday = await _db.Rewards.Where(r => r.StudentId == studentId && r.Day == today).SumAsync(r => r.Star, cancellationToken);

        return new CupSummaryDto(entry is not null, Theme(week), points, me?.Rank, board.Rows.Count, board.Group, board.Groups, board.Winners,
            me?.Winner == true, await ProgressAsync(studentId, cancellationToken), starsToday, _catalog.Data.StarDailyMax, entry?.Nick);
    }

    /// <summary>The adjective and noun of a list-made nickname, or null when it is not one.</summary>
    internal (string Adjective, string Noun, string Emoji)? ParseNick(string nick)
    {
        foreach (var adjective in Cup.NickAdjectives)
        {
            if (!nick.StartsWith(adjective + " ", StringComparison.Ordinal))
            {
                continue;
            }

            var rest = nick[(adjective.Length + 1)..];
            var noun = Cup.NickNouns.FirstOrDefault(n => n.Name == rest);
            if (noun is not null)
            {
                return (adjective, noun.Name, noun.Emoji);
            }
        }

        return null;
    }

    private string UniqueNick(string? remembered, IReadOnlyCollection<string> taken)
    {
        if (remembered is not null && !taken.Contains(remembered) && ParseNick(remembered) is not null)
        {
            return remembered;
        }

        var all = Cup.NickAdjectives.SelectMany(a => Cup.NickNouns.Select(n => $"{a} {n.Name}")).Where(n => !taken.Contains(n)).ToList();
        // 16 × 16 combinations against a group of 20 — a free one always exists.
        return all[Random.Shared.Next(all.Count)];
    }

    private async Task<List<string>> TakenAsync(DateOnly week, int grade, int groupNo, CancellationToken cancellationToken) =>
        await _db.CupEntries.Where(e => e.Week == week && e.Grade == grade && e.GroupNo == groupNo).Select(e => e.Nick).ToListAsync(cancellationToken);

    private CupThemeDto ThemeById(string id)
    {
        var t = Cup.Themes.FirstOrDefault(x => x.Id == id);
        return t is null ? new CupThemeDto(id, id) : new CupThemeDto(t.Id, t.Name);
    }

    private static CupEntryDto ToDto(KampusCupEntry e) => new(WeekKey(e.Week), e.Nick, e.JoinedAt, e.GroupNo);

    private static int Mod(int n, int m) => ((n % m) + m) % m;
}
