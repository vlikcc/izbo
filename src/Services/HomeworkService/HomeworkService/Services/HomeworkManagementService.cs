using HomeworkService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using Shared.Models;

namespace HomeworkService.Services;

public interface IHomeworkManagementService
{
    Task<HomeworkDto?> CreateHomeworkAsync(CreateHomeworkRequest request);
    Task<HomeworkDto?> GetHomeworkAsync(Guid id);
    Task<PagedResponse<HomeworkDto>> GetHomeworksAsync(Guid? classroomId, PagedRequest request);
    Task<PagedResponse<HomeworkDto>> GetStudentHomeworksAsync(Guid studentId, List<Guid> classroomIds, PagedRequest request);
    Task<HomeworkDto?> UpdateHomeworkAsync(Guid id, UpdateHomeworkRequest request);
    Task<bool> DeleteHomeworkAsync(Guid id);
    Task<SubmissionDto?> SubmitHomeworkAsync(Guid homeworkId, Guid studentId, SubmitHomeworkRequest request);
    Task<SubmissionDto?> GetSubmissionAsync(Guid homeworkId, Guid studentId);
    Task<List<SubmissionDto>> GetSubmissionsAsync(Guid homeworkId);
    Task<SubmissionDto?> GradeSubmissionAsync(Guid submissionId, GradeSubmissionRequest request, Guid gradedBy);
}

public class HomeworkManagementService : IHomeworkManagementService
{
    private readonly HomeworkDbContext _context;
    private readonly ILogger<HomeworkManagementService> _logger;

