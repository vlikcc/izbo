using ClassroomService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;

namespace ClassroomService.Hubs;

/// <summary>
/// Real-time classroom and live-session events.
///
/// Group names are derived from ids the client supplies, so joining is gated on the same enrollment
/// rules the REST endpoints enforce. Every other method requires the connection to already hold the
/// group, which is the record that it passed that check.
/// </summary>
[Authorize]
public class ClassroomHub : Hub
{
    private const string JoinedGroupsItemKey = "joined-groups";

    private readonly IClassroomManagementService _classroomService;
    private readonly ISessionService _sessionService;
    private readonly ILogger<ClassroomHub> _logger;

    public ClassroomHub(
        IClassroomManagementService classroomService,
        ISessionService sessionService,
        ILogger<ClassroomHub> logger)
    {
        _classroomService = classroomService;
        _sessionService = sessionService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (!Context.User.TryGetCaller(out var caller))
        {
            Context.Abort();
            return;
        }

        _logger.LogInformation("User {UserId} connected to ClassroomHub", caller.UserId);
        await base.OnConnectedAsync();
    }

    public async Task JoinClassroom(string classroomId)
    {
        var caller = Caller();
        var classroomGuid = ParseId(classroomId);

        var access = await _classroomService.GetAccessAsync(classroomGuid, caller);
        if (access?.CanView != true)
        {
            _logger.LogWarning(
                "User {UserId} was refused the event stream of classroom {ClassroomId}", caller.UserId, classroomGuid);
            throw new HubException("You do not have access to this classroom.");
        }

        await AddToGroupAsync(ClassroomGroup(classroomId));
    }

    public Task LeaveClassroom(string classroomId) => RemoveFromGroupAsync(ClassroomGroup(classroomId));

    public async Task JoinSession(string sessionId)
    {
        var caller = Caller();
        var sessionGuid = ParseId(sessionId);

        var access = await _sessionService.GetSessionAccessAsync(sessionGuid, caller);
        if (access?.CanView != true)
        {
            _logger.LogWarning(
                "User {UserId} was refused entry to session {SessionId}", caller.UserId, sessionGuid);
            throw new HubException("You do not have access to this session.");
        }

        var group = SessionGroup(sessionId);
        await AddToGroupAsync(group);

        await Clients.Group(group).SendAsync("ParticipantJoined", new
        {
            userId = caller.UserId,
            userName = DisplayName(),
            joinedAt = DateTime.UtcNow
        });

        _logger.LogInformation("User {UserId} joined session {SessionId}", caller.UserId, sessionGuid);
    }

    public async Task LeaveSession(string sessionId)
    {
        var group = SessionGroup(sessionId);
        await RemoveFromGroupAsync(group);

        await Clients.Group(group).SendAsync("ParticipantLeft", new
        {
            userId = Caller().UserId,
            leftAt = DateTime.UtcNow
        });
    }

    public Task SendMessage(string sessionId, string message)
    {
        var group = RequireJoinedSession(sessionId);

        return Clients.Group(group).SendAsync("ReceiveMessage", new
        {
            userId = Caller().UserId,
            userName = DisplayName(),
            message,
            sentAt = DateTime.UtcNow
        });
    }

    public Task RaiseHand(string sessionId)
    {
        var group = RequireJoinedSession(sessionId);

        return Clients.Group(group).SendAsync("HandRaised", new
        {
            userId = Caller().UserId,
            userName = DisplayName(),
            raisedAt = DateTime.UtcNow
        });
    }

    public Task LowerHand(string sessionId)
    {
        var group = RequireJoinedSession(sessionId);
        return Clients.Group(group).SendAsync("HandLowered", new { userId = Caller().UserId });
    }

    // WebRTC signalling. Messages are addressed to a user rather than a connection, so the only
    // guarantee available here is that the sender is a member of the session it names.
    public Task SendOffer(string sessionId, string toUserId, string offer)
    {
        RequireJoinedSession(sessionId);

        return Clients.User(toUserId).SendAsync("ReceiveOffer", new
        {
            fromUserId = Caller().UserId,
            fromUserName = DisplayName(),
            offer
        });
    }

    public Task SendAnswer(string sessionId, string toUserId, string answer)
    {
        RequireJoinedSession(sessionId);

        return Clients.User(toUserId).SendAsync("ReceiveAnswer", new
        {
            fromUserId = Caller().UserId,
            fromUserName = DisplayName(),
            answer
        });
    }

    public Task SendIceCandidate(string sessionId, string toUserId, string candidate)
    {
        RequireJoinedSession(sessionId);

        return Clients.User(toUserId).SendAsync("ReceiveIceCandidate", new
        {
            fromUserId = Caller().UserId,
            candidate
        });
    }

    private static string ClassroomGroup(string classroomId) => $"classroom_{classroomId}";

    private static string SessionGroup(string sessionId) => $"session_{sessionId}";

    private static Guid ParseId(string value) =>
        Guid.TryParse(value, out var id) ? id : throw new HubException("The supplied id is not valid.");

    private Caller Caller() => Context.User.TryGetCaller(out var caller)
        ? caller
        : throw new HubException("The connection is not authenticated.");

    private string DisplayName()
    {
        var parts = new[] { Context.User?.FindFirst("firstName")?.Value, Context.User?.FindFirst("lastName")?.Value };
        var name = string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return string.IsNullOrWhiteSpace(name) ? "User" : name;
    }

    /// <summary>
    /// The groups this connection has been admitted to. SignalR does not expose group membership, so it
    /// is tracked alongside the connection; invocations for one connection do not run concurrently.
    /// </summary>
    private HashSet<string> JoinedGroups
    {
        get
        {
            if (Context.Items[JoinedGroupsItemKey] is not HashSet<string> groups)
            {
                groups = new HashSet<string>(StringComparer.Ordinal);
                Context.Items[JoinedGroupsItemKey] = groups;
            }

            return groups;
        }
    }

    private async Task AddToGroupAsync(string group)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        JoinedGroups.Add(group);
    }

    private async Task RemoveFromGroupAsync(string group)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
        JoinedGroups.Remove(group);
    }

    private string RequireJoinedSession(string sessionId)
    {
        var group = SessionGroup(sessionId);

        if (!JoinedGroups.Contains(group))
        {
            throw new HubException("Join the session first.");
        }

        return group;
    }
}
