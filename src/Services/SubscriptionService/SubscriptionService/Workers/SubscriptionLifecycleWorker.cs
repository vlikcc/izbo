using Microsoft.EntityFrameworkCore;
using SubscriptionService.Data;
using SubscriptionService.Services;

namespace SubscriptionService.Workers;

/// <summary>Daily sweep that rolls monthly usage periods forward, expires lapsed trials, and finalizes
/// cancellations for every subscription. Purely a safety net — the same logic runs inline on every
/// GetMySubscription/GetEntitlements/ConsumeUsage call, so a missed or delayed sweep never produces
/// stale entitlements for an active user, only for subscribers who never come back.</summary>
public class SubscriptionLifecycleWorker : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionLifecycleWorker> _logger;

    public SubscriptionLifecycleWorker(IServiceScopeFactory scopeFactory, ILogger<SubscriptionLifecycleWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small startup delay so this doesn't compete with app boot/migrations.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunSweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Subscription lifecycle sweep failed");
            }

            try { await Task.Delay(SweepInterval, stoppingToken); } catch (TaskCanceledException) { }
        }
    }

    private async Task RunSweepAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SubscriptionDbContext>();
        var managementService = scope.ServiceProvider.GetRequiredService<SubscriptionManagementService>();

        var subscribers = await context.Subscriptions
            .Select(s => new { s.SubscriberType, s.SubscriberId })
            .ToListAsync(ct);

        foreach (var subscriber in subscribers)
        {
            await managementService.EnsureSubscriptionAsync(subscriber.SubscriberType, subscriber.SubscriberId);
        }

        var changes = await context.SaveChangesAsync(ct);
        _logger.LogInformation(
            "Subscription lifecycle sweep processed {Count} subscribers, {Changes} rows updated.",
            subscribers.Count, changes);
    }
}
