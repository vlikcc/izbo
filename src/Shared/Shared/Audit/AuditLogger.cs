using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Shared.Models;

namespace Shared.Audit;

public sealed record AuditRecord(
    string Action,
    Guid? ActorId,
    string EntityType,
    string? EntityId = null,
    string? Detail = null,
    string? IpAddress = null);

public interface IAuditStore
{
    Task SaveAsync(AuditRecord record, CancellationToken cancellationToken = default);
}

public interface IAuditLogger
{
    Task WriteAsync(AuditRecord record, CancellationToken cancellationToken = default);
}

public sealed class AuditLogger : IAuditLogger
{
    private readonly ILogger<AuditLogger> _logger;
    private readonly IAuditStore? _store;

    public AuditLogger(ILogger<AuditLogger> logger, IAuditStore? store = null)
    {
        _logger = logger;
        _store = store;
    }

    public async Task WriteAsync(AuditRecord record, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(record);

        _logger.LogInformation(
            "Audit {Action} actor={ActorId} entity={EntityType}/{EntityId} {Detail}",
            record.Action,
            record.ActorId,
            record.EntityType,
            record.EntityId,
            record.Detail);

        if (_store is not null)
        {
            await _store.SaveAsync(record, cancellationToken);
        }
    }
}

public sealed class EfAuditStore<TContext> : IAuditStore
    where TContext : Microsoft.EntityFrameworkCore.DbContext, IAuditDbContext
{
    private readonly TContext _context;

    public EfAuditStore(TContext context)
    {
        _context = context;
    }

    public async Task SaveAsync(AuditRecord record, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(record);

        _context.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            OccurredAt = DateTime.UtcNow,
            ActorId = record.ActorId,
            Action = record.Action,
            EntityType = record.EntityType,
            EntityId = record.EntityId,
            Detail = record.Detail,
            IpAddress = record.IpAddress
        });

        await _context.SaveChangesAsync(cancellationToken);
    }
}

public interface IAuditDbContext
{
    Microsoft.EntityFrameworkCore.DbSet<AuditEvent> AuditEvents { get; }
}

public static class AuditServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="IAuditLogger"/>. An <see cref="IAuditStore"/> is used when one is present
    /// in the container; otherwise events are written only to the application log.
    /// </summary>
    public static IServiceCollection AddEduPlatformAuditLogger(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddScoped<IAuditLogger>(sp =>
            new AuditLogger(
                sp.GetRequiredService<ILogger<AuditLogger>>(),
                sp.GetService<IAuditStore>()));
        return services;
    }

    public static IServiceCollection AddEduPlatformAudit<TContext>(this IServiceCollection services)
        where TContext : Microsoft.EntityFrameworkCore.DbContext, IAuditDbContext
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddScoped<IAuditStore, EfAuditStore<TContext>>();
        services.AddEduPlatformAuditLogger();
        return services;
    }
}
