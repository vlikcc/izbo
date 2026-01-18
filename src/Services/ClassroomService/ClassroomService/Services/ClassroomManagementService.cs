using ClassroomService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using Shared.Models;

namespace ClassroomService.Services;

public interface IClassroomManagementService
{
    Task<ClassroomDto?> CreateClassroomAsync(CreateClassroomRequest request, Guid instructorId);
    Task<ClassroomDto?> GetClassroomAsync(Guid id);
    Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request);
    Task<PagedResponse<ClassroomDto>> GetStudentClassroomsAsync(Guid studentId, PagedRequest request);
    Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request);
    Task<bool> DeleteClassroomAsync(Guid id);
    Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId);
    Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds);
    Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId);
    Task<List<EnrollmentDto>> GetEnrollmentsAsync(Guid classroomId);
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

    public async Task<ClassroomDto?> GetClassroomAsync(Guid id)
    {
        var classroom = await _context.Classrooms
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.Id == id);

        return classroom != null ? MapToDto(classroom) : null;
    }

    public async Task<PagedResponse<ClassroomDto>> GetClassroomsAsync(Guid? instructorId, PagedRequest request)
    {
        var query = _context.Classrooms
            .Include(c => c.Enrollments)
            .Where(c => c.IsActive);

        if (instructorId.HasValue)
            query = query.Where(c => c.InstructorId == instructorId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => MapToDto(c))
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
        var query = _context.Enrollments
            .Include(e => e.Classroom)
            .ThenInclude(c => c!.Enrollments)
            .Where(e => e.StudentId == studentId && e.IsActive && e.Classroom!.IsActive);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(e => e.EnrolledAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => MapToDto(e.Classroom!))
            .ToListAsync();

        return new PagedResponse<ClassroomDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<ClassroomDto?> UpdateClassroomAsync(Guid id, UpdateClassroomRequest request)
    {
        var classroom = await _context.Classrooms.FindAsync(id);
        if (classroom == null) return null;

        if (request.Name != null) classroom.Name = request.Name;
        if (request.Description != null) classroom.Description = request.Description;
        if (request.CoverImageUrl != null) classroom.CoverImageUrl = request.CoverImageUrl;
        classroom.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToDto(classroom);
    }

    public async Task<bool> DeleteClassroomAsync(Guid id)
    {
        var classroom = await _context.Classrooms.FindAsync(id);
        if (classroom == null) return false;

        classroom.IsActive = false;
        classroom.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EnrollStudentAsync(Guid classroomId, Guid studentId)
    {
        var exists = await _context.Enrollments
            .AnyAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId);

        if (exists) return false;

        var enrollment = new Enrollment
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            StudentId = studentId,
            EnrolledAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Student {StudentId} enrolled in classroom {ClassroomId}", studentId, classroomId);
        return true;
    }

    public async Task<bool> EnrollStudentsBulkAsync(Guid classroomId, List<Guid> studentIds)
    {
        var existingEnrollments = await _context.Enrollments
            .Where(e => e.ClassroomId == classroomId && studentIds.Contains(e.StudentId))
            .Select(e => e.StudentId)
            .ToListAsync();

        var newStudentIds = studentIds.Except(existingEnrollments).ToList();

        var enrollments = newStudentIds.Select(studentId => new Enrollment
        {
            Id = Guid.NewGuid(),
            ClassroomId = classroomId,
            StudentId = studentId,
            EnrolledAt = DateTime.UtcNow,
            IsActive = true
        }).ToList();

        _context.Enrollments.AddRange(enrollments);
        await _context.SaveChangesAsync();

        _logger.LogInformation("{Count} students enrolled in classroom {ClassroomId}", enrollments.Count, classroomId);
        return true;
    }

    public async Task<bool> UnenrollStudentAsync(Guid classroomId, Guid studentId)
    {
        var enrollment = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.ClassroomId == classroomId && e.StudentId == studentId);

        if (enrollment == null) return false;

        enrollment.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<EnrollmentDto>> GetEnrollmentsAsync(Guid classroomId)
    {
        var enrollments = await _context.Enrollments
            .Where(e => e.ClassroomId == classroomId && e.IsActive)
            .OrderBy(e => e.EnrolledAt)
            .ToListAsync();

        return enrollments.Select(e => new EnrollmentDto(
            e.Id,
            e.ClassroomId,
            e.StudentId,
            "", // StudentName would require join with UserService
            e.EnrolledAt,
            e.IsActive
        )).ToList();
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
