using ExamService.Data;
using ExamService.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using System.Text.Json;

namespace ExamService.Services;

public interface IExamSessionService
{
    Task<StartExamResponse?> StartExamAsync(Guid examId, Caller caller, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task<bool> SaveAnswerAsync(Guid sessionId, Guid questionId, string answer, Caller caller, CancellationToken cancellationToken = default);
    Task<ExamResultDto?> SubmitExamAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<ExamSessionDto?> GetSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ExamSessionDto>> GetStudentSessionsAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task<ExamResultDto?> GetResultAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default);
    Task<int> GetActiveSessionCountAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default);
}

public class ExamSessionService : IExamSessionService
{
    private readonly ExamDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly IHubContext<ExamHub> _hubContext;
    private readonly IClassroomAccessClient _classroomAccess;
    private readonly ILogger<ExamSessionService> _logger;

    private const string SESSION_CACHE_PREFIX = "exam_session:";
    private const string ANSWER_CACHE_PREFIX = "exam_answers:";
    private const string ACTIVE_COUNT_PREFIX = "exam_active:";

    public ExamSessionService(
        ExamDbContext context,
        IDistributedCache cache,
        IHubContext<ExamHub> hubContext,
        IClassroomAccessClient classroomAccess,
        ILogger<ExamSessionService> logger)
    {
        _context = context;
        _cache = cache;
        _hubContext = hubContext;
        _classroomAccess = classroomAccess;
        _logger = logger;
    }

