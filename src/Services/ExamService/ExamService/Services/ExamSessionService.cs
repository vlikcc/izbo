using ExamService.Data;
using ExamService.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Shared.DTOs;
using Shared.Models;
using System.Text.Json;

namespace ExamService.Services;

public interface IExamSessionService
{
    Task<StartExamResponse?> StartExamAsync(Guid examId, Guid studentId, string? ipAddress, string? userAgent);
    Task<bool> SaveAnswerAsync(Guid sessionId, Guid questionId, string answer);
    Task<ExamResultDto?> SubmitExamAsync(Guid sessionId);
    Task<ExamSessionDto?> GetSessionAsync(Guid sessionId);
    Task<List<ExamSessionDto>> GetStudentSessionsAsync(Guid studentId);
    Task<ExamResultDto?> GetResultAsync(Guid sessionId);
    Task<int> GetActiveSessionCountAsync(Guid examId);
}

public class ExamSessionService : IExamSessionService
{
    private readonly ExamDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly IHubContext<ExamHub> _hubContext;
    private readonly ILogger<ExamSessionService> _logger;

    private const string SESSION_CACHE_PREFIX = "exam_session:";
    private const string ANSWER_CACHE_PREFIX = "exam_answers:";
    private const string ACTIVE_COUNT_PREFIX = "exam_active:";

