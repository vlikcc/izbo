using System.Text.Json;
using AuthService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Email;
using Shared.Messaging;

namespace AuthService.Services;

public sealed class OutboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessor> _logger;

    public OutboxProcessor(IServiceScopeFactory scopeFactory, ILogger<OutboxProcessor> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DrainAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Outbox drain failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task DrainAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var bus = scope.ServiceProvider.GetRequiredService<RabbitMqMessageBus>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailSender>();

        var pending = await db.OutboxMessages
            .Where(m => m.ProcessedAt == null)
            .OrderBy(m => m.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var message in pending)
        {
            message.AttemptCount++;
            try
            {
                await SendDirectAsync(email, message, cancellationToken);
                if (bus.IsConfigured)
                {
                    _ = await TryPublishAsync(bus, message, cancellationToken);
                }

                message.ProcessedAt = DateTime.UtcNow;
                message.LastError = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message.LastError = ex.Message;
                _logger.LogWarning(ex, "Outbox message {Id} failed", message.Id);
            }
        }

        if (pending.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task<bool> TryPublishAsync(RabbitMqMessageBus bus, OutboxMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await bus.PublishAsync(RabbitMqMessageBus.EmailQueue, message.Payload, cancellationToken);
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    private static async Task SendDirectAsync(IEmailSender email, OutboxMessage message, CancellationToken cancellationToken)
    {
        var parsed = JsonSerializer.Deserialize<EmailMessage>(message.Payload);
        if (parsed is null)
        {
            return;
        }

        await email.SendAsync(parsed, cancellationToken);
    }
}
