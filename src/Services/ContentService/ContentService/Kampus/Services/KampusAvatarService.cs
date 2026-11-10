using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace ContentService.Kampus.Services;

/// <summary>
/// The avatar: free base parts, and outfits/accessories/backgrounds bought with 💎 KP. Buying only lowers
/// KP (never ⭐ or the cup rank), happens under the wallet lock so a balance never goes below zero, and an
/// item is bought once.
/// </summary>
public sealed class KampusAvatarService
{
    private static readonly string[] Slots = ["outfit", "acc", "bg"];

    private readonly KampusDbContext _db;
    private readonly KampusCatalog _catalog;
    private readonly KampusClock _clock;

    public KampusAvatarService(KampusDbContext db, KampusCatalog catalog, KampusClock clock)
    {
        _db = db;
        _catalog = catalog;
        _clock = clock;
    }

    public async Task<AvatarDto> GetAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var avatar = await _db.Avatars.AsNoTracking().FirstOrDefaultAsync(a => a.StudentId == studentId, cancellationToken);
        var owned = await _db.OwnedItems.Where(o => o.StudentId == studentId).OrderBy(o => o.AcquiredAt).Select(o => o.ItemId).ToListAsync(cancellationToken);
        var kp = await _db.Wallets.Where(w => w.StudentId == studentId).Select(w => w.KpBalance).FirstOrDefaultAsync(cancellationToken);
        return ToDto(avatar, owned, kp);
    }

    public async Task<ContentResult<AvatarDto>> SaveAsync(Caller caller, SaveAvatarRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<AvatarDto>("Yalnızca öğrenciler.");
        }

        var cfg = new Dictionary<string, string>(_catalog.Data.Avatar.Default);
        foreach (var (key, value) in request.Cfg ?? new())
        {
            if (!_catalog.Data.Avatar.Base.TryGetValue(key, out var options) || !options.Contains(value))
            {
                return ContentResult.Invalid<AvatarDto>("Bu avatar seçeneği yok.");
            }

            cfg[key] = value;
        }

        var owned = await _db.OwnedItems.Where(o => o.StudentId == caller.UserId).Select(o => o.ItemId).ToListAsync(cancellationToken);
        var eq = Slots.ToDictionary(s => s, _ => (string?)null);
        foreach (var (slot, itemId) in request.Eq ?? new())
        {
            if (!Slots.Contains(slot))
            {
                return ContentResult.Invalid<AvatarDto>("Bu avatar yuvası yok.");
            }

            if (itemId is null)
            {
                continue;
            }

            var item = _catalog.AvatarItem(itemId);
            if (item is null || item.Slot != slot)
            {
                return ContentResult.Invalid<AvatarDto>("Parça bulunamadı.");
            }

            if (!owned.Contains(itemId))
            {
                return ContentResult.Invalid<AvatarDto>("Bu parça henüz açılmadı.");
            }

            eq[slot] = itemId;
        }

        var avatar = await _db.Avatars.FirstOrDefaultAsync(a => a.StudentId == caller.UserId, cancellationToken);
        if (avatar is null)
        {
            avatar = new KampusAvatar { StudentId = caller.UserId };
            _db.Avatars.Add(avatar);
        }

        avatar.Custom = true;
        avatar.Config = cfg;
        avatar.Equipped = eq;
        avatar.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(await GetAsync(caller.UserId, cancellationToken));
    }

    public async Task<ContentResult<AvatarDto>> BuyAsync(Caller caller, string itemId, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<AvatarDto>("Yalnızca öğrenciler.");
        }

        var item = _catalog.AvatarItem(itemId);
        if (item is null)
        {
            return ContentResult.NotFound<AvatarDto>("Parça bulunamadı.");
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var wallet = await KampusRewardSession.LockWalletAsync(_db, _clock, caller.UserId, cancellationToken);

        if (!await _db.OwnedItems.AnyAsync(o => o.StudentId == caller.UserId && o.ItemId == itemId, cancellationToken))
        {
            if (wallet.KpBalance < item.Price)
            {
                return ContentResult.Invalid<AvatarDto>($"Bu parça için {item.Price - wallet.KpBalance} KP daha gerekiyor.");
            }

            wallet.KpBalance -= item.Price;
            wallet.UpdatedAt = _clock.UtcNow;
            _db.OwnedItems.Add(new KampusOwnedItem { StudentId = caller.UserId, ItemId = itemId, PricePaid = item.Price, AcquiredAt = _clock.UtcNow });
            await _db.SaveChangesAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
        return ContentResult.Ok(await GetAsync(caller.UserId, cancellationToken));
    }

    private AvatarDto ToDto(KampusAvatar? avatar, IReadOnlyList<string> owned, int kp)
    {
        var cfg = new Dictionary<string, string>(_catalog.Data.Avatar.Default);
        foreach (var (k, v) in avatar?.Config ?? new())
        {
            cfg[k] = v;
        }

        var eq = Slots.ToDictionary(s => s, s => avatar?.Equipped.GetValueOrDefault(s));
        return new AvatarDto(avatar?.Custom == true, cfg, owned, eq, kp);
    }
}
