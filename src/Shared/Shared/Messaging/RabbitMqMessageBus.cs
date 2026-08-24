using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace Shared.Messaging;

public interface IMessageBus
{
    Task PublishAsync(string routingKey, string payload, CancellationToken cancellationToken = default);
}

public sealed class RabbitMqMessageBus : IMessageBus, IAsyncDisposable
{
    public const string EmailQueue = "eduplatform.email";

    private readonly IConfiguration _configuration;
    private readonly ILogger<RabbitMqMessageBus> _logger;
    private IConnection? _connection;
    private IChannel? _channel;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public RabbitMqMessageBus(IConfiguration configuration, ILogger<RabbitMqMessageBus> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task PublishAsync(string routingKey, string payload, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(routingKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(payload);

        var channel = await EnsureChannelAsync(cancellationToken);
        if (channel is null)
        {
            throw new InvalidOperationException("RabbitMQ is not configured.");
        }

        var body = Encoding.UTF8.GetBytes(payload);
        await channel.BasicPublishAsync(
            exchange: string.Empty,
            routingKey: routingKey,
            mandatory: false,
            body: body,
            cancellationToken: cancellationToken);
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_configuration.GetConnectionString("RabbitMQ"));

    private async Task<IChannel?> EnsureChannelAsync(CancellationToken cancellationToken)
    {
        var connectionString = _configuration.GetConnectionString("RabbitMQ");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_channel is { IsOpen: true })
            {
                return _channel;
            }

            var factory = new ConnectionFactory
            {
                Uri = new Uri(connectionString)
            };
            _connection = await factory.CreateConnectionAsync(cancellationToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: cancellationToken);
            await _channel.QueueDeclareAsync(
                EmailQueue,
                durable: true,
                exclusive: false,
                autoDelete: false,
                cancellationToken: cancellationToken);
            return _channel;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "RabbitMQ connection failed");
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.CloseAsync();
            await _channel.DisposeAsync();
        }

        if (_connection is not null)
        {
            await _connection.CloseAsync();
            await _connection.DisposeAsync();
        }

        _gate.Dispose();
    }
}
