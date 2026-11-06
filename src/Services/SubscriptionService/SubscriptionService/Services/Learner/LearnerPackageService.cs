using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using SubscriptionService.Configuration;
using SubscriptionService.Data;

namespace SubscriptionService.Services.Learner;

public enum LearnerResultStatus
{
    Ok,
    NotFound,
    Conflict,
    Invalid
}

/// <summary>A service outcome the controllers turn into a status code.</summary>
public sealed record LearnerResult<T>(LearnerResultStatus Status, T? Value, string? Error)
{
    public bool IsOk => Status == LearnerResultStatus.Ok;
}

public static class LearnerResult
{
    public static LearnerResult<T> Ok<T>(T value) => new(LearnerResultStatus.Ok, value, null);
    public static LearnerResult<T> NotFound<T>(string error) => new(LearnerResultStatus.NotFound, default, error);
    public static LearnerResult<T> Conflict<T>(string error) => new(LearnerResultStatus.Conflict, default, error);
    public static LearnerResult<T> Invalid<T>(string error) => new(LearnerResultStatus.Invalid, default, error);
}

public interface ILearnerPackageService
{
    Task<List<LearnerPackageDto>> GetCatalogAsync(bool includeInactive, CancellationToken cancellationToken = default);

    /// <summary>The package a student has right now. Callers check that the asker may see this student.</summary>
    Task<LearnerAccessDto> GetAccessAsync(Guid studentId, CancellationToken cancellationToken = default);

    Task<List<LearnerPassDto>> GetPassesAsync(Guid studentId, CancellationToken cancellationToken = default);

    /// <summary>One free trial per student, ever.</summary>
    Task<LearnerResult<LearnerAccessDto>> StartTrialAsync(Guid studentId, Guid requestedBy, CancellationToken cancellationToken = default);

    /// <summary>Creates an unpaid order. The amount comes from the catalogue, never from the request.</summary>
    Task<LearnerResult<LearnerOrderDto>> CreateOrderAsync(CreateLearnerOrderRequest request, PaymentBuyer payer, CancellationToken cancellationToken = default);

    Task<LearnerResult<LearnerOrderDto>> NotifyPaidAsync(Guid orderId, Guid payerId, string? note, CancellationToken cancellationToken = default);
    Task<LearnerResult<LearnerOrderDto>> CancelOrderAsync(Guid orderId, Guid payerId, CancellationToken cancellationToken = default);
    Task<List<LearnerOrderDto>> GetOrdersByPayerAsync(Guid payerId, CancellationToken cancellationToken = default);
    Task<List<LearnerOrderDto>> GetOrdersForStudentAsync(Guid studentId, CancellationToken cancellationToken = default);

    Task<PagedResponse<LearnerOrderDto>> AdminListOrdersAsync(LearnerOrderStatus? status, PagedRequest paging, CancellationToken cancellationToken = default);

    /// <summary>Marks an unpaid order paid and grants the package. A second approval gets Conflict.</summary>
    Task<LearnerResult<LearnerOrderDto>> ApproveAsync(Guid orderId, Guid adminId, CancellationToken cancellationToken = default);

    Task<LearnerResult<LearnerOrderDto>> RejectAsync(Guid orderId, Guid adminId, string reason, CancellationToken cancellationToken = default);
    Task<LearnerResult<LearnerPassDto>> GrantAsync(GrantLearnerPassRequest request, Guid adminId, CancellationToken cancellationToken = default);
    Task<LearnerResult<LearnerPackageDto>> UpdatePackageAsync(string code, UpdateLearnerPackageRequest request, CancellationToken cancellationToken = default);
    Task<LearnerResult<LearnerPackageDto>> SetPricesAsync(string code, SetLearnerPricesRequest request, CancellationToken cancellationToken = default);
}

public class LearnerPackageService : ILearnerPackageService
{
    private static readonly HashSet<string> KnownFeatures =
    [
        LearnerFeatures.PremiumContent, LearnerFeatures.UnlimitedPractice,
        LearnerFeatures.PremiumAssessments, LearnerFeatures.LiveGroupLessons
    ];

    private static readonly LearnerOrderStatus[] Open = [LearnerOrderStatus.Pending, LearnerOrderStatus.AwaitingApproval];

