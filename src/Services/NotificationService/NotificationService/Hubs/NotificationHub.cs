using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;

namespace NotificationService.Hubs;

/// <summary>
/// Delivers a user's own notifications. The only group a connection ever joins is the one named after
/// the authenticated subject, so there is nothing a client can ask to subscribe to.
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public static string UserGroup(Guid userId) => $"user_{userId}";

    public override async Task OnConnectedAsync()
    {
        if (!Context.User.TryGetCaller(out var caller))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(caller.UserId));
        _logger.LogInformation("User {UserId} connected to NotificationHub", caller.UserId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.User.TryGetCaller(out var caller))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, UserGroup(caller.UserId));
            _logger.LogInformation("User {UserId} disconnected from NotificationHub", caller.UserId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
