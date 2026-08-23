using LiveSessionService.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;
using Shared.DTOs;

namespace LiveSessionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserRoles.ContentManagers)]
public class LiveController : ControllerBase
{
    private readonly IHubContext<LiveSessionHub> _hubContext;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<LiveController> _logger;

    public LiveController(
        IHubContext<LiveSessionHub> hubContext,
        IClassroomAccessClient classroomAccess,
        ILogger<LiveController> logger)
    {
        _hubContext = hubContext;
        _classroomAccess = classroomAccess;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost("sessions/{sessionId}/notify")]
    public async Task<ActionResult<ApiResponse<bool>>> NotifySessionStart(
        Guid sessionId,
        [FromBody] NotifySessionRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        // The classroom is taken from the request body, so it has to be checked independently of the
        // session: otherwise an instructor could push a notification into someone else's classroom.
        if (!await _classroomAccess.CanManageAsync(request.ClassroomId, Caller, cancellationToken))
        {
            return Forbidden();
        }

        await _hubContext.Clients.Group($"classroom_{request.ClassroomId}")
            .SendAsync("SessionStarting", new
            {
                sessionId,
                title = request.Title,
                startsIn = request.StartsInMinutes
            }, cancellationToken);

        return Ok(new ApiResponse<bool>(true, true, "Notification sent"));
    }

    [HttpPost("sessions/{sessionId}/end")]
    public async Task<ActionResult<ApiResponse<bool>>> EndSession(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!await OwnsSessionAsync(sessionId, cancellationToken))
        {
            return Forbidden();
        }

        await _hubContext.Clients.Group(sessionId.ToString())
            .SendAsync("SessionEnded", new { sessionId }, cancellationToken);

        return Ok(new ApiResponse<bool>(true, true, "Session ended"));
    }

    [HttpPost("sessions/{sessionId}/broadcast")]
    public async Task<ActionResult<ApiResponse<bool>>> BroadcastMessage(
        Guid sessionId,
        [FromBody] BroadcastRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await OwnsSessionAsync(sessionId, cancellationToken))
        {
            return Forbidden();
        }

        await _hubContext.Clients.Group(sessionId.ToString())
            .SendAsync("BroadcastMessage", new
            {
                message = request.Message,
                type = request.Type,
                timestamp = DateTime.UtcNow
            }, cancellationToken);

        return Ok(new ApiResponse<bool>(true, true, "Message broadcast"));
    }

    private async Task<bool> OwnsSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var access = await _classroomAccess.GetSessionAccessAsync(
            sessionId, Caller, authorizationHeader: null, cancellationToken);

        if (!access.IsInstructor)
        {
            _logger.LogWarning(
                "User {UserId} attempted to control session {SessionId} they do not teach", Caller.UserId, sessionId);
            return false;
        }

        return true;
    }

    private ObjectResult Forbidden() =>
        StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<bool>(false, false, "You do not manage this session"));
}

public record NotifySessionRequest(Guid ClassroomId, string Title, int StartsInMinutes);

public record BroadcastRequest(string Message, string Type);
