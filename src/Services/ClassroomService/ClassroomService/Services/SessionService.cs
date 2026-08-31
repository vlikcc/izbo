using ClassroomService.Configuration;
using ClassroomService.Data;
using ClassroomService.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ClassroomService.Services;

public interface ISessionService
{
    Task<ClassSessionDto?> CreateSessionAsync(Guid classroomId, CreateSessionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ClassSessionDto?> GetSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ClassSessionDto>?> GetClassroomSessionsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ClassSessionDto>> GetUpcomingSessionsAsync(Caller caller, CancellationToken cancellationToken = default);
    Task<ClassSessionDto?> UpdateSessionAsync(Guid sessionId, UpdateSessionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> StartSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> EndSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ClassSessionDto>> GetLiveSessionsAsync(Caller caller, CancellationToken cancellationToken = default);
    Task<string?> GetJitsiTokenAsync(Guid sessionId, Caller caller, string userName, string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// The caller's access to the classroom owning <paramref name="sessionId"/>, or <c>null</c> when no
    /// such session exists. Session membership is not modelled separately from classroom membership.
    /// </summary>
    Task<ClassroomAccess?> GetSessionAccessAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
}

public class SessionService : ISessionService
{
    private readonly ClassroomDbContext _context;
    private readonly IHubContext<ClassroomHub> _hubContext;
    private readonly JitsiOptions _jitsiOptions;
    private readonly ILogger<SessionService> _logger;

    public SessionService(
        ClassroomDbContext context,
        IHubContext<ClassroomHub> hubContext,
        IOptions<JitsiOptions> jitsiOptions,
        ILogger<SessionService> logger)
    {
        ArgumentNullException.ThrowIfNull(jitsiOptions);

        _context = context;
        _hubContext = hubContext;
        _jitsiOptions = jitsiOptions.Value;
        _logger = logger;
    }

    public async Task<ClassSessionDto?> CreateSessionAsync(Guid classroomId, CreateSessionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await CanManageClassroomAsync(classroomId, caller, cancellationToken))
        {
            return null;
        }

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
        await _context.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group($"classroom_{classroomId}")
            .SendAsync("SessionScheduled", MapToDto(session), cancellationToken);

        _logger.LogInformation("Session {SessionId} created for classroom {ClassroomId}", session.Id, classroomId);

        return MapToDto(session);
    }

    public async Task<ClassSessionDto?> GetSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await _context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        if (session == null) return null;

        return await CanViewClassroomAsync(session.ClassroomId, caller, cancellationToken) ? MapToDto(session) : null;
    }

    public async Task<List<ClassSessionDto>?> GetClassroomSessionsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        if (!await CanViewClassroomAsync(classroomId, caller, cancellationToken))
        {
            return null;
        }

        return await _context.ClassSessions
            .AsNoTracking()
            .Where(s => s.ClassroomId == classroomId)
            .OrderByDescending(s => s.ScheduledStartTime)
            .Select(s => new ClassSessionDto(
                s.Id, s.ClassroomId, s.Title, s.Description,
                s.ScheduledStartTime, s.ScheduledEndTime,
                s.MeetingUrl, s.RecordingUrl, s.Status.ToString()))
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ClassSessionDto>> GetUpcomingSessionsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var query = _context.ClassSessions
            .AsNoTracking()
            .Where(s => s.ScheduledEndTime > DateTime.UtcNow &&
                        (s.Status == SessionStatus.Scheduled || s.Status == SessionStatus.Live));

        if (!caller.IsPlatformAdmin)
        {
            var classroomIds = await GetAccessibleClassroomIdsAsync(caller.UserId, cancellationToken);
            query = query.Where(s => classroomIds.Contains(s.ClassroomId));
        }

        return await query
            .OrderBy(s => s.ScheduledStartTime)
            .Take(20)
            .Select(s => new ClassSessionDto(
                s.Id, s.ClassroomId, s.Title, s.Description,
                s.ScheduledStartTime, s.ScheduledEndTime,
                s.MeetingUrl, s.RecordingUrl, s.Status.ToString()))
            .ToListAsync(cancellationToken);
    }

    public async Task<ClassSessionDto?> UpdateSessionAsync(Guid sessionId, UpdateSessionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var session = await FindManageableSessionAsync(sessionId, caller, cancellationToken);
        if (session == null) return null;

        if (request.Title != null) session.Title = request.Title;
        if (request.Description != null) session.Description = request.Description;
        if (request.ScheduledStartTime.HasValue) session.ScheduledStartTime = DateTime.SpecifyKind(request.ScheduledStartTime.Value, DateTimeKind.Utc);
        if (request.ScheduledEndTime.HasValue) session.ScheduledEndTime = DateTime.SpecifyKind(request.ScheduledEndTime.Value, DateTimeKind.Utc);

        await _context.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionUpdated", MapToDto(session), cancellationToken);

        return MapToDto(session);
    }

    public async Task<bool> DeleteSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await FindManageableSessionAsync(sessionId, caller, cancellationToken);
        if (session == null) return false;

        session.Status = SessionStatus.Cancelled;
        await _context.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionCancelled", sessionId, cancellationToken);

