using HomeworkService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace HomeworkService.Services;

public interface IHomeworkManagementService
{
    Task<HomeworkDto?> CreateHomeworkAsync(CreateHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<HomeworkDto?> GetHomeworkAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<HomeworkDto>> GetHomeworksAsync(Guid? classroomId, PagedRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<HomeworkDto?> UpdateHomeworkAsync(Guid id, UpdateHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteHomeworkAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<SubmissionDto?> SubmitHomeworkAsync(Guid homeworkId, SubmitHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<SubmissionDto?> GetSubmissionAsync(Guid homeworkId, Guid studentId, CancellationToken cancellationToken = default);
    Task<List<SubmissionDto>?> GetSubmissionsAsync(Guid homeworkId, Caller caller, CancellationToken cancellationToken = default);
    Task<SubmissionDto?> GradeSubmissionAsync(Guid submissionId, GradeSubmissionRequest request, Caller caller, CancellationToken cancellationToken = default);
}

public class HomeworkManagementService : IHomeworkManagementService
{
    private readonly HomeworkDbContext _context;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<HomeworkManagementService> _logger;

    public HomeworkManagementService(
        HomeworkDbContext context,
        IClassroomAccessClient classroomAccess,
        ILogger<HomeworkManagementService> logger)
    {
        _context = context;
        _classroomAccess = classroomAccess;
        _logger = logger;
    }

    public async Task<HomeworkDto?> CreateHomeworkAsync(CreateHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _classroomAccess.CanManageAsync(request.ClassroomId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to create homework in classroom {ClassroomId} they do not teach",
                caller.UserId, request.ClassroomId);
            return null;
        }

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
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Homework {HomeworkId} created for classroom {ClassroomId}", homework.Id, request.ClassroomId);

        return MapToDto(homework);
    }

    public async Task<HomeworkDto?> GetHomeworkAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var homework = await _context.Homeworks
            .AsNoTracking()
            .Where(h => h.Id == id)
            .Select(h => new
            {
                h.Id,
                h.ClassroomId,
                h.Title,
                h.Description,
                h.AttachmentUrl,
                h.MaxScore,
                h.DueDate,
                h.AllowLateSubmission,
                h.LatePenaltyPercent,
                SubmissionCount = h.Submissions.Count,
                h.IsActive,
                h.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (homework == null) return null;

        if (!await _classroomAccess.CanViewAsync(homework.ClassroomId, caller, cancellationToken))
        {
            return null;
        }

        return new HomeworkDto(
            homework.Id, homework.ClassroomId, string.Empty, homework.Title, homework.Description,
            homework.AttachmentUrl, homework.MaxScore, homework.DueDate, homework.AllowLateSubmission,
            homework.LatePenaltyPercent, homework.SubmissionCount, homework.IsActive, homework.CreatedAt);
    }

    public async Task<PagedResponse<HomeworkDto>> GetHomeworksAsync(Guid? classroomId, PagedRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Homeworks
            .AsNoTracking()
            .Where(h => h.IsActive);

        if (classroomId.HasValue)
        {
            if (!await _classroomAccess.CanViewAsync(classroomId.Value, caller, cancellationToken))
            {
                return EmptyPage(request);
            }

            query = query.Where(h => h.ClassroomId == classroomId.Value);
        }
        else
        {
            // Without an explicit classroom, results are limited to the caller's own classrooms so the
            // endpoint cannot be used to enumerate every assignment on the platform.
            var accessible = await _classroomAccess.GetAccessibleClassroomIdsAsync(caller, cancellationToken);
            if (accessible is not null)
            {
                if (accessible.Count == 0)
                {
                    return EmptyPage(request);
                }

                var ids = accessible.ToList();
                query = query.Where(h => ids.Contains(h.ClassroomId));
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(h => h.DueDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(h => new HomeworkDto(
                h.Id, h.ClassroomId, string.Empty, h.Title, h.Description,
                h.AttachmentUrl, h.MaxScore, h.DueDate, h.AllowLateSubmission,
                h.LatePenaltyPercent, h.Submissions.Count, h.IsActive, h.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResponse<HomeworkDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<HomeworkDto?> UpdateHomeworkAsync(Guid id, UpdateHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var homework = await FindManageableHomeworkAsync(id, caller, cancellationToken);
        if (homework == null) return null;

        if (request.Title != null) homework.Title = request.Title;
        if (request.Description != null) homework.Description = request.Description;
        if (request.AttachmentUrl != null) homework.AttachmentUrl = request.AttachmentUrl;
        if (request.MaxScore.HasValue) homework.MaxScore = request.MaxScore.Value;
        if (request.DueDate.HasValue) homework.DueDate = DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc);
        if (request.AllowLateSubmission.HasValue) homework.AllowLateSubmission = request.AllowLateSubmission.Value;
        if (request.LatePenaltyPercent.HasValue) homework.LatePenaltyPercent = request.LatePenaltyPercent.Value;

        homework.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(homework);
    }

    public async Task<bool> DeleteHomeworkAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var homework = await FindManageableHomeworkAsync(id, caller, cancellationToken);
        if (homework == null) return false;

        homework.IsActive = false;
        homework.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Homework {HomeworkId} deactivated by {UserId}", id, caller.UserId);
        return true;
    }

    public async Task<SubmissionDto?> SubmitHomeworkAsync(Guid homeworkId, SubmitHomeworkRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        var homework = await _context.Homeworks
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == homeworkId, cancellationToken);

        if (homework == null || !homework.IsActive) return null;

        // Only members of the classroom may submit; anyone else is told the assignment is unavailable.
        if (!await _classroomAccess.CanViewAsync(homework.ClassroomId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to submit homework {HomeworkId} without access to classroom {ClassroomId}",
                caller.UserId, homeworkId, homework.ClassroomId);
            return null;
        }

        var studentId = caller.UserId;
        var isLate = DateTime.UtcNow > homework.DueDate;

        if (isLate && !homework.AllowLateSubmission)
        {
            _logger.LogWarning("Late submission not allowed for homework {HomeworkId}", homeworkId);
            return null;
        }

        var submission = await _context.Submissions
            .FirstOrDefaultAsync(s => s.HomeworkId == homeworkId && s.StudentId == studentId, cancellationToken);

        if (submission != null)
        {
            // Re-submitting after grading would silently invalidate the recorded score.
            if (submission.Status == SubmissionStatus.Graded)
            {
                _logger.LogWarning(
                    "Student {StudentId} attempted to resubmit already graded homework {HomeworkId}",
                    studentId, homeworkId);
                return null;
            }

            submission.Content = request.Content;
            submission.FileUrl = request.FileUrl;
            submission.SubmittedAt = DateTime.UtcNow;
            submission.Status = isLate ? SubmissionStatus.Late : SubmissionStatus.Submitted;
        }
        else
        {
            submission = new HomeworkSubmission
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
            _context.Submissions.Add(submission);
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Homework {HomeworkId} submitted by student {StudentId}", homeworkId, studentId);

        return MapSubmissionToDto(submission);
    }

    public async Task<SubmissionDto?> GetSubmissionAsync(Guid homeworkId, Guid studentId, CancellationToken cancellationToken = default)
    {
        var submission = await _context.Submissions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.HomeworkId == homeworkId && s.StudentId == studentId, cancellationToken);

        return submission != null ? MapSubmissionToDto(submission) : null;
    }

    public async Task<List<SubmissionDto>?> GetSubmissionsAsync(Guid homeworkId, Caller caller, CancellationToken cancellationToken = default)
    {
        // The submission list exposes every student's work, so it is restricted to the owning instructor.
        var homework = await FindManageableHomeworkAsync(homeworkId, caller, cancellationToken, track: false);
        if (homework == null) return null;

        return await _context.Submissions
            .AsNoTracking()
            .Where(s => s.HomeworkId == homeworkId)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new SubmissionDto(
                s.Id, s.HomeworkId, s.StudentId, string.Empty, s.Content, s.FileUrl,
                s.Score, s.Feedback, s.Status.ToString(), s.SubmittedAt, s.GradedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<SubmissionDto?> GradeSubmissionAsync(Guid submissionId, GradeSubmissionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        var submission = await _context.Submissions
            .Include(s => s.Homework)
            .FirstOrDefaultAsync(s => s.Id == submissionId, cancellationToken);

        if (submission?.Homework == null) return null;

        if (!await _classroomAccess.CanManageAsync(submission.Homework.ClassroomId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to grade submission {SubmissionId} in classroom {ClassroomId} they do not teach",
                caller.UserId, submissionId, submission.Homework.ClassroomId);
            return null;
        }

        // Apply late penalty if applicable
        var finalScore = Math.Clamp(request.Score, 0, submission.Homework.MaxScore);
        if (submission.Status == SubmissionStatus.Late && submission.Homework.LatePenaltyPercent > 0)
        {
            var penalty = (int)(finalScore * submission.Homework.LatePenaltyPercent / 100.0);
            finalScore = Math.Max(0, finalScore - penalty);
        }

        submission.Score = finalScore;
        submission.Feedback = request.Feedback;
        submission.GradedAt = DateTime.UtcNow;
        submission.GradedBy = caller.UserId;
        submission.Status = SubmissionStatus.Graded;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Submission {SubmissionId} graded: {Score}", submissionId, finalScore);

        return MapSubmissionToDto(submission);
    }

    /// <summary>
    /// Loads an assignment only when the caller teaches its classroom. Assignments in other
    /// instructors' classrooms are reported as missing so they cannot be probed for.
    /// </summary>
    private async Task<Homework?> FindManageableHomeworkAsync(
        Guid homeworkId,
        Caller caller,
        CancellationToken cancellationToken,
        bool track = true)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var query = track ? _context.Homeworks : _context.Homeworks.AsNoTracking();
        var homework = await query.FirstOrDefaultAsync(h => h.Id == homeworkId, cancellationToken);

        if (homework == null) return null;

        if (await _classroomAccess.CanManageAsync(homework.ClassroomId, caller, cancellationToken))
        {
            return homework;
        }

        _logger.LogWarning(
            "User {UserId} attempted to manage homework {HomeworkId} in classroom {ClassroomId} they do not teach",
            caller.UserId, homeworkId, homework.ClassroomId);
        return null;
    }

    private static PagedResponse<HomeworkDto> EmptyPage(PagedRequest request) =>
        new([], request.Page, request.PageSize, 0, 0);

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
