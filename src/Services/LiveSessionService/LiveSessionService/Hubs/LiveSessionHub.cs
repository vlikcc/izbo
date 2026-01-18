using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace LiveSessionService.Hubs;

[Authorize]
public class LiveSessionHub : Hub
{
    private static readonly Dictionary<string, HashSet<string>> _sessionParticipants = new();
    private static readonly Dictionary<string, string> _userConnections = new();
    private readonly ILogger<LiveSessionHub> _logger;

    public LiveSessionHub(ILogger<LiveSessionHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId != null)
        {
            _userConnections[Context.ConnectionId] = userId;
        }
        _logger.LogInformation("User {UserId} connected to LiveSessionHub", userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = _userConnections.GetValueOrDefault(Context.ConnectionId);
        _userConnections.Remove(Context.ConnectionId);
        
        // Remove from all sessions
        foreach (var session in _sessionParticipants.Values)
        {
            session.Remove(Context.ConnectionId);
        }
        
        _logger.LogInformation("User {UserId} disconnected from LiveSessionHub", userId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        
        if (!_sessionParticipants.ContainsKey(sessionId))
            _sessionParticipants[sessionId] = new HashSet<string>();
        
        _sessionParticipants[sessionId].Add(Context.ConnectionId);
        
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = $"{Context.User?.FindFirstValue("firstName")} {Context.User?.FindFirstValue("lastName")}";
        
        await Clients.Group(sessionId).SendAsync("UserJoined", new
        {
            userId,
            userName,
            connectionId = Context.ConnectionId,
            participantCount = _sessionParticipants[sessionId].Count
        });

        _logger.LogInformation("User {UserId} joined session {SessionId}", userId, sessionId);
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
        
        _sessionParticipants.GetValueOrDefault(sessionId)?.Remove(Context.ConnectionId);
        
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        
        await Clients.Group(sessionId).SendAsync("UserLeft", new
        {
            userId,
            connectionId = Context.ConnectionId,
            participantCount = _sessionParticipants.GetValueOrDefault(sessionId)?.Count ?? 0
        });

        _logger.LogInformation("User {UserId} left session {SessionId}", userId, sessionId);
    }

    // WebRTC Signaling
    public async Task SendOffer(string sessionId, string targetConnectionId, object offer)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", new
        {
            fromConnectionId = Context.ConnectionId,
            offer
        });
    }

    public async Task SendAnswer(string sessionId, string targetConnectionId, object answer)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", new
        {
            fromConnectionId = Context.ConnectionId,
            answer
        });
    }

    public async Task SendIceCandidate(string sessionId, string targetConnectionId, object candidate)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new
        {
            fromConnectionId = Context.ConnectionId,
            candidate
        });
    }

    // Chat
    public async Task SendMessage(string sessionId, string message)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = $"{Context.User?.FindFirstValue("firstName")} {Context.User?.FindFirstValue("lastName")}";

        await Clients.Group(sessionId).SendAsync("ReceiveMessage", new
        {
            userId,
            userName,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    // Screen sharing
    public async Task StartScreenShare(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(sessionId).SendAsync("ScreenShareStarted", new { userId });
    }

    public async Task StopScreenShare(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(sessionId).SendAsync("ScreenShareStopped", new { userId });
    }

    // Hand raising
    public async Task RaiseHand(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var userName = $"{Context.User?.FindFirstValue("firstName")} {Context.User?.FindFirstValue("lastName")}";

        await Clients.Group(sessionId).SendAsync("HandRaised", new
        {
            userId,
            userName,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task LowerHand(string sessionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(sessionId).SendAsync("HandLowered", new { userId });
    }

    // Mute controls
    public async Task ToggleMute(string sessionId, bool isMuted)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(sessionId).SendAsync("UserMuteChanged", new { userId, isMuted });
    }

    public async Task ToggleVideo(string sessionId, bool isVideoOff)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group(sessionId).SendAsync("UserVideoChanged", new { userId, isVideoOff });
    }

    // Instructor controls
    public async Task MuteParticipant(string sessionId, string targetUserId)
    {
        await Clients.Group(sessionId).SendAsync("ParticipantMuted", new { targetUserId });
    }

    public async Task RemoveParticipant(string sessionId, string targetUserId)
    {
        await Clients.Group(sessionId).SendAsync("ParticipantRemoved", new { targetUserId });
    }

    public int GetParticipantCount(string sessionId)
    {
        return _sessionParticipants.GetValueOrDefault(sessionId)?.Count ?? 0;
    }
}
