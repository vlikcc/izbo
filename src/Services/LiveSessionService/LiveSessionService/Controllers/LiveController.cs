using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using LiveSessionService.Hubs;
using Shared.DTOs;
using Shared.Models;
using Shared.Subscription;
using System.Collections.Concurrent;

namespace LiveSessionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LiveController : ControllerBase
{
    // LiveSessionService has no database (pure SignalR signaling) — this in-memory map of
    // sessionId -> started-at is enough to bill elapsed minutes on EndSession without adding one.
    private static readonly ConcurrentDictionary<string, DateTime> _sessionStartTimes = new();
    private const int ReservedMinutesAtStart = 1;

    private readonly IHubContext<LiveSessionHub> _hubContext;
    private readonly IQuotaGuard _quotaGuard;
    private readonly ILogger<LiveController> _logger;

    public LiveController(IHubContext<LiveSessionHub> hubContext, IQuotaGuard quotaGuard, ILogger<LiveController> logger)
    {
        _hubContext = hubContext;
        _quotaGuard = quotaGuard;
        _logger = logger;
    }

    [HttpPost("sessions/{sessionId}/notify")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> NotifySessionStart(string sessionId, [FromBody] NotifySessionRequest request)
    {
        // A reminder sent minutes ahead of the actual start (StartsInMinutes > 0) doesn't consume
        // quota yet; only treat this as the session actually beginning when it fires at start time.
        if (request.StartsInMinutes <= 0)
        {
            await _quotaGuard.EnsureFeatureAsync("live_class");
            await _quotaGuard.TryConsumeAsync(QuotaMetric.LiveMinutes, ReservedMinutesAtStart);
            _sessionStartTimes[sessionId] = DateTime.UtcNow;
        }

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
        if (_sessionStartTimes.TryRemove(sessionId, out var startedAt))
        {
            var elapsedMinutes = Math.Max(1, (int)Math.Ceiling((DateTime.UtcNow - startedAt).TotalMinutes));
            var delta = elapsedMinutes - ReservedMinutesAtStart;

            if (delta > 0)
                await _quotaGuard.TryConsumeAsync(QuotaMetric.LiveMinutes, delta);
            else if (delta < 0)
                await _quotaGuard.ReleaseAsync(QuotaMetric.LiveMinutes, -delta);
        }

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
