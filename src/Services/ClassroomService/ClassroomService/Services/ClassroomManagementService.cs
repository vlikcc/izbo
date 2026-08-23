using ClassroomService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ClassroomService.Services;

public interface IClassroomManagementService
{
    Task<ClassroomDto?> CreateClassroomAsync(CreateClassroomRequest request, Guid instructorId);
    Task<ClassroomDto?> GetClassroomAsync(Guid id, Caller caller);
    Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request);
    Task<PagedResponse<ClassroomDto>> GetStudentClassroomsAsync(Guid studentId, PagedRequest request);
    Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request, Caller caller);
    Task<bool> DeleteClassroomAsync(Guid id, Caller caller);
    Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId, Caller caller);
    Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds, Caller caller);
    Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId, Caller caller);
    Task<List<EnrollmentDto>?> GetEnrollmentsAsync(Guid classroomId, Caller caller);

    /// <summary>
    /// Resolves the caller's relationship to a classroom. Other services call this over HTTP because
    /// ClassroomService is the only owner of the enrollment tables.
    /// </summary>
    Task<ClassroomAccess?> GetAccessAsync(Guid classroomId, Caller caller);

    /// <summary>
    /// Every classroom the caller teaches or is enrolled in. Other services use this to scope list
    /// queries over classroom-scoped content they store themselves.
    /// </summary>
    Task<List<Guid>> GetAccessibleClassroomIdsAsync(Caller caller);
}

public class ClassroomManagementService : IClassroomManagementService
{
    private readonly ClassroomDbContext _context;
    private readonly ILogger<ClassroomManagementService> _logger;

    public ClassroomManagementService(ClassroomDbContext context, ILogger<ClassroomManagementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ClassroomDto?> CreateClassroomAsync(CreateClassroomRequest request, Guid instructorId)
    {
        var classroom = new Classroom
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            CoverImageUrl = request.CoverImageUrl,
            InstructorId = instructorId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Classrooms.Add(classroom);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Classroom {ClassroomId} created by instructor {InstructorId}", classroom.Id, instructorId);

        return MapToDto(classroom);
    }

    public async Task<ClassroomAccess?> GetAccessAsync(Guid classroomId, Caller caller)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var classroom = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.Id == classroomId && c.IsActive)
            .Select(c => new { c.InstructorId })
            .FirstOrDefaultAsync();

        if (classroom == null)
        {
            return null;
        }

        if (caller.IsPlatformAdmin)
        {
            return new ClassroomAccess(IsInstructor: true, IsEnrolled: true);
        }

        var isInstructor = classroom.InstructorId == caller.UserId;

        var isEnrolled = await _context.Enrollments
            .AsNoTracking()
            .AnyAsync(e => e.ClassroomId == classroomId && e.StudentId == caller.UserId && e.IsActive);

