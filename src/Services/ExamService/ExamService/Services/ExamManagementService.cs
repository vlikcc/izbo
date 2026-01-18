using ExamService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Shared.DTOs;
using Shared.Models;
using System.Text.Json;

namespace ExamService.Services;

public interface IExamManagementService
{
    Task<ExamDto?> CreateExamAsync(CreateExamRequest request, Guid instructorId);
    Task<ExamDto?> GetExamAsync(Guid examId);
    Task<PagedResponse<ExamDto>> GetExamsAsync(Guid? classroomId, PagedRequest request);
    Task<ExamDto?> UpdateExamAsync(Guid examId, UpdateExamRequest request);
    Task<bool> DeleteExamAsync(Guid examId);
    Task<bool> PublishExamAsync(Guid examId);
    Task<QuestionWithAnswerDto?> AddQuestionAsync(Guid examId, CreateQuestionRequest request);
    Task<List<QuestionWithAnswerDto>> GetQuestionsAsync(Guid examId);
    Task<bool> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request);
    Task<bool> DeleteQuestionAsync(Guid questionId);
}

public class ExamManagementService : IExamManagementService
{
    private readonly ExamDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ExamManagementService> _logger;

    public ExamManagementService(
        ExamDbContext context,
        IDistributedCache cache,
        ILogger<ExamManagementService> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ExamDto?> CreateExamAsync(CreateExamRequest request, Guid instructorId)
    {
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
        await _context.SaveChangesAsync();

        _logger.LogInformation("Exam {ExamId} created for classroom {ClassroomId}", exam.Id, request.ClassroomId);

        return MapToDto(exam);
    }

    public async Task<ExamDto?> GetExamAsync(Guid examId)
    {
        // Try cache first
        var cacheKey = $"exam:{examId}";
        var cached = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<ExamDto>(cached);
        }

        var exam = await _context.Exams
            .Include(e => e.Questions)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null) return null;

        var dto = MapToDto(exam);

        // Cache for 5 minutes
        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(dto), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
        });

        return dto;
    }

    public async Task<PagedResponse<ExamDto>> GetExamsAsync(Guid? classroomId, PagedRequest request)
    {
        var query = _context.Exams.Include(e => e.Questions).AsQueryable();

        if (classroomId.HasValue)
            query = query.Where(e => e.ClassroomId == classroomId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => MapToDto(e))
            .ToListAsync();

        return new PagedResponse<ExamDto>(
            items,
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)request.PageSize)
        );
    }

    public async Task<ExamDto?> UpdateExamAsync(Guid examId, UpdateExamRequest request)
    {
        var exam = await _context.Exams.FindAsync(examId);
        if (exam == null) return null;

        if (request.Title != null) exam.Title = request.Title;
        if (request.Description != null) exam.Description = request.Description;
        if (request.DurationMinutes.HasValue) exam.DurationMinutes = request.DurationMinutes.Value;
        if (request.StartTime.HasValue) exam.StartTime = request.StartTime.Value;
        if (request.EndTime.HasValue) exam.EndTime = request.EndTime.Value;
        if (request.ShuffleQuestions.HasValue) exam.ShuffleQuestions = request.ShuffleQuestions.Value;
        if (request.ShuffleOptions.HasValue) exam.ShuffleOptions = request.ShuffleOptions.Value;
        if (request.ShowResults.HasValue) exam.ShowResults = request.ShowResults.Value;
        if (request.PassingScore.HasValue) exam.PassingScore = request.PassingScore.Value;

        exam.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Invalidate cache
        await _cache.RemoveAsync($"exam:{examId}");

        return MapToDto(exam);
    }

    public async Task<bool> DeleteExamAsync(Guid examId)
    {
        var exam = await _context.Exams.FindAsync(examId);
        if (exam == null) return false;

        _context.Exams.Remove(exam);
        await _context.SaveChangesAsync();

        await _cache.RemoveAsync($"exam:{examId}");

        return true;
    }

    public async Task<bool> PublishExamAsync(Guid examId)
    {
        var exam = await _context.Exams.Include(e => e.Questions).FirstOrDefaultAsync(e => e.Id == examId);
        if (exam == null) return false;

        if (!exam.Questions.Any())
        {
            _logger.LogWarning("Cannot publish exam {ExamId}: no questions", examId);
            return false;
        }

        exam.Status = ExamStatus.Published;
        exam.TotalPoints = exam.Questions.Sum(q => q.Points);
        exam.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await _cache.RemoveAsync($"exam:{examId}");

        _logger.LogInformation("Exam {ExamId} published with {QuestionCount} questions", examId, exam.Questions.Count);

        return true;
    }

    public async Task<QuestionWithAnswerDto?> AddQuestionAsync(Guid examId, CreateQuestionRequest request)
    {
        var exam = await _context.Exams.FindAsync(examId);
        if (exam == null) return null;

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
        await _context.SaveChangesAsync();

        await _cache.RemoveAsync($"exam:{examId}");
        await _cache.RemoveAsync($"exam:{examId}:questions");

        return MapQuestionToDto(question);
    }

    public async Task<List<QuestionWithAnswerDto>> GetQuestionsAsync(Guid examId)
    {
        var cacheKey = $"exam:{examId}:questions";
        var cached = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<List<QuestionWithAnswerDto>>(cached) ?? new();
        }

        var questions = await _context.Questions
            .Where(q => q.ExamId == examId)
            .OrderBy(q => q.OrderIndex)
            .ToListAsync();

        var dtos = questions.Select(MapQuestionToDto).ToList();

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(dtos), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
        });

        return dtos;
    }

    public async Task<bool> UpdateQuestionAsync(Guid questionId, UpdateQuestionRequest request)
    {
        var question = await _context.Questions.FindAsync(questionId);
        if (question == null) return false;

        if (request.OrderIndex.HasValue) question.OrderIndex = request.OrderIndex.Value;
        if (request.Content != null) question.Content = request.Content;
        if (request.ImageUrl != null) question.ImageUrl = request.ImageUrl;
        if (request.Options != null) question.Options = JsonSerializer.Serialize(request.Options);
        if (request.CorrectAnswer != null) question.CorrectAnswer = request.CorrectAnswer;
        if (request.Points.HasValue) question.Points = request.Points.Value;
        if (request.Explanation != null) question.Explanation = request.Explanation;

        await _context.SaveChangesAsync();

        await _cache.RemoveAsync($"exam:{question.ExamId}");
        await _cache.RemoveAsync($"exam:{question.ExamId}:questions");

        return true;
    }

    public async Task<bool> DeleteQuestionAsync(Guid questionId)
    {
        var question = await _context.Questions.FindAsync(questionId);
        if (question == null) return false;

        var examId = question.ExamId;
        _context.Questions.Remove(question);
        await _context.SaveChangesAsync();

        await _cache.RemoveAsync($"exam:{examId}");
        await _cache.RemoveAsync($"exam:{examId}:questions");

        return true;
    }

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
