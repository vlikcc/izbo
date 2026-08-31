using ExamService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Subscription;
using System.Text.Json;

namespace ExamService.Services;

public interface IExamManagementService
{
    Task<ExamDto?> CreateExamAsync(CreateExamRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ExamDto?> GetExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<ExamDto>> GetExamsAsync(Guid? classroomId, PagedRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ExamDto?> UpdateExamAsync(Guid examId, UpdateExamRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> PublishExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
    Task<QuestionWithAnswerDto?> AddQuestionAsync(Guid examId, CreateQuestionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<List<QuestionWithAnswerDto>> AddQuestionsBulkAsync(Guid examId, List<CreateQuestionRequest> requests, Caller caller, CancellationToken cancellationToken = default);
    Task<List<QuestionWithAnswerDto>?> GetQuestionsAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<bool> DeleteQuestionAsync(Guid questionId, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>
    /// The caller's access to the classroom an exam belongs to, or <c>null</c> when no such exam exists.
    /// Exposed for the live-quiz hub, which authorizes presenters and participants but does not need the
    /// exam itself.
    /// </summary>
    Task<ClassroomAccess?> GetExamAccessAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
}

public class ExamManagementService : IExamManagementService
{
    private readonly ExamDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly IQuotaGuard _quotaGuard;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<ExamManagementService> _logger;

    public ExamManagementService(
        ExamDbContext context,
        IDistributedCache cache,
        IQuotaGuard quotaGuard,
        IClassroomAccessClient classroomAccess,
        ILogger<ExamManagementService> logger)
    {
        _context = context;
        _cache = cache;
        _quotaGuard = quotaGuard;
        _classroomAccess = classroomAccess;
        _logger = logger;
    }

    public async Task<ExamDto?> CreateExamAsync(CreateExamRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!await _classroomAccess.CanManageAsync(request.ClassroomId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to create an exam in classroom {ClassroomId} they do not teach",
                caller.UserId, request.ClassroomId);
            return null;
        }

        await _quotaGuard.TryConsumeAsync(QuotaMetric.ExamsCreated, ct: cancellationToken);

        var exam = new Exam
        {
            Id = Guid.NewGuid(),
            ClassroomId = request.ClassroomId,
            Title = request.Title,
            Description = request.Description,
            DurationMinutes = request.DurationMinutes,
            StartTime = DateTime.SpecifyKind(request.StartTime, DateTimeKind.Utc),
            EndTime = DateTime.SpecifyKind(request.EndTime, DateTimeKind.Utc),
            ShuffleQuestions = request.ShuffleQuestions,
            ShuffleOptions = request.ShuffleOptions,
            ShowResults = request.ShowResults,
            PassingScore = request.PassingScore,
            Status = ExamStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        _context.Exams.Add(exam);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Exam {ExamId} created for classroom {ClassroomId}", exam.Id, request.ClassroomId);

        return MapToDto(exam);
    }

    public async Task<ExamDto?> GetExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroomId = await GetExamClassroomIdAsync(examId, cancellationToken);
        if (classroomId is null || !await _classroomAccess.CanViewAsync(classroomId.Value, caller, cancellationToken))
        {
            return null;
        }

        var cacheKey = $"exam:{examId}";
        var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<ExamDto>(cached);
        }

        var dto = await _context.Exams
            .AsNoTracking()
            .Where(e => e.Id == examId)
            .Select(e => new ExamDto(
                e.Id, e.ClassroomId, string.Empty, e.Title, e.Description,
                e.DurationMinutes, e.StartTime, e.EndTime, e.TotalPoints,
                e.Questions.Count, e.ShuffleQuestions, e.ShuffleOptions,
                e.ShowResults, e.PassingScore, e.Status.ToString(), e.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        if (dto == null) return null;

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(dto), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
        }, cancellationToken);

        return dto;
    }

    public async Task<PagedResponse<ExamDto>> GetExamsAsync(Guid? classroomId, PagedRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _context.Exams.AsNoTracking();

        if (classroomId.HasValue)
        {
            if (!await _classroomAccess.CanViewAsync(classroomId.Value, caller, cancellationToken))
            {
                return EmptyPage(request);
            }

            query = query.Where(e => e.ClassroomId == classroomId.Value);
        }
        else
        {
            // Without an explicit classroom, results are limited to the caller's own classrooms so the
            // endpoint cannot be used to enumerate every exam on the platform.
            var accessible = await _classroomAccess.GetAccessibleClassroomIdsAsync(caller, cancellationToken);
            if (accessible is not null)
            {
                if (accessible.Count == 0)
                {
                    return EmptyPage(request);
                }

                var ids = accessible.ToList();
                query = query.Where(e => ids.Contains(e.ClassroomId));
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => new ExamDto(
                e.Id, e.ClassroomId, string.Empty, e.Title, e.Description,
                e.DurationMinutes, e.StartTime, e.EndTime, e.TotalPoints,
                e.Questions.Count, e.ShuffleQuestions, e.ShuffleOptions,
                e.ShowResults, e.PassingScore, e.Status.ToString(), e.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResponse<ExamDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<ExamDto?> UpdateExamAsync(Guid examId, UpdateExamRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var exam = await FindManageableExamAsync(examId, caller, cancellationToken);
        if (exam == null) return null;

        if (request.Title != null) exam.Title = request.Title;
        if (request.Description != null) exam.Description = request.Description;
        if (request.DurationMinutes.HasValue) exam.DurationMinutes = request.DurationMinutes.Value;
        if (request.StartTime.HasValue) exam.StartTime = DateTime.SpecifyKind(request.StartTime.Value, DateTimeKind.Utc);
        if (request.EndTime.HasValue) exam.EndTime = DateTime.SpecifyKind(request.EndTime.Value, DateTimeKind.Utc);
        if (request.ShuffleQuestions.HasValue) exam.ShuffleQuestions = request.ShuffleQuestions.Value;
        if (request.ShuffleOptions.HasValue) exam.ShuffleOptions = request.ShuffleOptions.Value;
        if (request.ShowResults.HasValue) exam.ShowResults = request.ShowResults.Value;
        if (request.PassingScore.HasValue) exam.PassingScore = request.PassingScore.Value;

        exam.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await InvalidateExamCacheAsync(examId, cancellationToken);

        return MapToDto(exam);
    }

    public async Task<bool> DeleteExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var exam = await FindManageableExamAsync(examId, caller, cancellationToken);
        if (exam == null) return false;

        _context.Exams.Remove(exam);
        await _context.SaveChangesAsync(cancellationToken);

        await InvalidateExamCacheAsync(examId, cancellationToken);

        _logger.LogInformation("Exam {ExamId} deleted by {UserId}", examId, caller.UserId);
        return true;
    }

    public async Task<bool> PublishExamAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var exam = await FindManageableExamAsync(examId, caller, cancellationToken, includeQuestions: true);
        if (exam == null) return false;

        if (exam.Questions.Count == 0)
        {
            _logger.LogWarning("Cannot publish exam {ExamId}: no questions", examId);
            return false;
        }

        exam.Status = ExamStatus.Published;
        exam.TotalPoints = exam.Questions.Sum(q => q.Points);
        exam.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await InvalidateExamCacheAsync(examId, cancellationToken);

        _logger.LogInformation("Exam {ExamId} published with {QuestionCount} questions", examId, exam.Questions.Count);

        return true;
    }

    public async Task<QuestionWithAnswerDto?> AddQuestionAsync(Guid examId, CreateQuestionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var exam = await FindManageableExamAsync(examId, caller, cancellationToken);
        if (exam == null) return null;

        await EnsureQuestionCapacityAsync(examId, additionalQuestions: 1);

        var question = new Question
        {
            Id = Guid.NewGuid(),
            ExamId = examId,
            OrderIndex = request.OrderIndex,
            Type = request.Type,
            Content = request.Content,
            ImageUrl = request.ImageUrl,
            Options = request.Options != null ? JsonSerializer.Serialize(request.Options) : null,
            CorrectAnswer = request.CorrectAnswer,
            Points = request.Points,
            Explanation = request.Explanation,
            CreatedAt = DateTime.UtcNow
        };

        _context.Questions.Add(question);
        await _context.SaveChangesAsync(cancellationToken);

        await InvalidateExamCacheAsync(examId, cancellationToken);

        return MapQuestionToDto(question);
    }

    /// <summary>Used by the Excel/Word question-import flow — gated behind the "question_import"
    /// plan feature, on top of the usual per-exam question ceiling.</summary>
    public async Task<List<QuestionWithAnswerDto>> AddQuestionsBulkAsync(Guid examId, List<CreateQuestionRequest> requests, Caller caller, CancellationToken cancellationToken = default)
    {
        var exam = await FindManageableExamAsync(examId, caller, cancellationToken);
        if (exam == null) return new List<QuestionWithAnswerDto>();

        await _quotaGuard.EnsureFeatureAsync("question_import", cancellationToken);
        await EnsureQuestionCapacityAsync(examId, additionalQuestions: requests.Count);

        var questions = requests.Select(request => new Question
        {
            Id = Guid.NewGuid(),
            ExamId = examId,
            OrderIndex = request.OrderIndex,
            Type = request.Type,
            Content = request.Content,
            ImageUrl = request.ImageUrl,
            Options = request.Options != null ? JsonSerializer.Serialize(request.Options) : null,
            CorrectAnswer = request.CorrectAnswer,
            Points = request.Points,
            Explanation = request.Explanation,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.Questions.AddRange(questions);
        await _context.SaveChangesAsync(cancellationToken);

        await InvalidateExamCacheAsync(examId, cancellationToken);

        return questions.Select(MapQuestionToDto).ToList();
    }

    /// <summary>Questions-per-exam is a per-resource ceiling, not a running counter, so it's compared
    /// locally against the plan's limit rather than going through TryConsumeAsync.</summary>
    private async Task EnsureQuestionCapacityAsync(Guid examId, int additionalQuestions)
    {
        var limit = await _quotaGuard.GetLimitAsync(QuotaMetric.MaxQuestionsPerExam);
        if (limit < 0) return; // unlimited

        var currentCount = await _context.Questions.CountAsync(q => q.ExamId == examId);
        if (currentCount + additionalQuestions > limit)
            throw new QuotaExceededException(QuotaMetric.MaxQuestionsPerExam, limit, currentCount,
                "Bu sınav için soru limitine ulaşıldı.");
    }

    /// <summary>
    /// Returns questions including their correct answers, so this is restricted to instructors who own
    /// the exam's classroom rather than to the Instructor role at large.
    /// </summary>
    public async Task<List<QuestionWithAnswerDto>?> GetQuestionsAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroomId = await GetExamClassroomIdAsync(examId, cancellationToken);
        if (classroomId is null || !await _classroomAccess.CanManageAsync(classroomId.Value, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to read answer keys for exam {ExamId} without owning its classroom",
                caller.UserId, examId);
            return null;
        }

        var cacheKey = QuestionsCacheKey(examId);
        var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<List<QuestionWithAnswerDto>>(cached) ?? [];
        }

        var questions = await _context.Questions
            .AsNoTracking()
            .Where(q => q.ExamId == examId)
            .OrderBy(q => q.OrderIndex)
            .ToListAsync(cancellationToken);

        var dtos = questions.Select(MapQuestionToDto).ToList();

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(dtos), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
        }, cancellationToken);

        return dtos;
    }

    public async Task<bool> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var question = await FindManageableQuestionAsync(questionId, caller, cancellationToken);
        if (question == null) return false;

        if (request.OrderIndex.HasValue) question.OrderIndex = request.OrderIndex.Value;
        if (request.Content != null) question.Content = request.Content;
        if (request.ImageUrl != null) question.ImageUrl = request.ImageUrl;
        if (request.Options != null) question.Options = JsonSerializer.Serialize(request.Options);
        if (request.CorrectAnswer != null) question.CorrectAnswer = request.CorrectAnswer;
        if (request.Points.HasValue) question.Points = request.Points.Value;
        if (request.Explanation != null) question.Explanation = request.Explanation;

        await _context.SaveChangesAsync(cancellationToken);
        await InvalidateExamCacheAsync(question.ExamId, cancellationToken);

        return true;
    }

    public async Task<bool> DeleteQuestionAsync(Guid questionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var question = await FindManageableQuestionAsync(questionId, caller, cancellationToken);
        if (question == null) return false;

        var examId = question.ExamId;
        _context.Questions.Remove(question);
        await _context.SaveChangesAsync(cancellationToken);

        await InvalidateExamCacheAsync(examId, cancellationToken);

        return true;
    }

    public async Task<ClassroomAccess?> GetExamAccessAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroomId = await GetExamClassroomIdAsync(examId, cancellationToken);

        return classroomId is null
            ? null
            : await _classroomAccess.GetAccessAsync(classroomId.Value, caller, cancellationToken);
    }

    private async Task<Guid?> GetExamClassroomIdAsync(Guid examId, CancellationToken cancellationToken)
    {
        var classroomIds = await _context.Exams
            .AsNoTracking()
            .Where(e => e.Id == examId)
            .Select(e => e.ClassroomId)
            .ToListAsync(cancellationToken);

        return classroomIds.Count > 0 ? classroomIds[0] : null;
    }

    /// <summary>
    /// Loads an exam only when the caller teaches its classroom. Exams in other instructors' classrooms
    /// are reported as missing so they cannot be probed for.
    /// </summary>
    private async Task<Exam?> FindManageableExamAsync(
        Guid examId,
        Caller caller,
        CancellationToken cancellationToken,
        bool includeQuestions = false)
    {
        IQueryable<Exam> query = _context.Exams;
        if (includeQuestions)
        {
            query = query.Include(e => e.Questions);
        }

        var exam = await query.FirstOrDefaultAsync(e => e.Id == examId, cancellationToken);
        if (exam == null) return null;

        if (await _classroomAccess.CanManageAsync(exam.ClassroomId, caller, cancellationToken))
        {
            return exam;
        }

        _logger.LogWarning(
            "User {UserId} attempted to modify exam {ExamId} in classroom {ClassroomId} they do not teach",
            caller.UserId, examId, exam.ClassroomId);
        return null;
    }

    private async Task<Question?> FindManageableQuestionAsync(Guid questionId, Caller caller, CancellationToken cancellationToken)
    {
        var question = await _context.Questions
            .Include(q => q.Exam)
            .FirstOrDefaultAsync(q => q.Id == questionId, cancellationToken);

        if (question?.Exam == null) return null;

        return await _classroomAccess.CanManageAsync(question.Exam.ClassroomId, caller, cancellationToken)
            ? question
            : null;
    }

    private async Task InvalidateExamCacheAsync(Guid examId, CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync($"exam:{examId}", cancellationToken);
        await _cache.RemoveAsync(QuestionsCacheKey(examId), cancellationToken);
    }

    private static string QuestionsCacheKey(Guid examId) => $"exam:{examId}:questions";

    private static PagedResponse<ExamDto> EmptyPage(PagedRequest request) =>
        new([], request.Page, request.PageSize, 0, 0);

    private static ExamDto MapToDto(Exam exam) => new(
        exam.Id,
        exam.ClassroomId,
        "", // ClassroomName - would need join
        exam.Title,
        exam.Description,
        exam.DurationMinutes,
        exam.StartTime,
        exam.EndTime,
        exam.TotalPoints,
        exam.Questions?.Count ?? 0,
        exam.ShuffleQuestions,
        exam.ShuffleOptions,
        exam.ShowResults,
        exam.PassingScore,
        exam.Status.ToString(),
        exam.CreatedAt
    );

    private static QuestionWithAnswerDto MapQuestionToDto(Question q) => new(
        q.Id,
        q.ExamId,
        q.OrderIndex,
        q.Type.ToString(),
        q.Content,
        q.ImageUrl,
        !string.IsNullOrEmpty(q.Options) ? JsonSerializer.Deserialize<List<string>>(q.Options) : null,
        q.CorrectAnswer,
        q.Points,
        q.Explanation
    );
}