    private readonly SubscriptionDbContext _db;
    private readonly ILearnerPaymentProvider _payments;
    private readonly LearnerOptions _options;
    private readonly TimeProvider _clock;
    private readonly ILogger<LearnerPackageService> _logger;

    public LearnerPackageService(
        SubscriptionDbContext db,
        ILearnerPaymentProvider payments,
        IOptions<LearnerOptions> options,
        TimeProvider clock,
        ILogger<LearnerPackageService> logger)
    {
        ArgumentNullException.ThrowIfNull(options);
        _db = db;
        _payments = payments;
        _options = options.Value;
        _clock = clock;
        _logger = logger;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    // ---- Catalogue and access ----

    public async Task<List<LearnerPackageDto>> GetCatalogAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var packages = await _db.LearnerPackages.AsNoTracking()
            .Include(p => p.Prices)
            .Where(p => includeInactive || p.IsActive)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Tier)
            .ToListAsync(cancellationToken);

        return packages.Select(p => ToDto(p, includeInactive)).ToList();
    }

    public async Task<LearnerAccessDto> GetAccessAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var now = Now;
        var passes = await _db.LearnerPasses.AsNoTracking()
            .Include(p => p.Package)
            .Where(p => p.StudentId == studentId && p.EndsAt > now)
            .ToListAsync(cancellationToken);
        var trialAvailable = !await _db.LearnerPasses.AnyAsync(
            p => p.StudentId == studentId && p.Source == LearnerPassSource.Trial, cancellationToken);

        var best = passes
            .Where(p => p.StartsAt <= now && p.Package != null)
            .OrderByDescending(p => p.Tier).ThenByDescending(p => p.EndsAt)
            .FirstOrDefault();

        if (best is null)
        {
            return new LearnerAccessDto(studentId, null, null, 0, [], _options.FreePracticeTestsPerDay, null, trialAvailable);
        }

        // Extensions already paid for are queued right after the current pass; report the last day of the run.
        var endsAt = passes.Where(p => p.PackageId == best.PackageId).Max(p => p.EndsAt);
        var package = best.Package!;
        return new LearnerAccessDto(
            studentId, package.Code, package.Name, package.Tier, package.Features.ToList(),
            package.PracticeTestsPerDay, endsAt, trialAvailable);
    }

    public async Task<List<LearnerPassDto>> GetPassesAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var passes = await _db.LearnerPasses.AsNoTracking()
            .Include(p => p.Package)
            .Where(p => p.StudentId == studentId)
            .OrderByDescending(p => p.EndsAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        return passes.Select(ToDto).ToList();
    }

    public async Task<LearnerResult<LearnerAccessDto>> StartTrialAsync(Guid studentId, Guid requestedBy, CancellationToken cancellationToken = default)
    {
        if (await _db.LearnerPasses.AnyAsync(p => p.StudentId == studentId && p.Source == LearnerPassSource.Trial, cancellationToken))
        {
            return LearnerResult.Conflict<LearnerAccessDto>("The free trial has already been used");
        }

        var package = await _db.LearnerPackages.FirstOrDefaultAsync(p => p.Code == _options.TrialPackageCode, cancellationToken);
        if (package is null)
        {
            return LearnerResult.NotFound<LearnerAccessDto>("The trial package is not set up");
        }

        var now = Now;
        _db.LearnerPasses.Add(new LearnerPass
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            PackageId = package.Id,
            Tier = package.Tier,
            StartsAt = now,
            EndsAt = now.AddDays(_options.TrialDays),
            Source = LearnerPassSource.Trial,
            CreatedBy = requestedBy,
            CreatedAt = now,
        });
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Trial of {Package} started for student {StudentId} by {UserId}", package.Code, studentId, requestedBy);
        return LearnerResult.Ok(await GetAccessAsync(studentId, cancellationToken));
    }

    // ---- Orders ----

    public async Task<LearnerResult<LearnerOrderDto>> CreateOrderAsync(CreateLearnerOrderRequest request, PaymentBuyer payer, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payer);

        if (request.StudentId == Guid.Empty || !Enum.IsDefined(request.Term))
        {
            return LearnerResult.Invalid<LearnerOrderDto>("Choose a student and a term");
        }

        var package = await _db.LearnerPackages
            .Include(p => p.Prices)
            .FirstOrDefaultAsync(p => p.Code == request.PackageCode && p.IsActive, cancellationToken);
        var price = package?.Prices.FirstOrDefault(p => p.Term == request.Term && p.IsActive);
        if (package is null || price is null)
        {
            return LearnerResult.NotFound<LearnerOrderDto>("That package is not on sale for this term");
        }

        var now = Now;
        if (request.Term == LearnerTerm.Summer && !LearnerRules.IsSummerSaleOpen(now, _options.SummerSaleFromMonth, _options.SummerSaleToMonth))
        {
            return LearnerResult.Invalid<LearnerOrderDto>("The summer package is not on sale now");
        }

        var open = await _db.LearnerOrders.CountAsync(o => o.PayerId == payer.UserId && Open.Contains(o.Status), cancellationToken);
        if (open >= _options.MaxOpenOrdersPerPayer)
        {
            return LearnerResult.Conflict<LearnerOrderDto>("Too many unpaid orders; pay or cancel one first");
        }

        var order = new LearnerOrder
        {
            Id = Guid.NewGuid(),
            PayerId = payer.UserId,
            StudentId = request.StudentId,
            PackageId = package.Id,
            Term = request.Term,
            Amount = price.Price,
            Currency = price.Currency,
            Status = LearnerOrderStatus.Pending,
            Provider = _payments.Name,
            CreatedAt = now,
            Package = package,
        };

        // The code is short; on the rare collision draw another.
        for (var attempt = 0; ; attempt++)
        {
            order.Reference = LearnerRules.NewReference();
            if (!await _db.LearnerOrders.AnyAsync(o => o.Reference == order.Reference, cancellationToken) || attempt >= 5)
            {
                break;
            }
        }

        _db.LearnerOrders.Add(order);
        await _db.SaveChangesAsync(cancellationToken);

        var instructions = await _payments.StartAsync(order, payer, cancellationToken);
        _logger.LogInformation("Order {Reference} for {Package}/{Term} created by {PayerId} for {StudentId}",
            order.Reference, package.Code, request.Term, payer.UserId, request.StudentId);
        return LearnerResult.Ok(ToDto(order, instructions));
    }

    public async Task<LearnerResult<LearnerOrderDto>> NotifyPaidAsync(Guid orderId, Guid payerId, string? note, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (order is null || order.PayerId != payerId)
        {
            return LearnerResult.NotFound<LearnerOrderDto>("Order not found");
        }

        if (order.Status != LearnerOrderStatus.Pending)
        {
            return LearnerResult.Conflict<LearnerOrderDto>("Only an unpaid order can be reported as paid");
        }

        order.Status = LearnerOrderStatus.AwaitingApproval;
        order.PayerNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, 500)];
        await _db.SaveChangesAsync(cancellationToken);
        return LearnerResult.Ok(await ToDtoAsync(order, cancellationToken));
    }

    public async Task<LearnerResult<LearnerOrderDto>> CancelOrderAsync(Guid orderId, Guid payerId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (order is null || order.PayerId != payerId)
        {
            return LearnerResult.NotFound<LearnerOrderDto>("Order not found");
        }

        if (!Open.Contains(order.Status))
        {
            return LearnerResult.Conflict<LearnerOrderDto>("This order can no longer be cancelled");
        }

        order.Status = LearnerOrderStatus.Canceled;
        order.DecidedAt = Now;
        order.DecidedBy = payerId;
        await _db.SaveChangesAsync(cancellationToken);
        return LearnerResult.Ok(await ToDtoAsync(order, cancellationToken));
    }

    public async Task<List<LearnerOrderDto>> GetOrdersByPayerAsync(Guid payerId, CancellationToken cancellationToken = default)
    {
        var orders = await _db.LearnerOrders.AsNoTracking().Include(o => o.Package)
            .Where(o => o.PayerId == payerId)
            .OrderByDescending(o => o.CreatedAt).Take(50)
            .ToListAsync(cancellationToken);
        return await ToDtosAsync(orders, cancellationToken);
    }

    public async Task<List<LearnerOrderDto>> GetOrdersForStudentAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var orders = await _db.LearnerOrders.AsNoTracking().Include(o => o.Package)
            .Where(o => o.StudentId == studentId)
            .OrderByDescending(o => o.CreatedAt).Take(50)
            .ToListAsync(cancellationToken);
        return await ToDtosAsync(orders, cancellationToken);
    }

    // ---- Administration ----

    public async Task<PagedResponse<LearnerOrderDto>> AdminListOrdersAsync(LearnerOrderStatus? status, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(paging);

        var query = _db.LearnerOrders.AsNoTracking().Include(o => o.Package).AsQueryable();
        if (status is { } s)
        {
            query = query.Where(o => o.Status == s);
        }

        var total = await query.CountAsync(cancellationToken);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;
        var orders = await query
            // Orders the payer says are paid come first: they are the ones waiting on a person.
            .OrderBy(o => o.Status == LearnerOrderStatus.AwaitingApproval ? 0 : 1)
            .ThenByDescending(o => o.CreatedAt)
            .Skip((page - 1) * size).Take(size)
            .ToListAsync(cancellationToken);

        return new PagedResponse<LearnerOrderDto>(
            await ToDtosAsync(orders, cancellationToken), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<LearnerResult<LearnerOrderDto>> ApproveAsync(Guid orderId, Guid adminId, CancellationToken cancellationToken = default)
    {
        var now = Now;
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        // One conditional update decides who wins when two approvals race; the loser changes nothing.
        var changed = await _db.LearnerOrders
            .Where(o => o.Id == orderId && Open.Contains(o.Status))
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, LearnerOrderStatus.Paid)
                .SetProperty(o => o.PaidAt, now)
                .SetProperty(o => o.DecidedAt, now)
                .SetProperty(o => o.DecidedBy, adminId), cancellationToken);

        if (changed == 0)
        {
            return await _db.LearnerOrders.AnyAsync(o => o.Id == orderId, cancellationToken)
                ? LearnerResult.Conflict<LearnerOrderDto>("This order is not waiting for payment")
                : LearnerResult.NotFound<LearnerOrderDto>("Order not found");
        }

        // The bulk update bypassed the change tracker; drop anything it may hold so nothing stale is read or saved.
        _db.ChangeTracker.Clear();
        var order = await _db.LearnerOrders.AsNoTracking()
            .Include(o => o.Package).ThenInclude(p => p!.Prices)
            .FirstAsync(o => o.Id == orderId, cancellationToken);
        var package = order.Package!;
        var durationDays = package.Prices.FirstOrDefault(p => p.Term == order.Term)?.DurationDays ?? DefaultDays(order.Term);

        await AddPassAsync(order.StudentId, package, order.Term, durationDays, LearnerPassSource.Purchase, order.Id, adminId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("Order {Reference} approved by {AdminId}", order.Reference, adminId);
        return LearnerResult.Ok(await ToDtoAsync(order, cancellationToken));
    }

    public async Task<LearnerResult<LearnerOrderDto>> RejectAsync(Guid orderId, Guid adminId, string reason, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return LearnerResult.Invalid<LearnerOrderDto>("Write why the order is rejected");
        }

        var now = Now;
        var trimmed = reason.Trim()[..Math.Min(reason.Trim().Length, 500)];
        var changed = await _db.LearnerOrders
            .Where(o => o.Id == orderId && Open.Contains(o.Status))
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, LearnerOrderStatus.Rejected)
                .SetProperty(o => o.RejectReason, trimmed)
                .SetProperty(o => o.DecidedAt, now)
                .SetProperty(o => o.DecidedBy, adminId), cancellationToken);

        if (changed == 0)
        {
            return await _db.LearnerOrders.AnyAsync(o => o.Id == orderId, cancellationToken)
                ? LearnerResult.Conflict<LearnerOrderDto>("This order is not waiting for payment")
                : LearnerResult.NotFound<LearnerOrderDto>("Order not found");
        }

        _db.ChangeTracker.Clear();
        var order = await LoadOrderAsync(orderId, cancellationToken);
        return LearnerResult.Ok(await ToDtoAsync(order!, cancellationToken));
    }

    public async Task<LearnerResult<LearnerPassDto>> GrantAsync(GrantLearnerPassRequest request, Guid adminId, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.StudentId == Guid.Empty || request.Days is < 1 or > 730)
        {
            return LearnerResult.Invalid<LearnerPassDto>("Choose a student and 1–730 days");
        }

        var package = await _db.LearnerPackages.FirstOrDefaultAsync(p => p.Code == request.PackageCode, cancellationToken);
        if (package is null)
        {
            return LearnerResult.NotFound<LearnerPassDto>("Package not found");
        }

        var pass = await AddPassAsync(request.StudentId, package, LearnerTerm.Month1, request.Days, LearnerPassSource.AdminGrant, null, adminId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        pass.Package = package;
        return LearnerResult.Ok(ToDto(pass));
    }

    public async Task<LearnerResult<LearnerPackageDto>> UpdatePackageAsync(string code, UpdateLearnerPackageRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var package = await _db.LearnerPackages.Include(p => p.Prices).FirstOrDefaultAsync(p => p.Code == code, cancellationToken);
        if (package is null)
        {
            return LearnerResult.NotFound<LearnerPackageDto>("Package not found");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100 || (request.Description?.Length ?? 0) > 1000)
        {
            return LearnerResult.Invalid<LearnerPackageDto>("A name of at most 100 characters is required");
        }

        var features = (request.Features ?? []).Select(f => f.Trim()).Distinct(StringComparer.Ordinal).ToList();
        var unknown = features.Where(f => !KnownFeatures.Contains(f)).ToList();
        if (unknown.Count > 0)
        {
            return LearnerResult.Invalid<LearnerPackageDto>("Unknown feature: " + string.Join(", ", unknown));
        }

        if (request.PracticeTestsPerDay < -1)
        {
            return LearnerResult.Invalid<LearnerPackageDto>("Daily tests must be -1 (unlimited) or more");
        }

        package.Name = request.Name.Trim();
        package.Description = request.Description?.Trim() ?? string.Empty;
        package.Features = features;
        package.PracticeTestsPerDay = request.PracticeTestsPerDay;
        package.IsActive = request.IsActive;
        package.SortOrder = request.SortOrder;
        package.UpdatedAt = Now;
        await _db.SaveChangesAsync(cancellationToken);
        return LearnerResult.Ok(ToDto(package, includeInactive: true));
    }

    public async Task<LearnerResult<LearnerPackageDto>> SetPricesAsync(string code, SetLearnerPricesRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var package = await _db.LearnerPackages.Include(p => p.Prices).FirstOrDefaultAsync(p => p.Code == code, cancellationToken);
        if (package is null)
        {
            return LearnerResult.NotFound<LearnerPackageDto>("Package not found");
        }

        var prices = request.Prices ?? [];
        if (prices.Select(p => p.Term).Distinct().Count() != prices.Count)
        {
            return LearnerResult.Invalid<LearnerPackageDto>("Each term may appear once");
        }

        if (prices.Any(p => !Enum.IsDefined(p.Term) || p.Price < 0 || (p.Term != LearnerTerm.Summer && p.DurationDays is < 1 or > 730)))
        {
            return LearnerResult.Invalid<LearnerPackageDto>("Prices must be 0 or more and terms 1–730 days");
        }

        foreach (var input in prices)
        {
            var existing = package.Prices.FirstOrDefault(p => p.Term == input.Term);
            if (existing is null)
            {
                _db.LearnerPackagePrices.Add(new LearnerPackagePrice
                {
                    Id = Guid.NewGuid(),
                    PackageId = package.Id,
                    Term = input.Term,
                    DurationDays = input.DurationDays,
                    Price = input.Price,
                    Currency = string.IsNullOrWhiteSpace(input.Currency) ? "TRY" : input.Currency.Trim().ToUpperInvariant(),
                    IsActive = input.IsActive,
                });
            }
            else
            {
                existing.DurationDays = input.DurationDays;
                existing.Price = input.Price;
                existing.Currency = string.IsNullOrWhiteSpace(input.Currency) ? existing.Currency : input.Currency.Trim().ToUpperInvariant();
                existing.IsActive = input.IsActive;
            }
        }

        package.UpdatedAt = Now;
        await _db.SaveChangesAsync(cancellationToken);
        await _db.Entry(package).Collection(p => p.Prices).LoadAsync(cancellationToken);
        return LearnerResult.Ok(ToDto(package, includeInactive: true));
    }

    // ---- Helpers ----

    /// <summary>
    /// Adds a pass. Buying the same package again queues it right after the one already running, so
    /// renewing early never loses days; a different (higher) package starts now.
    /// </summary>
    private async Task<LearnerPass> AddPassAsync(
        Guid studentId, LearnerPackage package, LearnerTerm term, int durationDays, LearnerPassSource source,
        Guid? orderId, Guid createdBy, CancellationToken cancellationToken)
    {
        var now = Now;
        var runningUntil = await _db.LearnerPasses
            .Where(p => p.StudentId == studentId && p.PackageId == package.Id && p.EndsAt > now && p.Source != LearnerPassSource.Trial)
            .MaxAsync(p => (DateTime?)p.EndsAt, cancellationToken);
        var startsAt = runningUntil ?? now;
        var endsAt = source == LearnerPassSource.AdminGrant
            ? startsAt.AddDays(durationDays)
            : LearnerRules.EndsAt(term, durationDays, startsAt, now, _options.SummerEndsMonth, _options.SummerEndsDay);

        var pass = new LearnerPass
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            PackageId = package.Id,
            Tier = package.Tier,
            StartsAt = startsAt,
            EndsAt = endsAt,
            Source = source,
            OrderId = orderId,
            CreatedBy = createdBy,
            CreatedAt = now,
        };
        _db.LearnerPasses.Add(pass);
        return pass;
    }

    private static int DefaultDays(LearnerTerm term) => term switch
    {
        LearnerTerm.Month3 => 90,
        LearnerTerm.Month12 => 365,
        _ => 30
    };

    private Task<LearnerOrder?> LoadOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        _db.LearnerOrders.Include(o => o.Package).FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

    private async Task<List<LearnerOrderDto>> ToDtosAsync(List<LearnerOrder> orders, CancellationToken cancellationToken)
    {
        var list = new List<LearnerOrderDto>(orders.Count);
        foreach (var order in orders)
        {
            list.Add(await ToDtoAsync(order, cancellationToken));
        }

        return list;
    }

    /// <summary>Unpaid orders carry the payment instructions so the payer can always find them again.</summary>
    private async Task<LearnerOrderDto> ToDtoAsync(LearnerOrder order, CancellationToken cancellationToken)
    {
        var instructions = Open.Contains(order.Status)
            ? await _payments.StartAsync(order, new PaymentBuyer(order.PayerId, null, null, null), cancellationToken)
            : null;
        return ToDto(order, instructions);
    }

    private static LearnerOrderDto ToDto(LearnerOrder order, PaymentInstructionsDto? instructions) => new(
        order.Id,
        order.Reference,
        order.PayerId,
        order.StudentId,
        order.Package?.Code ?? string.Empty,
        order.Package?.Name ?? string.Empty,
        order.Term,
        order.Amount,
        order.Currency,
        order.Status,
        order.Provider,
        order.PayerNote,
        order.RejectReason,
        order.CreatedAt,
        order.PaidAt,
        instructions);

    private static LearnerPassDto ToDto(LearnerPass pass) => new(
        pass.Id, pass.Package?.Code ?? string.Empty, pass.Package?.Name ?? string.Empty, pass.Tier,
        pass.StartsAt, pass.EndsAt, pass.Source);

    private static LearnerPackageDto ToDto(LearnerPackage package, bool includeInactive) => new(
        package.Code,
        package.Name,
        package.Description,
        package.Tier,
        package.Features.ToList(),
        package.PracticeTestsPerDay,
        package.IsActive,
        package.SortOrder,
        package.Prices
            .Where(p => includeInactive || p.IsActive)
            .OrderBy(p => p.Term)
            .Select(p => new LearnerPriceDto(p.Term, p.DurationDays, p.Price, p.Currency, p.IsActive))
            .ToList());
}
