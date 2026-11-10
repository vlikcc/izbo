using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using Microsoft.EntityFrameworkCore;

namespace ContentService.Kampus.Services;

/// <summary>What a piece of work earned: 💎 KP, ⭐ cup stars, and the daily/weekly bonuses it triggered.</summary>
public sealed record KampusGain(int Kp, int Cup, int Daily = 0, int Bonus = 0)
{
    public static readonly KampusGain None = new(0, 0);

    public static KampusGain operator +(KampusGain a, KampusGain b) =>
        new(a.Kp + b.Kp, a.Cup + b.Cup, a.Daily + b.Daily, a.Bonus + b.Bonus);
}

/// <summary>
/// One reward-bearing operation for one student, inside a transaction that holds the student's wallet row
/// lock. Enforces: one reward per (kind, ref); at most <c>starDailyMax</c> ⭐ per local day (KP is not
/// capped); a capped-to-nothing reward is not written, so the source can still earn a star another day.
/// </summary>
public sealed class KampusRewardSession
{
    private readonly KampusDbContext _db;
    private readonly KampusClock _clock;
    private readonly int _dailyMax;
    private readonly HashSet<(string Kind, string Ref)> _awarded = new();
    private int _starsToday;

    private KampusRewardSession(KampusDbContext db, KampusClock clock, KampusWallet wallet, int dailyMax, int starsToday)
    {
        _db = db;
        _clock = clock;
        Wallet = wallet;
        _dailyMax = dailyMax;
        _starsToday = starsToday;
    }

    public KampusWallet Wallet { get; }

    public int StarsLeftToday => Math.Max(0, _dailyMax - _starsToday);

    /// <summary>
    /// Creates the wallet if needed and locks it until the surrounding transaction ends. Must be called
    /// inside a transaction.
    /// </summary>
    public static async Task<KampusRewardSession> BeginAsync(
        KampusDbContext db, KampusClock clock, KampusCatalog catalog, Guid studentId, CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("A reward session needs a transaction.");
        }

        var wallet = await LockWalletAsync(db, clock, studentId, cancellationToken);
        var today = clock.Today;
        var stars = await db.Rewards.Where(r => r.StudentId == studentId && r.Day == today).SumAsync(r => r.Star, cancellationToken);
        return new KampusRewardSession(db, clock, wallet, catalog.Data.StarDailyMax, stars);
    }

    internal static async Task<KampusWallet> LockWalletAsync(KampusDbContext db, KampusClock clock, Guid studentId, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO kampus_wallets ("StudentId", "KpBalance", "PendingLevelUp", "CreatedAt", "UpdatedAt")
            VALUES ({studentId}, 0, 0, {now}, {now})
            ON CONFLICT ("StudentId") DO NOTHING
            """, cancellationToken);

        // A tracked copy would be returned as-is (identity resolution), hiding the row we just locked.
        foreach (var stale in db.ChangeTracker.Entries<KampusWallet>().Where(e => e.Entity.StudentId == studentId).ToList())
        {
            stale.State = EntityState.Detached;
        }

        // Not composed (no Single/First on the query), so EF sends the statement as written, FOR UPDATE included.
        var rows = await db.Wallets
            .FromSqlInterpolated($"""SELECT * FROM kampus_wallets WHERE "StudentId" = {studentId} FOR UPDATE""")
            .ToListAsync(cancellationToken);
        return rows.Single();
    }

    public async Task<bool> WasRewardedAsync(string kind, string reference, CancellationToken cancellationToken) =>
        _awarded.Contains((kind, reference))
        || await _db.Rewards.AnyAsync(r => r.StudentId == Wallet.StudentId && r.Kind == kind && r.Ref == reference, cancellationToken);

    public async Task<KampusGain> AwardAsync(string kind, string reference, int kp, int star, CancellationToken cancellationToken)
    {
        star = Math.Min(Math.Max(0, star), StarsLeftToday);
        kp = Math.Max(0, kp);
        if ((kp == 0 && star == 0) || await WasRewardedAsync(kind, reference, cancellationToken))
        {
            return KampusGain.None;
        }

        var now = _clock.UtcNow;
        _db.Rewards.Add(new KampusReward
        {
            StudentId = Wallet.StudentId,
            Kind = kind,
            Ref = reference,
            Kp = kp,
            Star = star,
            AwardedAt = now,
            Day = KampusClock.DayOf(now),
            Week = KampusClock.WeekOf(now)
        });
        _awarded.Add((kind, reference));
        _starsToday += star;
        Wallet.KpBalance += kp;
        Wallet.UpdatedAt = now;
        return new KampusGain(kp, star);
    }
}
