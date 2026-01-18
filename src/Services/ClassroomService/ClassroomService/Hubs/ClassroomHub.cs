using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ClassroomService.Hubs;

[Authorize]
public class ClassroomHub : Hub
{
    private readonly ILogger<ClassroomHub> _logger;

    public ClassroomHub(ILogger<ClassroomHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("User {UserId} connected to ClassroomHub", userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("User {UserId} disconnected from ClassroomHub", userId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinClassroom(string classroomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"classroom_{classroomId}");
        _logger.LogInformation("Connection {ConnectionId} joined classroom {ClassroomId}", Context.ConnectionId, classroomId);
    }

    public async Task LeaveClassroom(string classroomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"classroom_{classroomId}");
        _logger.LogInformation("Connection {ConnectionId} left classroom {ClassroomId}", Context.ConnectionId, classroomId);
    }

    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = Context.User?.FindFirstValue("firstName") + " " + Context.User?.FindFirstValue("lastName");
        
        // Notify others that someone joined
        await Clients.Group($"session_{sessionId}").SendAsync("ParticipantJoined", new
        {
            userId,
            userName,
            joinedAt = DateTime.UtcNow
        });

        _logger.LogInformation("User {UserId} joined session {SessionId}", userId, sessionId);
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        
        await Clients.Group($"session_{sessionId}").SendAsync("ParticipantLeft", new
        {
            userId,
            leftAt = DateTime.UtcNow
        });

        _logger.LogInformation("User {UserId} left session {SessionId}", userId, sessionId);
    }

    // Chat within session
    public async Task SendMessage(string sessionId, string message)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = Context.User?.FindFirstValue("firstName") + " " + Context.User?.FindFirstValue("lastName");

        await Clients.Group($"session_{sessionId}").SendAsync("ReceiveMessage", new
        {
            userId,
            userName,
            message,
            sentAt = DateTime.UtcNow
        });
    }

    // Hand raising
    public async Task RaiseHand(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = Context.User?.FindFirstValue("firstName") + " " + Context.User?.FindFirstValue("lastName");

        await Clients.Group($"session_{sessionId}").SendAsync("HandRaised", new
        {
            userId,
            userName,
            raisedAt = DateTime.UtcNow
        });
    }

    public async Task LowerHand(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"session_{sessionId}").SendAsync("HandLowered", new { userId });
    }
}
