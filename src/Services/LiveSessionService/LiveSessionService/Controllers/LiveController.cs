using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using LiveSessionService.Hubs;
using Shared.DTOs;

namespace LiveSessionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LiveController : ControllerBase
{
    private readonly IHubContext<LiveSessionHub> _hubContext;
    private readonly ILogger<LiveController> _logger;

    public LiveController(IHubContext<LiveSessionHub> hubContext, ILogger<LiveController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("sessions/{sessionId}/notify")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> NotifySessionStart(string sessionId, [FromBody] NotifySessionRequest request)
    {
        await _hubContext.Clients.Group($"classroom_{request.ClassroomId}")
            .SendAsync("SessionStarting", new
            {
                sessionId,
                title = request.Title,
                startsIn = request.StartsInMinutes
            });

        return Ok(new ApiResponse<bool>(true, true, "Notification sent"));
    }

    [HttpPost("sessions/{sessionId}/end")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> EndSession(string sessionId)
    {
        await _hubContext.Clients.Group(sessionId)
            .SendAsync("SessionEnded", new { sessionId });

        return Ok(new ApiResponse<bool>(true, true, "Session ended"));
    }

    [HttpPost("sessions/{sessionId}/broadcast")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> BroadcastMessage(string sessionId, [FromBody] BroadcastRequest request)
    {
        await _hubContext.Clients.Group(sessionId)
            .SendAsync("BroadcastMessage", new
            {
                message = request.Message,
                type = request.Type,
                timestamp = DateTime.UtcNow
            });

        return Ok(new ApiResponse<bool>(true, true, "Message broadcast"));
    }
}

public record NotifySessionRequest(Guid ClassroomId, string Title, int StartsInMinutes);
public record BroadcastRequest(string Message, string Type);
