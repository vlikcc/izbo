using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using Shared.DTOs;
using Shared.Models;

namespace NotificationService.Services;

public interface INotificationManagementService
{
    Task<NotificationDto> CreateNotificationAsync(Guid userId, NotificationType type, string title, string message, string? actionUrl = null);
    Task<List<NotificationDto>> GetUserNotificationsAsync(Guid userId, bool unreadOnly = false);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task<bool> MarkAsReadAsync(Guid notificationId);
    Task<bool> MarkAllAsReadAsync(Guid userId);
    Task<bool> DeleteNotificationAsync(Guid notificationId);
    Task<NotificationPreferenceDto?> GetPreferencesAsync(Guid userId);
    Task<NotificationPreferenceDto> UpdatePreferencesAsync(Guid userId, UpdateNotificationPreferenceRequest request);
}

public class NotificationManagementService : INotificationManagementService
{
    private readonly NotificationDbContext _context;
    private readonly ILogger<NotificationManagementService> _logger;

    public NotificationManagementService(NotificationDbContext context, ILogger<NotificationManagementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<NotificationDto> CreateNotificationAsync(Guid userId, NotificationType type, string title, string message, string? actionUrl = null)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Notification created for user {UserId}: {Title}", userId, title);

        return MapToDto(notification);
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(Guid userId, bool unreadOnly = false)
    {
        var query = _context.Notifications
            .Where(n => n.UserId == userId);

        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        return notifications.Select(MapToDto).ToList();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);
    }

    public async Task<bool> MarkAsReadAsync(Guid notificationId)
    {
        var notification = await _context.Notifications.FindAsync(notificationId);
        if (notification == null) return false;

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> MarkAllAsReadAsync(Guid userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteNotificationAsync(Guid notificationId)
    {
        var notification = await _context.Notifications.FindAsync(notificationId);
        if (notification == null) return false;

        _context.Notifications.Remove(notification);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<NotificationPreferenceDto?> GetPreferencesAsync(Guid userId)
    {
        var pref = await _context.Preferences.FirstOrDefaultAsync(p => p.UserId == userId);
        return pref != null ? MapPrefToDto(pref) : null;
    }

    public async Task<NotificationPreferenceDto> UpdatePreferencesAsync(Guid userId, UpdateNotificationPreferenceRequest request)
    {
        var pref = await _context.Preferences.FirstOrDefaultAsync(p => p.UserId == userId);

        if (pref == null)
        {
            pref = new NotificationPreference
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                EmailNotifications = request.EmailNotifications ?? true,
                PushNotifications = request.PushNotifications ?? true,
                ClassroomUpdates = request.ClassroomUpdates ?? true,
                HomeworkReminders = request.HomeworkReminders ?? true,
                ExamReminders = request.ExamReminders ?? true,
                LiveSessionAlerts = request.LiveSessionAlerts ?? true
            };
            _context.Preferences.Add(pref);
        }
        else
        {
            if (request.EmailNotifications.HasValue) pref.EmailNotifications = request.EmailNotifications.Value;
            if (request.PushNotifications.HasValue) pref.PushNotifications = request.PushNotifications.Value;
            if (request.ClassroomUpdates.HasValue) pref.ClassroomUpdates = request.ClassroomUpdates.Value;
            if (request.HomeworkReminders.HasValue) pref.HomeworkReminders = request.HomeworkReminders.Value;
            if (request.ExamReminders.HasValue) pref.ExamReminders = request.ExamReminders.Value;
            if (request.LiveSessionAlerts.HasValue) pref.LiveSessionAlerts = request.LiveSessionAlerts.Value;
        }

        await _context.SaveChangesAsync();
        return MapPrefToDto(pref);
    }

    private static NotificationDto MapToDto(Notification n) => new(
        n.Id,
        n.UserId,
        n.Type.ToString(),
        n.Title,
        n.Message,
        n.ActionUrl,
        n.IsRead,
        n.CreatedAt,
        n.ReadAt
    );

    private static NotificationPreferenceDto MapPrefToDto(NotificationPreference p) => new(
        p.UserId,
        p.EmailNotifications,
        p.PushNotifications,
        p.ClassroomUpdates,
        p.HomeworkReminders,
        p.ExamReminders,
        p.LiveSessionAlerts
    );
}