    public HomeworkManagementService(HomeworkDbContext context, ILogger<HomeworkManagementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<HomeworkDto?> CreateHomeworkAsync(CreateHomeworkRequest request)
    {
        var homework = new Homework
        {
            Id = Guid.NewGuid(),
            ClassroomId = request.ClassroomId,
            Title = request.Title,
            Description = request.Description,
            AttachmentUrl = request.AttachmentUrl,
            MaxScore = request.MaxScore,
            DueDate = DateTime.SpecifyKind(request.DueDate, DateTimeKind.Utc),
            AllowLateSubmission = request.AllowLateSubmission,
            LatePenaltyPercent = request.LatePenaltyPercent,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Homeworks.Add(homework);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Homework {HomeworkId} created for classroom {ClassroomId}", homework.Id, request.ClassroomId);

        return MapToDto(homework);
    }

    public async Task<HomeworkDto?> GetHomeworkAsync(Guid id)
    {
        var homework = await _context.Homeworks
            .Include(h => h.Submissions)
            .FirstOrDefaultAsync(h => h.Id == id);

        return homework != null ? MapToDto(homework) : null;
    }

    public async Task<PagedResponse<HomeworkDto>> GetHomeworksAsync(Guid? classroomId, PagedRequest request)
    {
        var query = _context.Homeworks
            .Include(h => h.Submissions)
            .Where(h => h.IsActive);

        if (classroomId.HasValue)
            query = query.Where(h => h.ClassroomId == classroomId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(h => h.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(h => MapToDto(h))
            .ToListAsync();

        return new PagedResponse<HomeworkDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<PagedResponse<HomeworkDto>> GetStudentHomeworksAsync(Guid studentId, List<Guid> classroomIds, PagedRequest request)
    {
        var query = _context.Homeworks
            .Include(h => h.Submissions.Where(s => s.StudentId == studentId))
            .Where(h => h.IsActive && classroomIds.Contains(h.ClassroomId));

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(h => h.DueDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(h => MapToDto(h))
            .ToListAsync();

        return new PagedResponse<HomeworkDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<HomeworkDto?> UpdateHomeworkAsync(Guid id, UpdateHomeworkRequest request)
    {
        var homework = await _context.Homeworks.FindAsync(id);
        if (homework == null) return null;

        if (request.Title != null) homework.Title = request.Title;
        if (request.Description != null) homework.Description = request.Description;
        if (request.AttachmentUrl != null) homework.AttachmentUrl = request.AttachmentUrl;
        if (request.MaxScore.HasValue) homework.MaxScore = request.MaxScore.Value;
        if (request.DueDate.HasValue) homework.DueDate = request.DueDate.Value;
        if (request.AllowLateSubmission.HasValue) homework.AllowLateSubmission = request.AllowLateSubmission.Value;
        if (request.LatePenaltyPercent.HasValue) homework.LatePenaltyPercent = request.LatePenaltyPercent.Value;

        homework.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapToDto(homework);
    }

    public async Task<bool> DeleteHomeworkAsync(Guid id)
    {
        var homework = await _context.Homeworks.FindAsync(id);
        if (homework == null) return false;

        homework.IsActive = false;
        homework.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<SubmissionDto?> SubmitHomeworkAsync(Guid homeworkId, Guid studentId, SubmitHomeworkRequest request)
    {
        var homework = await _context.Homeworks.FindAsync(homeworkId);
        if (homework == null || !homework.IsActive) return null;

        var existingSubmission = await _context.Submissions
            .FirstOrDefaultAsync(s => s.HomeworkId == homeworkId && s.StudentId == studentId);

        var isLate = DateTime.UtcNow > homework.DueDate;

        if (isLate && !homework.AllowLateSubmission)
        {
            _logger.LogWarning("Late submission not allowed for homework {HomeworkId}", homeworkId);
            return null;
        }

        if (existingSubmission != null)
        {
            // Update existing submission
            existingSubmission.Content = request.Content;
            existingSubmission.FileUrl = request.FileUrl;
            existingSubmission.SubmittedAt = DateTime.UtcNow;
            existingSubmission.Status = isLate ? SubmissionStatus.Late : SubmissionStatus.Submitted;
        }
        else
        {
            existingSubmission = new HomeworkSubmission
            {
                Id = Guid.NewGuid(),
                HomeworkId = homeworkId,
                StudentId = studentId,
                Content = request.Content,
                FileUrl = request.FileUrl,
                SubmittedAt = DateTime.UtcNow,
                Status = isLate ? SubmissionStatus.Late : SubmissionStatus.Submitted,
                CreatedAt = DateTime.UtcNow
            };
            _context.Submissions.Add(existingSubmission);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Homework {HomeworkId} submitted by student {StudentId}", homeworkId, studentId);

        return MapSubmissionToDto(existingSubmission);
    }

    public async Task<SubmissionDto?> GetSubmissionAsync(Guid homeworkId, Guid studentId)
    {
        var submission = await _context.Submissions
            .FirstOrDefaultAsync(s => s.HomeworkId == homeworkId && s.StudentId == studentId);

        return submission != null ? MapSubmissionToDto(submission) : null;
    }

    public async Task<List<SubmissionDto>> GetSubmissionsAsync(Guid homeworkId)
    {
        var submissions = await _context.Submissions
            .Where(s => s.HomeworkId == homeworkId)
            .OrderByDescending(s => s.SubmittedAt)
            .ToListAsync();

        return submissions.Select(MapSubmissionToDto).ToList();
    }

    public async Task<SubmissionDto?> GradeSubmissionAsync(Guid submissionId, GradeSubmissionRequest request, Guid gradedBy)
    {
        var submission = await _context.Submissions
            .Include(s => s.Homework)
            .FirstOrDefaultAsync(s => s.Id == submissionId);

        if (submission == null) return null;

        // Apply late penalty if applicable
        var finalScore = request.Score;
        if (submission.Status == SubmissionStatus.Late && submission.Homework!.LatePenaltyPercent > 0)
        {
            var penalty = (int)(request.Score * submission.Homework.LatePenaltyPercent / 100.0);
            finalScore = Math.Max(0, request.Score - penalty);
        }

        submission.Score = finalScore;
        submission.Feedback = request.Feedback;
        submission.GradedAt = DateTime.UtcNow;
        submission.GradedBy = gradedBy;
        submission.Status = SubmissionStatus.Graded;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Submission {SubmissionId} graded: {Score}", submissionId, finalScore);

        return MapSubmissionToDto(submission);
    }

    private static HomeworkDto MapToDto(Homework h) => new(
        h.Id,
        h.ClassroomId,
        "", // ClassroomName
        h.Title,
        h.Description,
        h.AttachmentUrl,
        h.MaxScore,
        h.DueDate,
        h.AllowLateSubmission,
        h.LatePenaltyPercent,
        h.Submissions?.Count ?? 0,
        h.IsActive,
        h.CreatedAt
    );

    private static SubmissionDto MapSubmissionToDto(HomeworkSubmission s) => new(
        s.Id,
        s.HomeworkId,
        s.StudentId,
        "", // StudentName
        s.Content,
        s.FileUrl,
        s.Score,
        s.Feedback,
        s.Status.ToString(),
        s.SubmittedAt,
        s.GradedAt
    );
}
