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

    // Whiteboard — only the instructor draws, everyone else views. Diffs are tldraw store
    // changes (added/updated/removed records) forwarded as-is; late joiners get a full
    // snapshot pushed directly to them by the instructor's client (see SendWhiteboardSnapshot).
    public async Task SendWhiteboardDiff(string sessionId, string diffJson)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Instructor" or "Admin" or "SuperAdmin"))
            return;

        await Clients.OthersInGroup($"session_{sessionId}").SendAsync("WhiteboardDiff", diffJson);
    }

    public async Task SendWhiteboardSnapshot(string sessionId, string toUserId, string snapshotJson)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Instructor" or "Admin" or "SuperAdmin"))
            return;

        await Clients.User(toUserId).SendAsync("WhiteboardSnapshot", snapshotJson);
    }

    // Live-quiz bridge — the quiz itself (questions, answers, scoring) runs entirely over
    // ExamHub/liveQuizHub in ExamService; this just tells everyone already in the room that a
    // quiz has started so students can auto-join with the code instead of typing it in.
    public async Task NotifyQuizStarted(string sessionId, string examId, string quizCode)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Instructor" or "Admin" or "SuperAdmin"))
            return;

        await Clients.Group($"session_{sessionId}").SendAsync("QuizStarted", new { examId, quizCode });
    }

    // Catches up a student who joins the room after the quiz already started (the group
    // broadcast above only reaches whoever was connected at that moment).
    public async Task NotifyQuizStartedTo(string toUserId, string examId, string quizCode)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Instructor" or "Admin" or "SuperAdmin"))
            return;

        await Clients.User(toUserId).SendAsync("QuizStarted", new { examId, quizCode });
    }

    public async Task NotifyQuizEnded(string sessionId)
    {
        var role = Context.User?.FindFirstValue(ClaimTypes.Role);
        if (role is not ("Instructor" or "Admin" or "SuperAdmin"))
            return;

        await Clients.Group($"session_{sessionId}").SendAsync("QuizEnded");
    }

    // WebRTC Signaling
    public async Task SendOffer(string sessionId, string toUserId, string offer)
    {
        var fromUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var fromUserName = Context.User?.FindFirstValue("firstName") + " " + Context.User?.FindFirstValue("lastName");
        
        await Clients.User(toUserId).SendAsync("ReceiveOffer", new { fromUserId, fromUserName, offer });
    }

    public async Task SendAnswer(string sessionId, string toUserId, string answer)
    {
        var fromUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var fromUserName = Context.User?.FindFirstValue("firstName") + " " + Context.User?.FindFirstValue("lastName");

        await Clients.User(toUserId).SendAsync("ReceiveAnswer", new { fromUserId, fromUserName, answer });
    }

    public async Task SendIceCandidate(string sessionId, string toUserId, string candidate)
    {
        var fromUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.User(toUserId).SendAsync("ReceiveIceCandidate", new { fromUserId, candidate });
    }
}
