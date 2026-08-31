using LiveSessionService.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Subscription;
using System.Collections.Concurrent;

namespace LiveSessionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserRoles.ContentManagers)]
public class LiveController : ControllerBase
{
    // LiveSessionService has no database (pure SignalR signaling) — this in-memory map of
    // sessionId -> started-at is enough to bill elapsed minutes on EndSession without adding one.
    private static readonly ConcurrentDictionary<string, DateTime> _sessionStartTimes = new();
    private const int ReservedMinutesAtStart = 1;

    private readonly IHubContext<LiveSessionHub> _hubContext;
    private readonly IQuotaGuard _quotaGuard;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<LiveController> _logger;

    public LiveController(
        IHubContext<LiveSessionHub> hubContext,
        IQuotaGuard quotaGuard,
        IClassroomAccessClient classroomAccess,
        ILogger<LiveController> logger)
    {
        _hubContext = hubContext;
        _quotaGuard = quotaGuard;
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

        // A reminder sent minutes ahead of the actual start (StartsInMinutes > 0) doesn't consume
        // quota yet; only treat this as the session actually beginning when it fires at start time.
        if (request.StartsInMinutes <= 0)
        {
            await _quotaGuard.EnsureFeatureAsync("live_class", cancellationToken);
            await _quotaGuard.TryConsumeAsync(QuotaMetric.LiveMinutes, ReservedMinutesAtStart, cancellationToken);
            _sessionStartTimes[sessionId.ToString()] = DateTime.UtcNow;
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

        if (_sessionStartTimes.TryRemove(sessionId.ToString(), out var startedAt))
        {
            var elapsedMinutes = Math.Max(1, (int)Math.Ceiling((DateTime.UtcNow - startedAt).TotalMinutes));
            var delta = elapsedMinutes - ReservedMinutesAtStart;

            if (delta > 0)
                await _quotaGuard.TryConsumeAsync(QuotaMetric.LiveMinutes, delta, cancellationToken);
            else if (delta < 0)
                await _quotaGuard.ReleaseAsync(QuotaMetric.LiveMinutes, -delta, cancellationToken);
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
