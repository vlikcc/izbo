using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NotificationService.Hubs;
using NotificationService.Services;
using Shared.DTOs;
using Shared.Models;
using System.Security.Claims;

namespace NotificationService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationManagementService _notificationService;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        INotificationManagementService notificationService,
        IHubContext<NotificationHub> hubContext,
        ILogger<NotificationsController> logger)
    {
        _notificationService = notificationService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationDto>>>> GetNotifications([FromQuery] bool unreadOnly = false)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _notificationService.GetUserNotificationsAsync(userId, unreadOnly);
        return Ok(new ApiResponse<List<NotificationDto>>(true, result));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new ApiResponse<int>(true, count));
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsRead(Guid id)
    {
        var result = await _notificationService.MarkAsReadAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Notification not found"));

        return Ok(new ApiResponse<bool>(true, true, "Marked as read"));
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAllAsRead()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _notificationService.MarkAllAsReadAsync(userId);
        return Ok(new ApiResponse<bool>(true, result, "All marked as read"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteNotification(Guid id)
    {
        var result = await _notificationService.DeleteNotificationAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Notification not found"));

        return Ok(new ApiResponse<bool>(true, true, "Notification deleted"));
    }

    [HttpGet("preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferenceDto>>> GetPreferences()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _notificationService.GetPreferencesAsync(userId);

        if (result == null)
        {
            // Return default preferences
            result = new NotificationPreferenceDto(userId, true, true, true, true, true, true);
        }

        return Ok(new ApiResponse<NotificationPreferenceDto>(true, result));
    }

    [HttpPut("preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferenceDto>>> UpdatePreferences([FromBody] UpdateNotificationPreferenceRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _notificationService.UpdatePreferencesAsync(userId, request);
        return Ok(new ApiResponse<NotificationPreferenceDto>(true, result, "Preferences updated"));
    }

    // Admin/System endpoint to send notifications
    [HttpPost("send")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<NotificationDto>>> SendNotification([FromBody] SendNotificationRequest request)
    {
        if (!Enum.TryParse<NotificationType>(request.Type, out var type))
            return BadRequest(new ApiResponse<NotificationDto>(false, null, "Invalid notification type"));

        var notification = await _notificationService.CreateNotificationAsync(
            request.UserId, type, request.Title, request.Message, request.ActionUrl);

        // Send real-time notification
        await _hubContext.Clients.Group($"user_{request.UserId}")
            .SendAsync("NewNotification", notification);

        return Ok(new ApiResponse<NotificationDto>(true, notification, "Notification sent"));
    }

    // Broadcast to all users
    [HttpPost("broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> BroadcastNotification([FromBody] BroadcastNotificationRequest request)
    {
        await _hubContext.Clients.All.SendAsync("BroadcastNotification", new
        {
            title = request.Title,
            message = request.Message,
            timestamp = DateTime.UtcNow
        });

        return Ok(new ApiResponse<bool>(true, true, "Broadcast sent"));
    }
}

public record SendNotificationRequest(Guid UserId, string Type, string Title, string Message, string? ActionUrl);
public record BroadcastNotificationRequest(string Title, string Message);
