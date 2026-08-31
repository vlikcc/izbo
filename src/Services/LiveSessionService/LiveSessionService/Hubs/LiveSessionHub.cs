using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;

namespace LiveSessionService.Hubs;

/// <summary>
/// WebRTC signalling and in-room chat for live sessions.
///
/// The hub owns no data: a session's membership is its classroom's membership, which ClassroomService
/// resolves. Every method therefore operates only on sessions the connection has successfully joined,
/// and joining requires classroom access. Without that check, knowing a session id would be enough to
/// receive another classroom's audio, video and chat.
/// </summary>
[Authorize]
public class LiveSessionHub : Hub
{
    private const string AuthorizationHeaderItemKey = "authorization-header";

    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ISessionRegistry _participants;
    private readonly ILogger<LiveSessionHub> _logger;

    public LiveSessionHub(
        IClassroomAccessClient classroomAccess,
        ISessionRegistry participants,
        ILogger<LiveSessionHub> logger)
    {
        _classroomAccess = classroomAccess;
        _participants = participants;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (!Context.User.TryGetCaller(out var caller))
        {
            Context.Abort();
            return;
        }

        // Hub method invocations have no ambient HTTP request, so the token has to be captured now from
        // the handshake in order to authorize classroom lookups later in the connection's life.
        Context.Items[AuthorizationHeaderItemKey] = BearerToken.FromRequest(Context.GetHttpContext()?.Request);

        _logger.LogInformation("User {UserId} connected to LiveSessionHub", caller.UserId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var sessionId in _participants.RemoveConnection(Context.ConnectionId))
        {
            await Clients.Group(sessionId).SendAsync("UserLeft", new
            {
                userId = CallerOrNull()?.UserId,
                connectionId = Context.ConnectionId,
                participantCount = _participants.CountFor(sessionId)
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinSession(string sessionId)
    {
        var caller = Caller();

        if (!Guid.TryParse(sessionId, out var sessionGuid))
        {
            throw new HubException("The session id is not valid.");
        }

        var access = await _classroomAccess.GetSessionAccessAsync(sessionGuid, caller, AuthorizationHeader());
        if (!access.CanView)
        {
            _logger.LogWarning(
                "User {UserId} was refused entry to session {SessionId}: no access to its classroom",
                caller.UserId, sessionGuid);
            throw new HubException("You do not have access to this session.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        _participants.Add(sessionId, Context.ConnectionId, caller.UserId, access.IsInstructor);

        await Clients.Group(sessionId).SendAsync("UserJoined", new
        {
            userId = caller.UserId,
            userName = DisplayName(),
            connectionId = Context.ConnectionId,
            participantCount = _participants.CountFor(sessionId)
        });

        _logger.LogInformation("User {UserId} joined session {SessionId}", caller.UserId, sessionGuid);
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
        _participants.Remove(sessionId, Context.ConnectionId);

        await Clients.Group(sessionId).SendAsync("UserLeft", new
        {
            userId = Caller().UserId,
            connectionId = Context.ConnectionId,
            participantCount = _participants.CountFor(sessionId)
        });
    }

    // WebRTC signalling. The target connection must be in the same session, otherwise a caller could
    // negotiate a peer connection with a participant of an unrelated session.
    public Task SendOffer(string sessionId, string targetConnectionId, object offer)
    {
        RequireSharedSession(sessionId, targetConnectionId);

        return Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", new
        {
            fromConnectionId = Context.ConnectionId,
            offer
        });
    }

    public Task SendAnswer(string sessionId, string targetConnectionId, object answer)
    {
        RequireSharedSession(sessionId, targetConnectionId);

        return Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", new
        {
            fromConnectionId = Context.ConnectionId,
            answer
        });
    }

    public Task SendIceCandidate(string sessionId, string targetConnectionId, object candidate)
    {
        RequireSharedSession(sessionId, targetConnectionId);

        return Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new
        {
            fromConnectionId = Context.ConnectionId,
            candidate
        });
    }

    public Task SendMessage(string sessionId, string message)
    {
        RequireJoined(sessionId);

        return Clients.Group(sessionId).SendAsync("ReceiveMessage", new
        {
            userId = Caller().UserId,
            userName = DisplayName(),
            message,
            timestamp = DateTime.UtcNow
        });
    }

    public Task StartScreenShare(string sessionId)
    {
        RequireJoined(sessionId);
        return Clients.Group(sessionId).SendAsync("ScreenShareStarted", new { userId = Caller().UserId });
    }

    public Task StopScreenShare(string sessionId)
    {
        RequireJoined(sessionId);
        return Clients.Group(sessionId).SendAsync("ScreenShareStopped", new { userId = Caller().UserId });
    }

    public Task RaiseHand(string sessionId)
    {
        RequireJoined(sessionId);

        return Clients.Group(sessionId).SendAsync("HandRaised", new
        {
            userId = Caller().UserId,
            userName = DisplayName(),
            timestamp = DateTime.UtcNow
        });
    }

    public Task LowerHand(string sessionId)
    {
        RequireJoined(sessionId);
        return Clients.Group(sessionId).SendAsync("HandLowered", new { userId = Caller().UserId });
    }

    public Task ToggleMute(string sessionId, bool isMuted)
    {
        RequireJoined(sessionId);
        return Clients.Group(sessionId).SendAsync("UserMuteChanged", new { userId = Caller().UserId, isMuted });
    }

    public Task ToggleVideo(string sessionId, bool isVideoOff)
    {
        RequireJoined(sessionId);
        return Clients.Group(sessionId).SendAsync("UserVideoChanged", new { userId = Caller().UserId, isVideoOff });
    }

    public Task MuteParticipant(string sessionId, string targetUserId)
    {
        RequireModerator(sessionId);
        return Clients.Group(sessionId).SendAsync("ParticipantMuted", new { targetUserId });
    }

    public async Task RemoveParticipant(string sessionId, string targetUserId)
    {
        RequireModerator(sessionId);

        await Clients.Group(sessionId).SendAsync("ParticipantRemoved", new { targetUserId });

        // Announcing the removal is not enough on its own; the connection has to lose the group so a
        // client that ignores the message stops receiving the stream.
        if (Guid.TryParse(targetUserId, out var removedUserId))
        {
            foreach (var connectionId in _participants.ConnectionsOf(sessionId, removedUserId))
            {
                await Groups.RemoveFromGroupAsync(connectionId, sessionId);
                _participants.Remove(sessionId, connectionId);
            }
        }
    }

    public int GetParticipantCount(string sessionId)
    {
        RequireJoined(sessionId);
        return _participants.CountFor(sessionId);
    }

    private Caller Caller() => Context.User.TryGetCaller(out var caller)
        ? caller
        : throw new HubException("The connection is not authenticated.");

    private Caller? CallerOrNull() => Context.User.TryGetCaller(out var caller) ? caller : null;

    private string? AuthorizationHeader() => Context.Items[AuthorizationHeaderItemKey] as string;

    private string DisplayName()
    {
        var parts = new[] { Context.User?.FindFirst("firstName")?.Value, Context.User?.FindFirst("lastName")?.Value };
        var name = string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return string.IsNullOrWhiteSpace(name) ? "User" : name;
    }

    /// <summary>
    /// Guards every session-scoped method: authorization was established once at join time, and holding
    /// group membership is the proof of it.
    /// </summary>
    private void RequireJoined(string sessionId)
    {
        if (!_participants.Contains(sessionId, Context.ConnectionId))
        {
            throw new HubException("Join the session first.");
        }
    }

    private void RequireModerator(string sessionId)
    {
        RequireJoined(sessionId);

        if (!_participants.IsModerator(sessionId, Context.ConnectionId))
        {
            _logger.LogWarning(
                "User {UserId} attempted a moderator action in session {SessionId}", Caller().UserId, sessionId);
            throw new HubException("Only the session's instructor can do that.");
        }
    }

    private void RequireSharedSession(string sessionId, string targetConnectionId)
    {
        RequireJoined(sessionId);

        if (!_participants.Contains(sessionId, targetConnectionId))
        {
            throw new HubException("The requested peer is not in this session.");
        }
    }
}
