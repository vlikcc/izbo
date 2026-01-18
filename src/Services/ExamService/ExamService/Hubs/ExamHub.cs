using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ExamService.Hubs;

[Authorize]
public class ExamHub : Hub
{
    private readonly ILogger<ExamHub> _logger;

    public ExamHub(ILogger<ExamHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("User {UserId} connected to ExamHub", userId);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("User {UserId} disconnected from ExamHub", userId);
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinExam(string examId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"exam_{examId}");
        _logger.LogInformation("Connection {ConnectionId} joined exam {ExamId}", Context.ConnectionId, examId);
    }

    public async Task LeaveExam(string examId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"exam_{examId}");
        _logger.LogInformation("Connection {ConnectionId} left exam {ExamId}", Context.ConnectionId, examId);
    }

    // Called when a student saves an answer (for real-time sync across devices)
    public async Task AnswerSaved(string sessionId, string questionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user_{userId}").SendAsync("AnswerSynced", new { sessionId, questionId });
    }

    // Heartbeat to track active connections
    public async Task Heartbeat(string sessionId)
    {
        await Clients.Caller.SendAsync("HeartbeatAck", DateTime.UtcNow);
    }
}