    public async Task<StartExamResponse?> StartExamAsync(Guid examId, Caller caller, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var studentId = caller.UserId;

        var exam = await _context.Exams
            .Include(e => e.Questions)
            .FirstOrDefaultAsync(e => e.Id == examId, cancellationToken);

        if (exam == null || exam.Status != ExamStatus.Published && exam.Status != ExamStatus.InProgress)
        {
            _logger.LogWarning("Cannot start exam {ExamId}: not found or not published", examId);
            return null;
        }

        if (!await _classroomAccess.CanViewAsync(exam.ClassroomId, caller, cancellationToken))
        {
            _logger.LogWarning(
                "User {UserId} attempted to start exam {ExamId} without access to classroom {ClassroomId}",
                studentId, examId, exam.ClassroomId);
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
            .FirstOrDefaultAsync(s => s.ExamId == examId && s.StudentId == studentId, cancellationToken);

        if (existingSession != null)
        {
            if (existingSession.Status == ExamSessionStatus.Submitted || existingSession.Status == ExamSessionStatus.Graded)
            {
                _logger.LogWarning("Student {StudentId} already submitted exam {ExamId}", studentId, examId);
                return null;
            }

            // Resume existing session
            return await ResumeSessionAsync(existingSession, exam, cancellationToken);
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

        await _context.SaveChangesAsync(cancellationToken);

        // Cache session info
        await CacheSessionAsync(session, exam.DurationMinutes, cancellationToken);

        // Increment active count
        await IncrementActiveCountAsync(examId, cancellationToken);

        _logger.LogInformation("Student {StudentId} started exam {ExamId}, session {SessionId}", studentId, examId, session.Id);

        return BuildStartExamResponse(session, exam);
    }

    public async Task<bool> SaveAnswerAsync(Guid sessionId, Guid questionId, string answer, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        // Only the student sitting the exam may record answers against the session.
        var session = await _context.ExamSessions
            .AsNoTracking()
            .Where(s => s.Id == sessionId && s.StudentId == caller.UserId)
            .Select(s => new { s.Status })
            .FirstOrDefaultAsync(cancellationToken);

        if (session == null)
        {
            _logger.LogWarning(
                "User {UserId} attempted to answer exam session {SessionId} that is not theirs",
                caller.UserId, sessionId);
            return false;
        }

        if (session.Status != ExamSessionStatus.InProgress)
        {
            return false;
        }

        // Save to Redis for fast access
        var cacheKey = $"{ANSWER_CACHE_PREFIX}{sessionId}";
        var answersJson = await _cache.GetStringAsync(cacheKey, cancellationToken);
        var answers = string.IsNullOrEmpty(answersJson)
            ? []
            : JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson) ?? [];

        answers[questionId.ToString()] = answer;

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(answers), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2)
        }, cancellationToken);

        _logger.LogDebug("Answer saved for session {SessionId}, question {QuestionId}", sessionId, questionId);

        return true;
    }

    public async Task<ExamResultDto?> SubmitExamAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var session = await _context.ExamSessions
            .Include(s => s.Exam)
            .ThenInclude(e => e!.Questions)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.StudentId == caller.UserId, cancellationToken);

        if (session == null)
        {
            _logger.LogWarning(
                "User {UserId} attempted to submit exam session {SessionId} that is not theirs",
                caller.UserId, sessionId);
            return null;
        }

        if (session.Status != ExamSessionStatus.InProgress)
        {
            _logger.LogWarning("Cannot submit session {SessionId}: not in progress", sessionId);
            return null;
        }

        // Get answers from cache
        var cacheKey = $"{ANSWER_CACHE_PREFIX}{sessionId}";
        var answersJson = await _cache.GetStringAsync(cacheKey, cancellationToken);
        var cachedAnswers = string.IsNullOrEmpty(answersJson)
            ? []
            : JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson) ?? [];

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

        await _context.SaveChangesAsync(cancellationToken);

        // Decrement active count
        await DecrementActiveCountAsync(session.ExamId, cancellationToken);

        // Clear answer cache
        await _cache.RemoveAsync(cacheKey, cancellationToken);
        await _cache.RemoveAsync($"{SESSION_CACHE_PREFIX}{sessionId}", cancellationToken);

        _logger.LogInformation("Session {SessionId} submitted. Score: {Score}/{MaxScore} ({Percentage}%)",
            sessionId, totalScore, maxScore, session.Percentage);

        // Notify via SignalR
        await _hubContext.Clients.User(session.StudentId.ToString())
            .SendAsync(
                "ExamSubmitted",
                new { sessionId, totalScore, maxScore, percentage = session.Percentage },
                cancellationToken);

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

    public async Task<ExamSessionDto?> GetSessionAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await _context.ExamSessions
            .AsNoTracking()
            .Include(s => s.Exam)
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session == null) return null;

        return await CanReadSessionAsync(session, caller, cancellationToken) ? MapToDto(session) : null;
    }

    public async Task<List<ExamSessionDto>> GetStudentSessionsAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var sessions = await _context.ExamSessions
            .AsNoTracking()
            .Include(s => s.Exam)
            .Where(s => s.StudentId == studentId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        return sessions.Select(MapToDto).ToList();
    }

    public async Task<ExamResultDto?> GetResultAsync(Guid sessionId, Caller caller, CancellationToken cancellationToken = default)
    {
        var session = await _context.ExamSessions
            .AsNoTracking()
            .Include(s => s.Exam)
            .Include(s => s.Answers)
            .ThenInclude(a => a.Question)
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session == null || session.Status != ExamSessionStatus.Graded)
            return null;

        if (!await CanReadSessionAsync(session, caller, cancellationToken))
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

    public async Task<int> GetActiveSessionCountAsync(Guid examId, Caller caller, CancellationToken cancellationToken = default)
    {
        var classroomIds = await _context.Exams
            .AsNoTracking()
            .Where(e => e.Id == examId)
            .Select(e => e.ClassroomId)
            .ToListAsync(cancellationToken);

        if (classroomIds.Count == 0 ||
            !await _classroomAccess.CanManageAsync(classroomIds[0], caller, cancellationToken))
        {
            return 0;
        }

        var countStr = await _cache.GetStringAsync($"{ACTIVE_COUNT_PREFIX}{examId}", cancellationToken);
        return int.TryParse(countStr, out var count) ? count : 0;
    }

    /// <summary>
    /// A session may be read by the student who sat it, or by an instructor who teaches the exam's
    /// classroom. Any other caller is told the session does not exist.
    /// </summary>
    private async Task<bool> CanReadSessionAsync(ExamSession session, Caller caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (session.StudentId == caller.UserId)
        {
            return true;
        }

        if (session.Exam is not null &&
            await _classroomAccess.CanManageAsync(session.Exam.ClassroomId, caller, cancellationToken))
        {
            return true;
        }

        _logger.LogWarning(
            "User {UserId} attempted to read exam session {SessionId} belonging to {StudentId}",
            caller.UserId, session.Id, session.StudentId);
        return false;
    }

    private async Task<StartExamResponse> ResumeSessionAsync(ExamSession session, Exam exam, CancellationToken cancellationToken)
    {
        // Calculate remaining time
        var elapsedMinutes = (DateTime.UtcNow - session.StartedAt!.Value).TotalMinutes;
        var remainingMinutes = Math.Max(0, exam.DurationMinutes - elapsedMinutes);

        await CacheSessionAsync(session, exam.DurationMinutes, cancellationToken);

        _logger.LogInformation("Student {StudentId} resuming exam {ExamId}, {RemainingMinutes} minutes remaining",
            session.StudentId, exam.Id, remainingMinutes);

        return BuildStartExamResponse(session, exam, (int)(remainingMinutes * 60));
    }

    private static StartExamResponse BuildStartExamResponse(ExamSession session, Exam exam, int? remainingSeconds = null)
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

    private async Task CacheSessionAsync(ExamSession session, int durationMinutes, CancellationToken cancellationToken)
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
        }, cancellationToken);
    }

    private Task IncrementActiveCountAsync(Guid examId, CancellationToken cancellationToken) =>
        AdjustActiveCountAsync(examId, delta: 1, cancellationToken);

    private Task DecrementActiveCountAsync(Guid examId, CancellationToken cancellationToken) =>
        AdjustActiveCountAsync(examId, delta: -1, cancellationToken);

    private async Task AdjustActiveCountAsync(Guid examId, int delta, CancellationToken cancellationToken)
    {
        var cacheKey = $"{ACTIVE_COUNT_PREFIX}{examId}";
        var countStr = await _cache.GetStringAsync(cacheKey, cancellationToken);
        var count = int.TryParse(countStr, out var c) ? c : 0;

        await _cache.SetStringAsync(
            cacheKey,
            Math.Max(0, count + delta).ToString(System.Globalization.CultureInfo.InvariantCulture),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(4) },
            cancellationToken);
    }

    private static bool EvaluateAnswer(Question question, string? studentAnswer)
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
