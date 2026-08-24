using ClassroomService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ClassroomService.Services;

public interface IClassroomCommunityService
{
    Task<List<AnnouncementDto>?> ListAnnouncementsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);
    Task<AnnouncementDto?> CreateAnnouncementAsync(Guid classroomId, CreateAnnouncementRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteAnnouncementAsync(Guid classroomId, Guid announcementId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ClassroomCommentDto>?> ListCommentsAsync(Guid classroomId, string targetType, Guid targetId, Caller caller, CancellationToken cancellationToken = default);
    Task<ClassroomCommentDto?> AddCommentAsync(Guid classroomId, CreateCommentRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task RecordJoinAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken = default);
    Task RecordLeaveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken = default);
    Task<List<AttendanceRecordDto>?> ListAttendanceAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
}

public sealed class ClassroomCommunityService : IClassroomCommunityService
{
    private readonly ClassroomDbContext _context;
    private readonly IClassroomManagementService _classrooms;
    private readonly ISessionService _sessions;
    private readonly ILogger<ClassroomCommunityService> _logger;

    public ClassroomCommunityService(
        ClassroomDbContext context,
        IClassroomManagementService classrooms,
        ISessionService sessions,
        ILogger<ClassroomCommunityService> logger)
    {
        _context = context;
        _classrooms = classrooms;
        _sessions = sessions;
        _logger = logger;
    }

    public async Task<List<AnnouncementDto>?> ListAnnouncementsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await _classrooms.GetAccessAsync(classroomId, caller, cancellationToken);
        if (access is null || !access.CanView)
        {
            return null;
        }

        return await _context.Announcements
            .AsNoTracking()
            .Where(a => a.ClassroomId == classroomId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AnnouncementDto(a.Id, a.ClassroomId, a.AuthorId, a.Title, a.Body, a.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<AnnouncementDto?> CreateAnnouncementAsync(Guid classroomId, CreateAnnouncementRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var access = await _classrooms.GetAccessAsync(classroomId, caller, cancellationToken);
        if (access is null || !access.IsInstructor)
        {
            return null;
        }

        var item = new Announcement
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            AuthorId = caller.UserId,
            Title = request.Title,
            Body = request.Body,
            CreatedAt = DateTime.UtcNow
        };
        _context.Announcements.Add(item);
        await _context.SaveChangesAsync(cancellationToken);
        return new AnnouncementDto(item.Id, item.ClassroomId, item.AuthorId, item.Title, item.Body, item.CreatedAt);
    }

    public async Task<bool> DeleteAnnouncementAsync(Guid classroomId, Guid announcementId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await _classrooms.GetAccessAsync(classroomId, caller, cancellationToken);
        if (access is null || !access.IsInstructor)
        {
            return false;
        }

        var item = await _context.Announcements.FirstOrDefaultAsync(
            a => a.Id == announcementId && a.ClassroomId == classroomId, cancellationToken);
        if (item is null)
        {
            return false;
        }

        _context.Announcements.Remove(item);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<ClassroomCommentDto>?> ListCommentsAsync(
        Guid classroomId,
        string targetType,
        Guid targetId,
        Caller caller,
        CancellationToken cancellationToken = default)
    {
        var access = await _classrooms.GetAccessAsync(classroomId, caller, cancellationToken);
        if (access is null || !access.CanView)
        {
            return null;
        }

        return await _context.Comments
            .AsNoTracking()
            .Where(c => c.ClassroomId == classroomId && c.TargetType == targetType && c.TargetId == targetId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new ClassroomCommentDto(c.Id, c.ClassroomId, c.TargetType, c.TargetId, c.AuthorId, c.Body, c.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<ClassroomCommentDto?> AddCommentAsync(Guid classroomId, CreateCommentRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var access = await _classrooms.GetAccessAsync(classroomId, caller, cancellationToken);
        if (access is null || !access.CanView)
        {
            return null;
        }

        var comment = new ClassroomComment
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            AuthorId = caller.UserId,
            Body = request.Body,
            CreatedAt = DateTime.UtcNow
        };
        _context.Comments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);
        return new ClassroomCommentDto(comment.Id, comment.ClassroomId, comment.TargetType, comment.TargetId, comment.AuthorId, comment.Body, comment.CreatedAt);
    }

    public async Task RecordJoinAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken = default)
    {
        var open = await _context.Attendance
            .FirstOrDefaultAsync(a => a.SessionId == sessionId && a.UserId == userId && a.LeftAt == null, cancellationToken);
        if (open is not null)
        {
            return;
        }

        _context.Attendance.Add(new AttendanceRecord
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            UserId = userId,
            JoinedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RecordLeaveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken = default)
    {
        var open = await _context.Attendance
            .Where(a => a.SessionId == sessionId && a.UserId == userId && a.LeftAt == null)
            .OrderByDescending(a => a.JoinedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (open is null)
        {
            return;
        }

        open.LeftAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<AttendanceRecordDto>?> ListAttendanceAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await _sessions.GetSessionAccessAsync(sessionId, caller, cancellationToken);
        if (access is null || !access.IsInstructor)
        {
            _logger.LogWarning("User {UserId} was refused attendance of session {SessionId}", caller.UserId, sessionId);
            return null;
        }

        return await _context.Attendance
            .AsNoTracking()
            .Where(a => a.SessionId == sessionId)
            .OrderBy(a => a.JoinedAt)
            .Select(a => new AttendanceRecordDto(a.Id, a.SessionId, a.UserId, a.JoinedAt, a.LeftAt))
            .ToListAsync(cancellationToken);
    }
}