    public ExamSessionService(
        ExamDbContext context,
        IDistributedCache cache,
        IHubContext<ExamHub> hubContext,
        ILogger<ExamSessionService> logger)
    {
        _context = context;
        _cache = cache;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<StartExamResponse?> StartExamAsync(Guid examId, Guid studentId, string? ipAddress, string? userAgent)
    {
        var exam = await _context.Exams
            .Include(e => e.Questions)
            .FirstOrDefaultAsync(e => e.Id == examId);

        if (exam == null || exam.Status != ExamStatus.Published && exam.Status != ExamStatus.InProgress)
        {
            _logger.LogWarning("Cannot start exam {ExamId}: not found or not published", examId);
            return null;
        }

        if (DateTime.UtcNow < exam.StartTime)
        {
            _logger.LogWarning("Cannot start exam {ExamId}: not yet started", examId);
            return null;
        }

        if (DateTime.UtcNow > exam.EndTime)
        {
            _logger.LogWarning("Cannot start exam {ExamId}: already ended", examId);
            return null;
        }

        // Check if student already has a session
        var existingSession = await _context.ExamSessions
            .FirstOrDefaultAsync(s => s.ExamId == examId && s.StudentId == studentId);

        if (existingSession != null)
        {
            if (existingSession.Status == ExamSessionStatus.Submitted || existingSession.Status == ExamSessionStatus.Graded)
            {
                _logger.LogWarning("Student {StudentId} already submitted exam {ExamId}", studentId, examId);
                return null;
            }

            // Resume existing session
            return await ResumeSessionAsync(existingSession, exam);
        }

        // Create new session
        var session = new ExamSession
        {
            Id = Guid.NewGuid(),
            ExamId = examId,
            StudentId = studentId,
            StartedAt = DateTime.UtcNow,
            Status = ExamSessionStatus.InProgress,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        _context.ExamSessions.Add(session);

        // Update exam status if this is the first student
        if (exam.Status == ExamStatus.Published)
        {
            exam.Status = ExamStatus.InProgress;
        }

        await _context.SaveChangesAsync();

        // Cache session info
        await CacheSessionAsync(session, exam.DurationMinutes);

        // Increment active count
        await IncrementActiveCountAsync(examId);

        _logger.LogInformation("Student {StudentId} started exam {ExamId}, session {SessionId}", studentId, examId, session.Id);

        return BuildStartExamResponse(session, exam);
    }

    public async Task<bool> SaveAnswerAsync(Guid sessionId, Guid questionId, string answer)
    {
        // Save to Redis for fast access
        var cacheKey = $"{ANSWER_CACHE_PREFIX}{sessionId}";
        var answersJson = await _cache.GetStringAsync(cacheKey);
        var answers = string.IsNullOrEmpty(answersJson)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson) ?? new();

        answers[questionId.ToString()] = answer;

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(answers), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2)
        });

        _logger.LogDebug("Answer saved for session {SessionId}, question {QuestionId}", sessionId, questionId);

        return true;
    }

    public async Task<ExamResultDto?> SubmitExamAsync(Guid sessionId)
    {
        var session = await _context.ExamSessions
            .Include(s => s.Exam)
            .ThenInclude(e => e!.Questions)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null || session.Status != ExamSessionStatus.InProgress)
        {
            _logger.LogWarning("Cannot submit session {SessionId}: not found or not in progress", sessionId);
            return null;
        }

        // Get answers from cache
        var cacheKey = $"{ANSWER_CACHE_PREFIX}{sessionId}";
        var answersJson = await _cache.GetStringAsync(cacheKey);
        var cachedAnswers = string.IsNullOrEmpty(answersJson)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson) ?? new();

        var totalScore = 0;
        var maxScore = 0;
        var questionResults = new List<QuestionResultDto>();

        foreach (var question in session.Exam!.Questions)
        {
            maxScore += question.Points;
            var studentAnswer = cachedAnswers.GetValueOrDefault(question.Id.ToString());
            var isCorrect = EvaluateAnswer(question, studentAnswer);
            var pointsAwarded = isCorrect ? question.Points : 0;
            totalScore += pointsAwarded;

            // Save to database
            var answer = new Answer
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                QuestionId = question.Id,
                AnswerContent = studentAnswer,
                IsCorrect = isCorrect,
                PointsAwarded = pointsAwarded,
                AnsweredAt = DateTime.UtcNow
            };
            _context.Answers.Add(answer);

            if (session.Exam.ShowResults)
            {
                questionResults.Add(new QuestionResultDto(
                    question.Id,
                    question.Content,
                    studentAnswer,
                    question.CorrectAnswer,
                    isCorrect,
                    pointsAwarded,
                    question.Points,
                    question.Explanation
                ));
            }
        }

        session.SubmittedAt = DateTime.UtcNow;
        session.TotalScore = totalScore;
        session.Percentage = maxScore > 0 ? (decimal)totalScore / maxScore * 100 : 0;
        session.IsPassed = session.Exam.PassingScore.HasValue && session.Percentage >= session.Exam.PassingScore;
        session.Status = ExamSessionStatus.Graded;

        await _context.SaveChangesAsync();

        // Decrement active count
        await DecrementActiveCountAsync(session.ExamId);

        // Clear answer cache
        await _cache.RemoveAsync(cacheKey);
        await _cache.RemoveAsync($"{SESSION_CACHE_PREFIX}{sessionId}");

        _logger.LogInformation("Session {SessionId} submitted. Score: {Score}/{MaxScore} ({Percentage}%)",
            sessionId, totalScore, maxScore, session.Percentage);

        // Notify via SignalR
        await _hubContext.Clients.User(session.StudentId.ToString())
            .SendAsync("ExamSubmitted", new { sessionId, totalScore, maxScore, percentage = session.Percentage });

        return new ExamResultDto(
            sessionId,
            session.ExamId,
            session.Exam.Title,
            totalScore,
            maxScore,
            session.Percentage ?? 0,
            session.IsPassed,
            session.SubmittedAt ?? DateTime.UtcNow,
            session.Exam.ShowResults ? questionResults : null
        );
    }

    public async Task<ExamSessionDto?> GetSessionAsync(Guid sessionId)
    {
        var session = await _context.ExamSessions
            .Include(s => s.Exam)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null) return null;

        return MapToDto(session);
    }

    public async Task<List<ExamSessionDto>> GetStudentSessionsAsync(Guid studentId)
    {
        var sessions = await _context.ExamSessions
            .Include(s => s.Exam)
            .Where(s => s.StudentId == studentId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return sessions.Select(MapToDto).ToList();
    }

    public async Task<ExamResultDto?> GetResultAsync(Guid sessionId)
    {
        var session = await _context.ExamSessions
            .Include(s => s.Exam)
            .Include(s => s.Answers)
            .ThenInclude(a => a.Question)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null || session.Status != ExamSessionStatus.Graded)
            return null;

        var questionResults = session.Exam!.ShowResults
            ? session.Answers.Select(a => new QuestionResultDto(
                a.QuestionId,
                a.Question!.Content,
                a.AnswerContent,
                a.Question.CorrectAnswer,
                a.IsCorrect ?? false,
                a.PointsAwarded ?? 0,
                a.Question.Points,
                a.Question.Explanation
            )).ToList()
            : null;

        return new ExamResultDto(
            sessionId,
            session.ExamId,
            session.Exam!.Title,
            session.TotalScore ?? 0,
            session.Exam.TotalPoints,
            session.Percentage ?? 0,
            session.IsPassed,
            session.SubmittedAt ?? DateTime.UtcNow,
            questionResults
        );
    }

    public async Task<int> GetActiveSessionCountAsync(Guid examId)
    {
        var countStr = await _cache.GetStringAsync($"{ACTIVE_COUNT_PREFIX}{examId}");
        return int.TryParse(countStr, out var count) ? count : 0;
    }

    private async Task<StartExamResponse> ResumeSessionAsync(ExamSession session, Exam exam)
    {
        // Calculate remaining time
        var elapsedMinutes = (DateTime.UtcNow - session.StartedAt!.Value).TotalMinutes;
        var remainingMinutes = Math.Max(0, exam.DurationMinutes - elapsedMinutes);

        // Get saved answers from cache
        var cacheKey = $"{ANSWER_CACHE_PREFIX}{session.Id}";
        var answersJson = await _cache.GetStringAsync(cacheKey);

        _logger.LogInformation("Student {StudentId} resuming exam {ExamId}, {RemainingMinutes} minutes remaining",
            session.StudentId, exam.Id, remainingMinutes);

        return BuildStartExamResponse(session, exam, (int)(remainingMinutes * 60));
    }

    private StartExamResponse BuildStartExamResponse(ExamSession session, Exam exam, int? remainingSeconds = null)
    {
        var questions = exam.Questions.OrderBy(q => q.OrderIndex).ToList();

        if (exam.ShuffleQuestions)
        {
            questions = questions.OrderBy(_ => Guid.NewGuid()).ToList();
        }

        var questionDtos = questions.Select(q =>
        {
            var options = !string.IsNullOrEmpty(q.Options)
                ? JsonSerializer.Deserialize<List<string>>(q.Options)
                : null;

            if (exam.ShuffleOptions && options != null)
            {
                options = options.OrderBy(_ => Guid.NewGuid()).ToList();
            }

            return new QuestionDto(
                q.Id,
                q.ExamId,
                q.OrderIndex,
                q.Type.ToString(),
                q.Content,
                q.ImageUrl,
                options,
                q.Points,
                null // Don't show explanation during exam
            );
        }).ToList();

        var expiresAt = session.StartedAt!.Value.AddMinutes(exam.DurationMinutes);
        var remaining = remainingSeconds ?? (int)(expiresAt - DateTime.UtcNow).TotalSeconds;

        return new StartExamResponse(session.Id, questionDtos, expiresAt, Math.Max(0, remaining));
    }

    private async Task CacheSessionAsync(ExamSession session, int durationMinutes)
    {
        var cacheKey = $"{SESSION_CACHE_PREFIX}{session.Id}";
        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(new
        {
            session.Id,
            session.ExamId,
            session.StudentId,
            session.StartedAt,
            ExpiresAt = session.StartedAt!.Value.AddMinutes(durationMinutes)
        }), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(durationMinutes + 30)
        });
    }

    private async Task IncrementActiveCountAsync(Guid examId)
    {
        var cacheKey = $"{ACTIVE_COUNT_PREFIX}{examId}";
        var countStr = await _cache.GetStringAsync(cacheKey);
        var count = int.TryParse(countStr, out var c) ? c : 0;
        await _cache.SetStringAsync(cacheKey, (count + 1).ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(4)
        });
    }

    private async Task DecrementActiveCountAsync(Guid examId)
    {
        var cacheKey = $"{ACTIVE_COUNT_PREFIX}{examId}";
        var countStr = await _cache.GetStringAsync(cacheKey);
        var count = int.TryParse(countStr, out var c) ? c : 0;
        await _cache.SetStringAsync(cacheKey, Math.Max(0, count - 1).ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(4)
        });
    }

    private bool EvaluateAnswer(Question question, string? studentAnswer)
    {
        if (string.IsNullOrEmpty(studentAnswer) || string.IsNullOrEmpty(question.CorrectAnswer))
            return false;

        return question.Type switch
        {
            QuestionType.MultipleChoice => studentAnswer.Trim().Equals(question.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase),
            QuestionType.TrueFalse => studentAnswer.Trim().Equals(question.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase),
            QuestionType.FillInBlank => studentAnswer.Trim().Equals(question.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase),
            QuestionType.Essay => false, // Manual grading required
            _ => false
        };
    }

    private static ExamSessionDto MapToDto(ExamSession s) => new(
        s.Id,
        s.ExamId,
        s.Exam?.Title ?? "",
        s.StudentId,
        "", // StudentName - would need join
        s.StartedAt,
        s.SubmittedAt,
        s.TotalScore,
        s.Percentage,
        s.IsPassed,
        s.Status.ToString()
    );
}
