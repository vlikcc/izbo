using ClassroomService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Paging;
using System.Linq.Expressions;

namespace ClassroomService.Services;

public interface IClassroomManagementService
{
    Task<ClassroomDto?> CreateClassroomAsync(CreateClassroomRequest request, Guid instructorId, CancellationToken cancellationToken = default);
    Task<ClassroomDto?> GetClassroomAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request, CancellationToken cancellationToken = default);
    Task<PagedResponse<ClassroomDto>> GetStudentClassroomsAsync(Guid studentId, PagedRequest request, CancellationToken cancellationToken = default);
    Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteClassroomAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<EnrollmentDto>?> GetEnrollmentsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the caller's relationship to a classroom. Other services call this over HTTP because
    /// ClassroomService is the only owner of the enrollment tables.
    /// </summary>
    Task<ClassroomAccess?> GetAccessAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// Every classroom the caller teaches or is enrolled in. Other services use this to scope list
    /// queries over classroom-scoped content they store themselves.
    /// </summary>
    Task<List<Guid>> GetAccessibleClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default);
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

    public async Task<ClassroomDto?> CreateClassroomAsync(CreateClassroomRequest request, Guid instructorId, CancellationToken cancellationToken = default)
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
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Classroom {ClassroomId} created by instructor {InstructorId}", classroom.Id, instructorId);

        return MapToDto(classroom);
    }

    public async Task<ClassroomAccess?> GetAccessAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var classroom = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.Id == classroomId && c.IsActive)
            .Select(c => new { c.InstructorId })
            .FirstOrDefaultAsync(cancellationToken);

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
            .AnyAsync(e => e.ClassroomId == classroomId && e.StudentId == caller.UserId && e.IsActive, cancellationToken);

        return new ClassroomAccess(isInstructor, isEnrolled);
    }

    public async Task<List<Guid>> GetAccessibleClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (caller.IsPlatformAdmin)
        {
            return await _context.Classrooms
                .AsNoTracking()
                .Where(c => c.IsActive)
                .Select(c => c.Id)
                .ToListAsync(cancellationToken);
        }

        var enrolled = await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == caller.UserId && e.IsActive && e.Classroom!.IsActive)
            .Select(e => e.ClassroomId)
            .ToListAsync(cancellationToken);

        var owned = await _context.Classrooms
            .AsNoTracking()
            .Where(c => c.InstructorId == caller.UserId && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        return enrolled.Union(owned).ToList();
    }

    public async Task<ClassroomDto?> GetClassroomAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var access = await GetAccessAsync(id, caller, cancellationToken);
        if (access is null || !access.CanView)
        {
            return null;
        }

        var classroom = await _context.Classrooms
            .AsNoTracking()
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        return classroom != null ? MapToDto(classroom) : null;
    }

    public async Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Classrooms
            .AsNoTracking()
            .Where(c => c.IsActive);

        if (instructorId.HasValue)
            query = query.Where(c => c.InstructorId == instructorId.Value);

        var paging = string.IsNullOrWhiteSpace(request.SortBy)
            ? request with { SortBy = "createdAt", SortDescending = true }
            : request;

        var sorted = query.ApplySort(paging, ClassroomSort, "createdAt");
        return await sorted
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
            .ToPagedResponseAsync(request, cancellationToken);
    }

    public async Task<PagedResponse<ClassroomDto>> GetStudentClassroomsAsync(Guid studentId, PagedRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == studentId && e.IsActive && e.Classroom!.IsActive);

        var itemsQuery = query
            .OrderByDescending(e => e.EnrolledAt)
            .Select(e => new ClassroomDto(
                e.Classroom!.Id,
                e.Classroom.Name,
                e.Classroom.Description,
                e.Classroom.InstructorId,
                null,
                e.Classroom.CoverImageUrl,
                e.Classroom.Enrollments.Count(x => x.IsActive),
                e.Classroom.IsActive,
                e.Classroom.CreatedAt));

        return await itemsQuery.ToPagedResponseAsync(request, cancellationToken);
    }

    public async Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var classroom = await FindManageableAsync(id, caller, cancellationToken: cancellationToken);
        if (classroom == null) return null;

        if (request.Name != null) classroom.Name = request.Name;
        if (request.Description != null) classroom.Description = request.Description;
        if (request.CoverImageUrl != null) classroom.CoverImageUrl = request.CoverImageUrl;
        classroom.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return MapToDto(classroom);
    }

    public async Task<bool> DeleteClassroomAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroom = await FindManageableAsync(id, caller, cancellationToken: cancellationToken);
        if (classroom == null) return false;

        classroom.IsActive = false;
        classroom.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Classroom {ClassroomId} deactivated by {UserId}", id, caller.UserId);
        return true;
    }

    public async Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroom = await FindManageableAsync(classroomId, caller, cancellationToken: cancellationToken);
        if (classroom == null) return false;

        var existing = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId, cancellationToken);

        if (existing != null)
        {
            // Re-enrolling a previously removed student reactivates the original row.
            if (existing.IsActive) return false;

            existing.IsActive = true;
            existing.EnrolledAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
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

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Student {StudentId} enrolled in classroom {ClassroomId}", studentId, classroomId);
        return true;
    }

    public async Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(studentIds);

        var classroom = await FindManageableAsync(classroomId, caller, cancellationToken: cancellationToken);
        if (classroom == null) return false;

        var existing = await _context.Enrollments
            .Where(e => e.ClassroomId == classroomId && studentIds.Contains(e.StudentId))
            .ToListAsync(cancellationToken);

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

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("{Count} students enrolled in classroom {ClassroomId}", newStudentIds.Count, classroomId);
        return true;
    }

    public async Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroom = await FindManageableAsync(classroomId, caller, cancellationToken: cancellationToken);
        if (classroom == null) return false;

        var enrollment = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId, cancellationToken);

        if (enrollment == null) return false;

        enrollment.IsActive = false;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<EnrollmentDto>?> GetEnrollmentsAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default)
    {
        // The roster identifies other students, so only the owning instructor and admins may read it.
        var classroom = await FindManageableAsync(classroomId, caller, track: false, cancellationToken);
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
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Returns the classroom only when the caller may manage it. A classroom the caller does not own is
    /// reported as missing so callers cannot probe for classrooms belonging to other instructors.
    /// </summary>
    private async Task<Classroom?> FindManageableAsync(Guid classroomId, Caller caller, bool track = true, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var query = track ? _context.Classrooms : _context.Classrooms.AsNoTracking();
        var classroom = await query.FirstOrDefaultAsync(c => c.Id == classroomId, cancellationToken);

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

    private static readonly IReadOnlyDictionary<string, Expression<Func<Classroom, object>>> ClassroomSort =
        new Dictionary<string, Expression<Func<Classroom, object>>>(StringComparer.OrdinalIgnoreCase)
        {
            ["createdAt"] = c => c.CreatedAt,
            ["name"] = c => c.Name
        };

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