        return new ClassroomAccess(isInstructor, isEnrolled);
    }

    public async Task<List<Guid>> GetAccessibleClassroomIdsAsync(Caller caller)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (caller.IsPlatformAdmin)
        {
            return await _context.Classrooms
                .AsNoTracking()
                .Where(c => c.IsActive)
                .Select(c => c.Id)
                .ToListAsync();
        }

        var enrolled = await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == caller.UserId && e.IsActive && e.Classroom!.IsActive)
            .Select(e => e.ClassroomId)
            .ToListAsync();

        var owned = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.InstructorId == caller.UserId && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync();

        return enrolled.Union(owned).ToList();
    }

    public async Task<ClassroomDto?> GetClassroomAsync(Guid id, Caller caller)
    {
        var access = await GetAccessAsync(id, caller);
        if (access is null || !access.CanView)
        {
            return null;
        }

        var classroom = await _context.Classrooms
            .AsNoTracking()
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.Id == id);

        return classroom != null ? MapToDto(classroom) : null;
    }

    public async Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Classrooms
            .AsNoTracking()
            .Where(c => c.IsActive);

        if (instructorId.HasValue)
            query = query.Where(c => c.InstructorId == instructorId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => new ClassroomDto(
                c.Id,
                c.Name,
                c.Description,
                c.InstructorId,
                null,
                c.CoverImageUrl,
                c.Enrollments.Count(e => e.IsActive),
                c.IsActive,
                c.CreatedAt))
            .ToListAsync();

        return new PagedResponse<ClassroomDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<PagedResponse<ClassroomDto>> GetStudentClassroomsAsync(Guid studentId, PagedRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == studentId && e.IsActive && e.Classroom!.IsActive);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(e => e.EnrolledAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => new ClassroomDto(
                e.Classroom!.Id,
                e.Classroom.Name,
                e.Classroom.Description,
                e.Classroom.InstructorId,
                null,
                e.Classroom.CoverImageUrl,
                e.Classroom.Enrollments.Count(x => x.IsActive),
                e.Classroom.IsActive,
                e.Classroom.CreatedAt))
            .ToListAsync();

        return new PagedResponse<ClassroomDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request, Caller caller)
    {
        ArgumentNullException.ThrowIfNull(request);

        var classroom = await FindManageableAsync(id, caller);
        if (classroom == null) return null;

        if (request.Name != null) classroom.Name = request.Name;
        if (request.Description != null) classroom.Description = request.Description;
        if (request.CoverImageUrl != null) classroom.CoverImageUrl = request.CoverImageUrl;
        classroom.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToDto(classroom);
    }

    public async Task<bool> DeleteClassroomAsync(Guid id, Caller caller)
    {
        var classroom = await FindManageableAsync(id, caller);
        if (classroom == null) return false;

        classroom.IsActive = false;
        classroom.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Classroom {ClassroomId} deactivated by {UserId}", id, caller.UserId);
        return true;
    }

    public async Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId, Caller caller)
    {
        var classroom = await FindManageableAsync(classroomId, caller);
        if (classroom == null) return false;

        var existing = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId);

        if (existing != null)
        {
            // Re-enrolling a previously removed student reactivates the original row.
            if (existing.IsActive) return false;

            existing.IsActive = true;
            existing.EnrolledAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        _context.Enrollments.Add(new Enrollment
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            StudentId = studentId,
            EnrolledAt = DateTime.UtcNow,
            IsActive = true
        });

        await _context.SaveChangesAsync();

        _logger.LogInformation("Student {StudentId} enrolled in classroom {ClassroomId}", studentId, classroomId);
        return true;
    }

    public async Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds, Caller caller)
    {
        ArgumentNullException.ThrowIfNull(studentIds);

        var classroom = await FindManageableAsync(classroomId, caller);
        if (classroom == null) return false;

        var existing = await _context.Enrollments
            .Where(e => e.ClassroomId == classroomId && studentIds.Contains(e.StudentId))
            .ToListAsync();

        foreach (var enrollment in existing.Where(e => !e.IsActive))
        {
            enrollment.IsActive = true;
            enrollment.EnrolledAt = DateTime.UtcNow;
        }

        var newStudentIds = studentIds.Except(existing.Select(e => e.StudentId)).ToList();

        _context.Enrollments.AddRange(newStudentIds.Select(studentId => new Enrollment
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            StudentId = studentId,
            EnrolledAt = DateTime.UtcNow,
            IsActive = true
        }));

        await _context.SaveChangesAsync();

        _logger.LogInformation("{Count} students enrolled in classroom {ClassroomId}", newStudentIds.Count, classroomId);
        return true;
    }

    public async Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId, Caller caller)
    {
        var classroom = await FindManageableAsync(classroomId, caller);
        if (classroom == null) return false;

        var enrollment = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId);

        if (enrollment == null) return false;

        enrollment.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<EnrollmentDto>?> GetEnrollmentsAsync(Guid classroomId, Caller caller)
    {
        // The roster identifies other students, so only the owning instructor and admins may read it.
        var classroom = await FindManageableAsync(classroomId, caller, track: false);
        if (classroom == null) return null;

        return await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.ClassroomId == classroomId && e.IsActive)
            .OrderBy(e => e.EnrolledAt)
            .Select(e => new EnrollmentDto(
                e.Id,
                e.ClassroomId,
                e.StudentId,
                string.Empty,
                e.EnrolledAt,
                e.IsActive))
            .ToListAsync();
    }

    /// <summary>
    /// Returns the classroom only when the caller may manage it. A classroom the caller does not own is
    /// reported as missing so callers cannot probe for classrooms belonging to other instructors.
    /// </summary>
    private async Task<Classroom?> FindManageableAsync(Guid classroomId, Caller caller, bool track = true)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var query = track ? _context.Classrooms : _context.Classrooms.AsNoTracking();
        var classroom = await query.FirstOrDefaultAsync(c => c.Id == classroomId);

        if (classroom == null)
        {
            return null;
        }

        if (caller.IsPlatformAdmin || classroom.InstructorId == caller.UserId)
        {
            return classroom;
        }

        _logger.LogWarning(
            "User {UserId} attempted to manage classroom {ClassroomId} owned by {InstructorId}",
            caller.UserId, classroomId, classroom.InstructorId);

        return null;
    }

    private static ClassroomDto MapToDto(Classroom c) => new(
        c.Id,
        c.Name,
        c.Description,
        c.InstructorId,
        null, // InstructorName would require join with UserService
        c.CoverImageUrl,
        c.Enrollments?.Count(e => e.IsActive) ?? 0,
        c.IsActive,
        c.CreatedAt
    );
}
