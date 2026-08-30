using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using SubscriptionService.Configuration;
using SubscriptionService.Data;

namespace SubscriptionService.Services;

public class TrialAlreadyUsedException : Exception
{
    public TrialAlreadyUsedException() : base("Deneme süresi daha önce kullanılmış.") { }
}

public class PlanNotFoundException : Exception
{
    public PlanNotFoundException(string code) : base($"Plan bulunamadı: {code}") { }
}

public interface ISubscriptionManagementService
{
    Task<List<PlanDto>> GetPlansAsync();
    Task<SubscriptionDto> GetMySubscriptionAsync(Guid userId);
    Task<SubscriptionDto> StartTrialAsync(Guid userId);
    Task<CheckoutResultDto> CreateCheckoutAsync(Guid userId, CheckoutRequest request);
    Task<SubscriptionDto> CancelAsync(Guid userId);
    Task<EntitlementsDto> GetEntitlementsAsync(Guid userId);
    Task<ConsumeUsageResultDto> ConsumeUsageAsync(Guid userId, ConsumeUsageRequest request);
    Task ReleaseUsageAsync(Guid userId, ConsumeUsageRequest request);

    Task<List<AdminSubscriptionDto>> AdminListSubscriptionsAsync();
    Task<AdminSubscriptionDto> AdminAssignPlanAsync(SubscriberType type, Guid subscriberId, AdminAssignPlanRequest request);
    Task<List<AdminOrderDto>> AdminListOrdersAsync();
    Task<bool> AdminMarkOrderPaidAsync(Guid orderId);
}

public class SubscriptionManagementService : ISubscriptionManagementService
{
    /// <summary>Metrics that are tracked by a running UsageCounter. The rest (MaxStudentsPerClassroom,
    /// MaxQuestionsPerExam) are per-resource ceilings the caller compares against locally.</summary>
    private static readonly HashSet<QuotaMetric> ConsumableMetrics =
    [
        QuotaMetric.Classrooms, QuotaMetric.ExamsCreated, QuotaMetric.HomeworksCreated,
        QuotaMetric.LiveMinutes, QuotaMetric.StorageMegabytes, QuotaMetric.Seats
    ];

    private readonly SubscriptionDbContext _context;
    private readonly ISubscriberResolver _resolver;
    private readonly IPaymentProvider _paymentProvider;
    private readonly TrialOptions _trialOptions;
    private readonly ILogger<SubscriptionManagementService> _logger;

    public SubscriptionManagementService(
        SubscriptionDbContext context,
        ISubscriberResolver resolver,
        IPaymentProvider paymentProvider,
        IOptions<TrialOptions> trialOptions,
        ILogger<SubscriptionManagementService> logger)
    {
        _context = context;
        _resolver = resolver;
        _paymentProvider = paymentProvider;
        _trialOptions = trialOptions.Value;
        _logger = logger;
    }

    public async Task<List<PlanDto>> GetPlansAsync()
    {
        var plans = await _context.Plans
            .Include(p => p.Limits)
            .Include(p => p.Features)
            .Where(p => p.IsPublic && p.IsActive)
            .OrderBy(p => p.SortOrder)
            .AsNoTracking()
            .ToListAsync();

        return plans.Select(ToPlanDto).ToList();
    }

