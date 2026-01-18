namespace Shared.DTOs;

// Notification DTOs
public record NotificationDto(
    Guid Id,
    Guid UserId,
    string Type,
    string Title,
    string Message,
    string? ActionUrl,
    bool IsRead,
    DateTime CreatedAt,
    DateTime? ReadAt);

public record NotificationPreferenceDto(
    Guid UserId,
    bool EmailNotifications,
    bool PushNotifications,
    bool ClassroomUpdates,
    bool HomeworkReminders,
    bool ExamReminders,
    bool LiveSessionAlerts);

public record UpdateNotificationPreferenceRequest(
    bool? EmailNotifications,
    bool? PushNotifications,
    bool? ClassroomUpdates,
    bool? HomeworkReminders,
    bool? ExamReminders,
    bool? LiveSessionAlerts);

// File DTOs
public record FileUploadResponse(
    Guid Id,
    string FileName,
    string StoragePath);

public record PresignedUrlResponse(string Url, DateTime ExpiresAt);
