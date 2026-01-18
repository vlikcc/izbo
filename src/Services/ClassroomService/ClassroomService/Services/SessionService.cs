using ClassroomService.Data;
using ClassroomService.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using Shared.Models;

namespace ClassroomService.Services;

public interface ISessionService
{
    Task<ClassSessionDto?> CreateSessionAsync(Guid classroomId, CreateSessionRequest request);
    Task<ClassSessionDto?> GetSessionAsync(Guid sessionId);
    Task<List<ClassSessionDto>> GetClassroomSessionsAsync(Guid classroomId);
    Task<List<ClassSessionDto>> GetUpcomingSessionsAsync(Guid studentId);
    Task<ClassSessionDto?> UpdateSessionAsync(Guid sessionId, UpdateSessionRequest request);
    Task<bool> DeleteSessionAsync(Guid sessionId);
    Task<bool> StartSessionAsync(Guid sessionId);
    Task<bool> EndSessionAsync(Guid sessionId);
    Task<List<ClassSessionDto>> GetLiveSessionsAsync();
}

public class SessionService : ISessionService
{
    private readonly ClassroomDbContext _context;
    private readonly IHubContext<ClassroomHub> _hubContext;
    private readonly ILogger<SessionService> _logger;

    public SessionService(
        ClassroomDbContext context,
        IHubContext<ClassroomHub> hubContext,
        ILogger<SessionService> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<ClassSessionDto?> CreateSessionAsync(Guid classroomId, CreateSessionRequest request)
    {
        var classroom = await _context.Classrooms.FindAsync(classroomId);
        if (classroom == null) return null;

        var session = new ClassSession
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            Title = request.Title,
            Description = request.Description,
            ScheduledStartTime = DateTime.SpecifyKind(request.ScheduledStartTime, DateTimeKind.Utc),
            ScheduledEndTime = DateTime.SpecifyKind(request.ScheduledEndTime, DateTimeKind.Utc),
            Status = SessionStatus.Scheduled,
            CreatedAt = DateTime.UtcNow
        };

        _context.ClassSessions.Add(session);
        await _context.SaveChangesAsync();

        // Notify enrolled students
        await _hubContext.Clients.Group($"classroom_{classroomId}")
            .SendAsync("SessionScheduled", MapToDto(session));

        _logger.LogInformation("Session {SessionId} created for classroom {ClassroomId}", session.Id, classroomId);

        return MapToDto(session);
    }

    public async Task<ClassSessionDto?> GetSessionAsync(Guid sessionId)
    {
        var session = await _context.ClassSessions.FindAsync(sessionId);
        return session != null ? MapToDto(session) : null;
    }

    public async Task<List<ClassSessionDto>> GetClassroomSessionsAsync(Guid classroomId)
    {
        var sessions = await _context.ClassSessions
            .Where(s => s.ClassroomId == classroomId)
            .OrderByDescending(s => s.ScheduledStartTime)
            .ToListAsync();

        return sessions.Select(MapToDto).ToList();
    }

    public async Task<List<ClassSessionDto>> GetUpcomingSessionsAsync(Guid studentId)
    {
        var classroomIds = await _context.Enrollments
            .Where(e => e.StudentId == studentId && e.IsActive)
            .Select(e => e.ClassroomId)
            .ToListAsync();

        var sessions = await _context.ClassSessions
            .Where(s => classroomIds.Contains(s.ClassroomId) &&
                       s.ScheduledStartTime > DateTime.UtcNow &&
                       s.Status == SessionStatus.Scheduled)
            .OrderBy(s => s.ScheduledStartTime)
            .Take(10)
            .ToListAsync();

        return sessions.Select(MapToDto).ToList();
    }

    public async Task<ClassSessionDto?> UpdateSessionAsync(Guid sessionId, UpdateSessionRequest request)
    {
        var session = await _context.ClassSessions.FindAsync(sessionId);
        if (session == null) return null;

        if (request.Title != null) session.Title = request.Title;
        if (request.Description != null) session.Description = request.Description;
        if (request.ScheduledStartTime.HasValue) session.ScheduledStartTime = DateTime.SpecifyKind(request.ScheduledStartTime.Value, DateTimeKind.Utc);
        if (request.ScheduledEndTime.HasValue) session.ScheduledEndTime = DateTime.SpecifyKind(request.ScheduledEndTime.Value, DateTimeKind.Utc);

        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionUpdated", MapToDto(session));

        return MapToDto(session);
    }

    public async Task<bool> DeleteSessionAsync(Guid sessionId)
    {
        var session = await _context.ClassSessions.FindAsync(sessionId);
        if (session == null) return false;

        session.Status = SessionStatus.Cancelled;
        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionCancelled", sessionId);

        return true;
    }

    public async Task<bool> StartSessionAsync(Guid sessionId)
    {
        var session = await _context.ClassSessions
            .Include(s => s.Classroom)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null || session.Status != SessionStatus.Scheduled)
            return false;

        session.Status = SessionStatus.Live;
        session.ActualStartTime = DateTime.UtcNow;
        session.MeetingUrl = GenerateMeetingUrl(sessionId);

        await _context.SaveChangesAsync();

        // Notify all enrolled students
        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionStarted", new
            {
                sessionId,
                session.Title,
                session.MeetingUrl
            });

        _logger.LogInformation("Session {SessionId} started", sessionId);

        return true;
    }

    public async Task<bool> EndSessionAsync(Guid sessionId)
    {
        var session = await _context.ClassSessions.FindAsync(sessionId);
        if (session == null || session.Status != SessionStatus.Live)
            return false;

        session.Status = SessionStatus.Ended;
        session.ActualEndTime = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionEnded", sessionId);

        _logger.LogInformation("Session {SessionId} ended", sessionId);

        return true;
    }

    public async Task<List<ClassSessionDto>> GetLiveSessionsAsync()
    {
        var sessions = await _context.ClassSessions
            .Include(s => s.Classroom)
            .Where(s => s.Status == SessionStatus.Live)
            .ToListAsync();

        return sessions.Select(MapToDto).ToList();
    }

    private static string GenerateMeetingUrl(Guid sessionId)
    {
        // In production, this would integrate with Jitsi or your WebRTC server
        return $"/live/{sessionId}";
    }

    private static ClassSessionDto MapToDto(ClassSession s) => new(
        s.Id,
        s.ClassroomId,
        s.Title,
        s.Description,
        s.ScheduledStartTime,
        s.ScheduledEndTime,
        s.MeetingUrl,
        s.RecordingUrl,
        s.Status.ToString()
    );
}