    public async Task<SubscriptionDto> GetMySubscriptionAsync(Guid userId)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);
        await _context.SaveChangesAsync();
        return await BuildSubscriptionDtoAsync(sub);
    }

    public async Task<SubscriptionDto> StartTrialAsync(Guid userId)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);

        if (sub.TrialUsedAt != null || sub.Status == SubscriptionStatus.Trialing)
            throw new TrialAlreadyUsedException();

        var trialPlanCode = subRef.Type == SubscriberType.Organization ? "institution" : _trialOptions.PlanCode;
        var plan = await GetPlanByCodeAsync(trialPlanCode) ?? throw new PlanNotFoundException(trialPlanCode);

        sub.PlanId = plan.Id;
        sub.Status = SubscriptionStatus.Trialing;
        sub.TrialEndsAt = DateTime.UtcNow.AddDays(_trialOptions.DurationDays);
        sub.TrialUsedAt = DateTime.UtcNow;
        sub.CancelAtPeriodEnd = false;
        sub.UpdatedAt = DateTime.UtcNow;

        LogEvent(subRef.Type, subRef.Id, "TrialStarted", new { plan.Code, sub.TrialEndsAt });

        await _context.SaveChangesAsync();
        return await BuildSubscriptionDtoAsync(sub);
    }

    public async Task<CheckoutResultDto> CreateCheckoutAsync(Guid userId, CheckoutRequest request)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);
        var plan = await GetPlanByCodeAsync(request.PlanCode) ?? throw new PlanNotFoundException(request.PlanCode);

        var amount = request.Cycle == BillingCycle.Yearly ? plan.PriceYearly : plan.PriceMonthly;

        var order = new SubscriptionOrder
        {
            Id = Guid.NewGuid(),
            SubscriptionId = sub.Id,
            PlanId = plan.Id,
            Cycle = request.Cycle,
            Amount = amount,
            Currency = plan.Currency,
            Status = OrderStatus.Pending,
            Provider = _paymentProvider.Name,
            CreatedAt = DateTime.UtcNow
        };
        _context.SubscriptionOrders.Add(order);

        var result = await _paymentProvider.CreateCheckoutAsync(order);
        order.ProviderReference = result.ProviderReference;

        LogEvent(subRef.Type, subRef.Id, "CheckoutCreated", new { plan.Code, request.Cycle, amount });

        await _context.SaveChangesAsync();

        return new CheckoutResultDto(order.Id, order.Amount, order.Currency, order.Provider, result.Instructions);
    }

    public async Task<SubscriptionDto> CancelAsync(Guid userId)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);

        sub.CancelAtPeriodEnd = true;
        sub.UpdatedAt = DateTime.UtcNow;
        LogEvent(subRef.Type, subRef.Id, "CancelRequested", null);

        await _context.SaveChangesAsync();
        return await BuildSubscriptionDtoAsync(sub);
    }

    public async Task<EntitlementsDto> GetEntitlementsAsync(Guid userId)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);
        await _context.SaveChangesAsync();

        var plan = await _context.Plans.Include(p => p.Limits).Include(p => p.Features)
            .AsNoTracking().FirstAsync(p => p.Id == sub.PlanId);

        var usage = await GetUsageSnapshotsAsync(subRef.Type, subRef.Id, sub, plan);

        return new EntitlementsDto(
            subRef.Type, subRef.Id, plan.Code, sub.Status,
            plan.Limits.Select(l => new PlanLimitDto(l.Metric, l.Value, l.Period)).ToList(),
            plan.Features.Select(f => new PlanFeatureDto(f.FeatureCode, f.IsEnabled)).ToList(),
            usage);
    }

    public async Task<ConsumeUsageResultDto> ConsumeUsageAsync(Guid userId, ConsumeUsageRequest request)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);

        var plan = await _context.Plans.Include(p => p.Limits).AsNoTracking().FirstAsync(p => p.Id == sub.PlanId);
        var limit = plan.Limits.FirstOrDefault(l => l.Metric == request.Metric);
        var limitValue = limit?.Value ?? 0;

        if (sub.Status is SubscriptionStatus.Expired or SubscriptionStatus.Canceled or SubscriptionStatus.PastDue)
        {
            await _context.SaveChangesAsync();
            return new ConsumeUsageResultDto(false, 0, limitValue, "Aboneliğiniz aktif değil.");
        }

        DateTime? periodStart = limit?.Period == QuotaPeriod.Monthly ? sub.CurrentPeriodStart : null;
        var counter = await _context.UsageCounters.FirstOrDefaultAsync(c =>
            c.SubscriberType == subRef.Type && c.SubscriberId == subRef.Id &&
            c.Metric == request.Metric && c.PeriodStart == periodStart);
        var currentValue = counter?.Value ?? 0;

        if (limitValue >= 0 && currentValue + request.Amount > limitValue)
        {
            await _context.SaveChangesAsync();
            return new ConsumeUsageResultDto(false, currentValue, limitValue, "Planınızın kotasını doldurdunuz.");
        }

        if (counter == null)
        {
            counter = new UsageCounter
            {
                Id = Guid.NewGuid(),
                SubscriberType = subRef.Type,
                SubscriberId = subRef.Id,
                Metric = request.Metric,
                PeriodStart = periodStart,
                Value = 0
            };
            _context.UsageCounters.Add(counter);
        }

        counter.Value += request.Amount;
        counter.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return new ConsumeUsageResultDto(true, counter.Value, limitValue, null);
    }

    public async Task ReleaseUsageAsync(Guid userId, ConsumeUsageRequest request)
    {
        var subRef = await _resolver.ResolveAsync(userId);
        var sub = await EnsureSubscriptionAsync(subRef.Type, subRef.Id);

        var plan = await _context.Plans.Include(p => p.Limits).AsNoTracking().FirstAsync(p => p.Id == sub.PlanId);
        var limit = plan.Limits.FirstOrDefault(l => l.Metric == request.Metric);
        DateTime? periodStart = limit?.Period == QuotaPeriod.Monthly ? sub.CurrentPeriodStart : null;

        var counter = await _context.UsageCounters.FirstOrDefaultAsync(c =>
            c.SubscriberType == subRef.Type && c.SubscriberId == subRef.Id &&
            c.Metric == request.Metric && c.PeriodStart == periodStart);

        if (counter != null)
        {
            counter.Value = Math.Max(0, counter.Value - request.Amount);
            counter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    // ---- Admin ----

    public async Task<List<AdminSubscriptionDto>> AdminListSubscriptionsAsync()
    {
        var subs = await _context.Subscriptions.Include(s => s.Plan).AsNoTracking()
            .OrderByDescending(s => s.CreatedAt).ToListAsync();

        return subs.Select(s => new AdminSubscriptionDto(
            s.Id, s.SubscriberType, s.SubscriberId, s.Plan!.Code, s.Status, s.CurrentPeriodEnd, s.TrialEndsAt)).ToList();
    }

    public async Task<AdminSubscriptionDto> AdminAssignPlanAsync(SubscriberType type, Guid subscriberId, AdminAssignPlanRequest request)
    {
        var sub = await EnsureSubscriptionAsync(type, subscriberId);
        var plan = await GetPlanByCodeAsync(request.PlanCode) ?? throw new PlanNotFoundException(request.PlanCode);

        sub.PlanId = plan.Id;
        sub.Status = SubscriptionStatus.Active;
        sub.CancelAtPeriodEnd = false;
        if (request.ExtendDays.HasValue)
            sub.CurrentPeriodEnd = sub.CurrentPeriodEnd.AddDays(request.ExtendDays.Value);
        sub.UpdatedAt = DateTime.UtcNow;

        LogEvent(type, subscriberId, "AdminPlanAssigned", new { plan.Code, request.ExtendDays });

        await _context.SaveChangesAsync();
        return new AdminSubscriptionDto(sub.Id, sub.SubscriberType, sub.SubscriberId, plan.Code, sub.Status, sub.CurrentPeriodEnd, sub.TrialEndsAt);
    }

    public async Task<List<AdminOrderDto>> AdminListOrdersAsync()
    {
        var orders = await _context.SubscriptionOrders.AsNoTracking().OrderByDescending(o => o.CreatedAt).ToListAsync();
        var planCodes = await _context.Plans.AsNoTracking().ToDictionaryAsync(p => p.Id, p => p.Code);

        return orders.Select(o => new AdminOrderDto(
            o.Id, o.SubscriptionId, planCodes.GetValueOrDefault(o.PlanId, "?"), o.Cycle, o.Amount, o.Currency, o.Status, o.CreatedAt)).ToList();
    }

    public async Task<bool> AdminMarkOrderPaidAsync(Guid orderId)
    {
        var order = await _context.SubscriptionOrders.FindAsync(orderId);
        if (order == null) return false;

        var sub = await _context.Subscriptions.FindAsync(order.SubscriptionId);
        if (sub == null) return false;

        order.Status = OrderStatus.Paid;
        order.PaidAt = DateTime.UtcNow;

        sub.PlanId = order.PlanId;
        sub.Status = SubscriptionStatus.Active;
        sub.CancelAtPeriodEnd = false;
        sub.CurrentPeriodStart = DateTime.UtcNow;
        sub.CurrentPeriodEnd = order.Cycle == BillingCycle.Yearly ? DateTime.UtcNow.AddYears(1) : DateTime.UtcNow.AddMonths(1);
        sub.UpdatedAt = DateTime.UtcNow;

        LogEvent(sub.SubscriberType, sub.SubscriberId, "OrderMarkedPaid", new { OrderId = order.Id });

        await _context.SaveChangesAsync();
        return true;
    }

    // ---- Internals ----

    /// <summary>Loads (or lazily provisions) the subscription for a subscriber, rolling monthly usage
    /// periods forward and expiring a lapsed trial, all in-memory (not yet saved — callers must
    /// SaveChangesAsync). This keeps behaviour correct even if the daily lifecycle worker hasn't run.</summary>
    internal async Task<Subscription> EnsureSubscriptionAsync(SubscriberType type, Guid subscriberId)
    {
        var sub = await _context.Subscriptions.Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.SubscriberType == type && s.SubscriberId == subscriberId);

        if (sub == null)
        {
            var freePlan = await GetPlanByCodeAsync("free") ?? throw new PlanNotFoundException("free");
            sub = new Subscription
            {
                Id = Guid.NewGuid(),
                SubscriberType = type,
                SubscriberId = subscriberId,
                PlanId = freePlan.Id,
                Status = SubscriptionStatus.Active,
                CurrentPeriodStart = DateTime.UtcNow,
                CurrentPeriodEnd = DateTime.UtcNow.AddMonths(1),
                SeatCount = 1,
                CreatedAt = DateTime.UtcNow
            };
            _context.Subscriptions.Add(sub);
            sub.Plan = freePlan;
            LogEvent(type, subscriberId, "SubscriptionProvisioned", new { PlanCode = "free" });
        }

        await FinalizeCancellationIfNeededAsync(sub);
        RollPeriodForward(sub);
        await ExpireTrialIfNeededAsync(sub);

        return sub;
    }

    /// <summary>If the subscriber opted out of renewal and their paid period has elapsed, apply the
    /// cancellation now instead of letting RollPeriodForward silently "renew" it.</summary>
    private async Task FinalizeCancellationIfNeededAsync(Subscription sub)
    {
        if (!sub.CancelAtPeriodEnd || sub.CurrentPeriodEnd > DateTime.UtcNow)
            return;
        if (sub.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Expired)
            return;

        sub.CancelAtPeriodEnd = false;

        if (sub.SubscriberType == SubscriberType.User)
        {
            var freePlan = await GetPlanByCodeAsync("free") ?? throw new PlanNotFoundException("free");
            sub.PlanId = freePlan.Id;
            sub.Plan = freePlan;
            sub.Status = SubscriptionStatus.Active;
            LogEvent(sub.SubscriberType, sub.SubscriberId, "SubscriptionCanceledDowngraded", new { PlanCode = "free" });
        }
        else
        {
            sub.Status = SubscriptionStatus.Canceled;
            LogEvent(sub.SubscriberType, sub.SubscriberId, "SubscriptionCanceled", null);
        }

        sub.UpdatedAt = DateTime.UtcNow;
    }

    private static void RollPeriodForward(Subscription sub)
    {
        var now = DateTime.UtcNow;
        while (sub.CurrentPeriodEnd <= now)
        {
            sub.CurrentPeriodStart = sub.CurrentPeriodEnd;
            sub.CurrentPeriodEnd = sub.CurrentPeriodStart.AddMonths(1);
            sub.UpdatedAt = now;
        }
    }

    private async Task ExpireTrialIfNeededAsync(Subscription sub)
    {
        if (sub.Status != SubscriptionStatus.Trialing || sub.TrialEndsAt == null || sub.TrialEndsAt > DateTime.UtcNow)
            return;

        if (sub.SubscriberType == SubscriberType.User)
        {
            var freePlan = await GetPlanByCodeAsync("free") ?? throw new PlanNotFoundException("free");
            sub.PlanId = freePlan.Id;
            sub.Plan = freePlan;
            sub.Status = SubscriptionStatus.Active;
            LogEvent(sub.SubscriberType, sub.SubscriberId, "TrialExpiredDowngraded", new { PlanCode = "free" });
        }
        else
        {
            sub.Status = SubscriptionStatus.Expired;
            LogEvent(sub.SubscriberType, sub.SubscriberId, "TrialExpired", null);
        }

        sub.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<List<UsageSnapshotDto>> GetUsageSnapshotsAsync(SubscriberType type, Guid subscriberId, Subscription sub, Plan plan)
    {
        var snapshots = new List<UsageSnapshotDto>();
        foreach (var limit in plan.Limits)
        {
            long used = 0;
            if (ConsumableMetrics.Contains(limit.Metric))
            {
                DateTime? periodStart = limit.Period == QuotaPeriod.Monthly ? sub.CurrentPeriodStart : null;
                var counter = await _context.UsageCounters.AsNoTracking().FirstOrDefaultAsync(c =>
                    c.SubscriberType == type && c.SubscriberId == subscriberId &&
                    c.Metric == limit.Metric && c.PeriodStart == periodStart);
                used = counter?.Value ?? 0;
            }
            snapshots.Add(new UsageSnapshotDto(limit.Metric, used, limit.Value, limit.Period));
        }
        return snapshots;
    }

    private async Task<SubscriptionDto> BuildSubscriptionDtoAsync(Subscription sub)
    {
        var plan = sub.Plan ?? await _context.Plans.Include(p => p.Limits).Include(p => p.Features)
            .AsNoTracking().FirstAsync(p => p.Id == sub.PlanId);
        if (plan.Limits.Count == 0)
            plan = await _context.Plans.Include(p => p.Limits).Include(p => p.Features)
                .AsNoTracking().FirstAsync(p => p.Id == sub.PlanId);

        var usage = await GetUsageSnapshotsAsync(sub.SubscriberType, sub.SubscriberId, sub, plan);
        var trialAvailable = sub.TrialUsedAt == null && sub.Status != SubscriptionStatus.Trialing;

        return new SubscriptionDto(
            sub.Id, sub.SubscriberType, sub.SubscriberId, ToPlanDto(plan), sub.Status,
            sub.CurrentPeriodStart, sub.CurrentPeriodEnd, sub.TrialEndsAt, trialAvailable,
            sub.CancelAtPeriodEnd, sub.SeatCount, usage);
    }

    private async Task<Plan?> GetPlanByCodeAsync(string code) =>
        await _context.Plans.Include(p => p.Limits).Include(p => p.Features).FirstOrDefaultAsync(p => p.Code == code);

    private static PlanDto ToPlanDto(Plan plan) => new(
        plan.Id, plan.Code, plan.Name, plan.Description, plan.PriceMonthly, plan.PriceYearly, plan.Currency,
        plan.Tier, plan.TargetSubscriberType, plan.IsPublic,
        plan.Limits.Select(l => new PlanLimitDto(l.Metric, l.Value, l.Period)).ToList(),
        plan.Features.Select(f => new PlanFeatureDto(f.FeatureCode, f.IsEnabled)).ToList());

    private void LogEvent(SubscriberType type, Guid subscriberId, string eventType, object? payload)
    {
        _context.SubscriptionEvents.Add(new SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            SubscriberType = type,
            SubscriberId = subscriberId,
            Type = eventType,
            PayloadJson = payload == null ? null : System.Text.Json.JsonSerializer.Serialize(payload),
            CreatedAt = DateTime.UtcNow
        });
    }
}
