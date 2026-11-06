namespace ContentService.Services.Assessments;

/// <summary>
/// Once a minute: closes attempts whose time ran out (students who closed the tab never submit) and ranks
/// mock exams whose window has closed. Reads also close overdue attempts on the spot, so this only keeps
/// unattended rows and rankings moving.
/// </summary>
public class AttemptMaintenanceWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AttemptMaintenanceWorker> _logger;

    public AttemptMaintenanceWorker(IServiceScopeFactory scopeFactory, ILogger<AttemptMaintenanceWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let startup and migrations finish first.
        try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); } catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var attempts = scope.ServiceProvider.GetRequiredService<IAttemptService>();
                await attempts.RankClosedAssessmentsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Attempt maintenance failed");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (TaskCanceledException) { }
        }
    }
}