        return true;
    }

    public async Task<bool> StartSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await FindManageableSessionAsync(sessionId, caller, cancellationToken);
        if (session == null || session.Status != SessionStatus.Scheduled)
            return false;

        session.Status = SessionStatus.Live;
        session.ActualStartTime = DateTime.UtcNow;
        session.MeetingUrl = GenerateMeetingUrl(sessionId);

        await _context.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionStarted", new
            {
                sessionId,
                session.Title,
                session.MeetingUrl
            }, cancellationToken);

        _logger.LogInformation("Session {SessionId} started by {UserId}", sessionId, caller.UserId);

        return true;
    }

    public async Task<bool> EndSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await FindManageableSessionAsync(sessionId, caller, cancellationToken);
        if (session == null || session.Status != SessionStatus.Live)
            return false;

        session.Status = SessionStatus.Ended;
        session.ActualEndTime = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _hubContext.Clients.Group($"classroom_{session.ClassroomId}")
            .SendAsync("SessionEnded", sessionId, cancellationToken);

        _logger.LogInformation("Session {SessionId} ended by {UserId}", sessionId, caller.UserId);

        return true;
    }

    public async Task<List<ClassSessionDto>> GetLiveSessionsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var query = _context.ClassSessions
            .AsNoTracking()
            .Where(s => s.Status == SessionStatus.Live);

        // Students and instructors only see live sessions of classrooms they belong to.
        if (!caller.IsPlatformAdmin)
        {
            var classroomIds = await GetAccessibleClassroomIdsAsync(caller.UserId, cancellationToken);
            query = query.Where(s => classroomIds.Contains(s.ClassroomId));
        }

        return await query
            .Select(s => new ClassSessionDto(
                s.Id, s.ClassroomId, s.Title, s.Description,
                s.ScheduledStartTime, s.ScheduledEndTime,
                s.MeetingUrl, s.RecordingUrl, s.Status.ToString()))
            .ToListAsync(cancellationToken);
    }

    public async Task<string?> GetJitsiTokenAsync(Guid sessionId, Caller caller, string userName, string email, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var session = await _context.ClassSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session == null) return null;

        var access = await GetClassroomAccessAsync(session.ClassroomId, caller, cancellationToken);
        if (access is null || !access.CanView)
        {
            _logger.LogWarning(
                "User {UserId} requested a live-session token for session {SessionId} without classroom access",
                caller.UserId, sessionId);
            return null;
        }

        if (!_jitsiOptions.IsConfigured)
        {
            _logger.LogError("Jitsi:AppId and Jitsi:AppSecret must be configured to issue live-session tokens");
            return null;
        }

        // Moderator rights follow classroom ownership, not merely the caller's platform role: an
        // instructor of another classroom must join as a regular participant.
        return GenerateJitsiJwtToken(
            _jitsiOptions.AppId,
            _jitsiOptions.AppSecret,
            $"eduplatform-live-{sessionId}",
            userName,
            email,
            caller.UserId.ToString(),
            isModerator: access.IsInstructor);
    }

    public async Task<ClassroomAccess?> GetSessionAccessAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var classroomId = await _context.ClassSessions
            .AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => (Guid?)s.ClassroomId)
            .FirstOrDefaultAsync(cancellationToken);

        return classroomId is null ? null : await GetClassroomAccessAsync(classroomId.Value, caller, cancellationToken);
    }

    private async Task<List<Guid>> GetAccessibleClassroomIdsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var enrolled = await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == userId && e.IsActive && e.Classroom!.IsActive)
            .Select(e => e.ClassroomId)
            .ToListAsync(cancellationToken);

        var owned = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.InstructorId == userId && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        return enrolled.Union(owned).ToList();
    }

    private async Task<ClassroomAccess?> GetClassroomAccessAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroom = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.Id == classroomId && c.IsActive)
            .Select(c => new { c.InstructorId })
            .FirstOrDefaultAsync(cancellationToken);

        if (classroom == null) return null;

        if (caller.IsPlatformAdmin)
        {
            return new ClassroomAccess(IsInstructor: true, IsEnrolled: true);
        }

        var isEnrolled = await _context.Enrollments
            .AsNoTracking()
            .AnyAsync(e => e.ClassroomId == classroomId && e.StudentId == caller.UserId && e.IsActive, cancellationToken);

        return new ClassroomAccess(classroom.InstructorId == caller.UserId, isEnrolled);
    }

    private async Task<bool> CanViewClassroomAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await GetClassroomAccessAsync(classroomId, caller, cancellationToken);
        return access?.CanView == true;
    }

    private async Task<bool> CanManageClassroomAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await GetClassroomAccessAsync(classroomId, caller, cancellationToken);
        if (access?.IsInstructor == true)
        {
            return true;
        }

        _logger.LogWarning(
            "User {UserId} attempted to manage sessions of classroom {ClassroomId} they do not own",
            caller.UserId, classroomId);
        return false;
    }

    /// <summary>
    /// Loads a session only when the caller owns its classroom, so sessions of other instructors'
    /// classrooms cannot be started, ended or modified.
    /// </summary>
    private async Task<ClassSession?> FindManageableSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await _context.ClassSessions.FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        if (session == null) return null;

        return await CanManageClassroomAsync(session.ClassroomId, caller, cancellationToken) ? session : null;
    }

    private static string GenerateJitsiJwtToken(string appId, string appSecret, string roomName, string userName, string email, string userId, bool isModerator)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(appSecret);

        var context = new Dictionary<string, object>
        {
            ["user"] = new Dictionary<string, object>
            {
                ["name"] = userName,
                ["email"] = email,
                ["id"] = userId,
                ["avatar"] = string.Empty,
                ["moderator"] = isModerator
            },
            ["features"] = new Dictionary<string, object>
            {
                ["recording"] = isModerator,
                ["livestreaming"] = isModerator,
                ["transcription"] = isModerator,
                ["outbound-call"] = false
            }
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim("aud", "jitsi"),
                new Claim("iss", "chat"),
                new Claim("sub", appId),
                new Claim("room", roomName)
            ]),
            Expires = DateTime.UtcNow.AddHours(2),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature),
            Claims = new Dictionary<string, object> { ["context"] = context }
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string GenerateMeetingUrl(Guid sessionId) => $"/live/{sessionId}";

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
