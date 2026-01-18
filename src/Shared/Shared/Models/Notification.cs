namespace Shared.Models;

public enum NotificationType
{
    General = 0,
    ClassAnnouncement = 1,
    HomeworkAssigned = 2,
    HomeworkDue = 3,
    HomeworkGraded = 4,
    ExamScheduled = 5,
    ExamStarting = 6,
    ExamResults = 7,
    LiveSessionStarting = 8
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ActionUrl { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual User? User { get; set; }
}

public class NotificationPreference
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public bool EmailNotifications { get; set; } = true;
    public bool PushNotifications { get; set; } = true;
    public bool ClassroomUpdates { get; set; } = true;
    public bool HomeworkReminders { get; set; } = true;
    public bool ExamReminders { get; set; } = true;
    public bool LiveSessionAlerts { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual User? User { get; set; }
}
