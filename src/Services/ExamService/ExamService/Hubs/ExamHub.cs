using ExamService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;
using Shared.Models;
using Shared.Subscription;

namespace ExamService.Hubs;

/// <summary>
/// Exam answer synchronisation and presenter-led live quizzes.
///
/// Presenter commands (advancing questions, revealing answers, ending the quiz) are restricted to the
/// instructor who started the quiz, and participation is restricted to members of the exam's classroom.
/// Both used to be open to any authenticated connection that knew an exam id.
/// </summary>
[Authorize]
public class ExamHub : Hub
{
    private readonly ILiveQuizStore _quizzes;
    private readonly IExamManagementService _exams;
    private readonly IQuotaGuard _quotaGuard;
    private readonly ILogger<ExamHub> _logger;

    public ExamHub(ILiveQuizStore quizzes, IExamManagementService exams, IQuotaGuard quotaGuard, ILogger<ExamHub> logger)
    {
        _quizzes = quizzes;
        _exams = exams;
        _quotaGuard = quotaGuard;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (!Context.User.TryGetCaller(out var caller))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(caller.UserId));
        _logger.LogInformation("User {UserId} connected to ExamHub", caller.UserId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var (quiz, userId) in _quizzes.RemoveConnection(Context.ConnectionId))
        {
            await Clients.Client(quiz.PresenterConnectionId).SendAsync(
                LiveQuizEvents.ParticipantLeft, new { userId, participantCount = quiz.ParticipantCount });
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribes to an exam's announcements. Restricted to the classroom's members so that an exam id
    /// alone does not reveal that the exam exists, or leak what the instructor broadcasts about it.
    /// </summary>
    public async Task JoinExam(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        var access = await _exams.GetExamAccessAsync(examGuid, caller, Context.ConnectionAborted);
        if (access?.CanView != true)
        {
            throw new HubException("You do not have access to this exam.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, ExamGroup(examGuid));
    }

    public Task LeaveExam(string examId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ExamGroup(ParseId(examId)));

    /// <summary>Echoes a saved answer to the student's other devices, and only to those.</summary>
    public Task AnswerSaved(string sessionId, string questionId)
    {
        var caller = Caller();
        return Clients.Group(UserGroup(caller.UserId)).SendAsync("AnswerSynced", new { sessionId, questionId });
    }

    public Task Heartbeat(string sessionId) => Clients.Caller.SendAsync("HeartbeatAck", DateTime.UtcNow);

    public async Task<string> StartLiveQuiz(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        var access = await _exams.GetExamAccessAsync(examGuid, caller, Context.ConnectionAborted);
        if (access?.IsInstructor != true)
        {
            _logger.LogWarning(
                "User {UserId} attempted to present a live quiz for exam {ExamId} they do not own",
                caller.UserId, examGuid);
            throw new HubException("Only the exam's instructor can present it.");
        }

        try
        {
            await _quotaGuard.EnsureFeatureAsync("live_quiz", Context.ConnectionAborted);
        }
        catch (QuotaExceededException ex)
        {
            throw new HubException(ex.Message);
        }

        // The quiz grades answers itself, so it takes the questions with their keys. Only the
        // instructor may read those, which the access check above already established.
        var questions = await _exams.GetQuestionsAsync(examGuid, caller, Context.ConnectionAborted);
        if (questions is not { Count: > 0 })
        {
            throw new HubException("Bu sınavda soru yok.");
        }

        var quiz = _quizzes.Start(examGuid, caller.UserId, Context.ConnectionId, questions
            .OrderBy(q => q.OrderIndex)
            .Select(ToLiveQuestion)
            .ToList());
        await Groups.AddToGroupAsync(Context.ConnectionId, QuizGroup(examGuid));

        _logger.LogInformation("Live quiz started for exam {ExamId}", examGuid);

        return quiz.Code;
    }

    public async Task EndLiveQuiz(string examId)
    {
        var quiz = RequirePresenter(examId);
        var leaderboard = quiz.Leaderboard(take: int.MaxValue);
        var totalQuestions = quiz.Questions.Count;

        _quizzes.End(quiz.ExamId);

        await Clients.Client(quiz.PresenterConnectionId).SendAsync(
            LiveQuizEvents.QuizEnded, new { leaderboard, totalQuestions });

        // Each participant gets their own standing alongside the shared leaderboard.
        foreach (var (connectionId, rank, score) in quiz.Standings())
        {
            await Clients.Client(connectionId).SendAsync(
                LiveQuizEvents.QuizEnded, new { leaderboard, totalQuestions, rank, totalScore = score });
        }

        _logger.LogInformation("Live quiz ended for exam {ExamId}", quiz.ExamId);
    }

    public async Task JoinQuiz(string quizCode)
    {
        var caller = Caller();

        // Failures are thrown rather than sent as a separate message so the client's join call itself
        // fails and it does not show a joined screen for a quiz it never entered.
        if (!_quizzes.TryGetByCode(quizCode, out var quiz))
        {
            throw new HubException("Quiz bulunamadı. Kodu kontrol edin.");
        }

        // Knowing the code is not sufficient: a quiz belongs to a classroom, and only its members may
        // take part. Otherwise a leaked code would expose the quiz to the whole platform.
        var access = await _exams.GetExamAccessAsync(quiz.ExamId, caller, Context.ConnectionAborted);
        if (access?.CanView != true)
        {
            throw new HubException("Bu quizin sınıfına kayıtlı değilsiniz.");
        }

        var score = quiz.AddParticipant(caller.UserId, DisplayName(), Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, QuizGroup(quiz.ExamId));

        await Clients.Client(quiz.PresenterConnectionId).SendAsync(LiveQuizEvents.ParticipantJoined, new
        {
            userId = caller.UserId,
            userName = DisplayName(),
            score,
            participantCount = quiz.ParticipantCount
        });

        await Clients.Caller.SendAsync(LiveQuizEvents.JoinedQuiz, new
        {
            examId = quiz.ExamId,
            totalQuestions = quiz.Questions.Count,
            score
        });

        // A late joiner sees the question already open, unless its answer has been revealed.
        if (!quiz.CurrentQuestionRevealed && QuestionStartedPayload(quiz, caller.UserId) is { } current)
        {
            await Clients.Caller.SendAsync(LiveQuizEvents.QuestionStarted, current);
        }

        _logger.LogInformation("User {UserId} joined the live quiz for exam {ExamId}", caller.UserId, quiz.ExamId);
    }

    public async Task LeaveQuiz(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, QuizGroup(examGuid));

        if (_quizzes.TryGetByExam(examGuid, out var quiz))
        {
            quiz.RemoveParticipant(caller.UserId);
            await Clients.Client(quiz.PresenterConnectionId).SendAsync(
                LiveQuizEvents.ParticipantLeft, new { userId = caller.UserId, participantCount = quiz.ParticipantCount });
        }
    }

    public Task NextQuestion(string examId) => MoveToQuestion(examId, delta: 1);

    public Task PreviousQuestion(string examId) => MoveToQuestion(examId, delta: -1);

    public Task ShowResults(string examId)
    {
        var quiz = RequirePresenter(examId);
        quiz.RevealResults();

        return Clients.Group(QuizGroup(quiz.ExamId)).SendAsync(LiveQuizEvents.QuestionResults, new
        {
            answers = quiz.AnswerTally(),
            totalResponses = quiz.ResponseCount
        });
    }

    /// <summary>
    /// Closes the current question: everyone learns the key, each participant learns how they did, and
    /// the presenter gets the updated leaderboard.
    /// </summary>
    public async Task RevealAnswer(string examId)
    {
        var quiz = RequirePresenter(examId);
        var reveal = quiz.Reveal() ?? throw new HubException("There is no question to reveal.");

        await Clients.Group(QuizGroup(quiz.ExamId)).SendAsync(LiveQuizEvents.QuestionEnded, new
        {
            questionId = reveal.Question.Id,
            questionIndex = reveal.QuestionIndex,
            correctAnswer = reveal.CorrectLetter ?? reveal.Question.CorrectAnswer
        });

        foreach (var outcome in reveal.Outcomes.Where(o => o.ConnectionId is not null))
        {
            await Clients.Client(outcome.ConnectionId!).SendAsync(LiveQuizEvents.ScoreUpdated, new
            {
                score = outcome.Score,
                rank = outcome.Rank,
                answered = outcome.Answered,
                correct = outcome.IsCorrect,
                pointsAwarded = outcome.PointsAwarded
            });
        }

        await Clients.Client(quiz.PresenterConnectionId).SendAsync(
            LiveQuizEvents.Leaderboard, quiz.Leaderboard(take: int.MaxValue));
    }

    /// <summary>Records a participant's answer; false when it was not accepted (late, repeated, stale).</summary>
    public async Task<bool> SubmitAnswer(string examId, string questionId, string answer)
    {
        var (caller, examGuid) = Identify(examId);
        var questionGuid = ParseId(questionId);

        if (!_quizzes.TryGetByExam(examGuid, out var quiz) || !quiz.HasParticipant(caller.UserId))
        {
            throw new HubException("Join the quiz first.");
        }

        var recorded = quiz.TryRecordAnswer(caller.UserId, questionGuid, answer);
        if (recorded is null)
        {
            return false;
        }

        await Clients.Client(quiz.PresenterConnectionId).SendAsync(LiveQuizEvents.AnswerReceived, new
        {
            userId = caller.UserId,
            answer = recorded,
            responseCount = quiz.ResponseCount
        });

        return true;
    }

    public Task GetLeaderboard(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        if (!_quizzes.TryGetByExam(examGuid, out var quiz) ||
            (!quiz.IsPresenter(caller.UserId) && !quiz.HasParticipant(caller.UserId)))
        {
            throw new HubException("Join the quiz first.");
        }

        return Clients.Caller.SendAsync(LiveQuizEvents.Leaderboard, quiz.Leaderboard(take: 10));
    }

    private async Task MoveToQuestion(string examId, int delta)
    {
        var quiz = RequirePresenter(examId);
        quiz.MoveToQuestion(delta);

        if (quiz.CurrentQuestion is null)
        {
            return;
        }

        // Participants each get the question with whether they already answered it (the presenter
        // can step back to a question that was open before).
        foreach (var (connectionId, userId) in quiz.ConnectedParticipants())
        {
            await Clients.Client(connectionId).SendAsync(
                LiveQuizEvents.QuestionStarted, QuestionStartedPayload(quiz, userId));
        }
    }

    /// <summary>The open question as participants see it: no key, no explanation.</summary>
    private static object? QuestionStartedPayload(LiveQuiz quiz, Guid userId)
    {
        var question = quiz.CurrentQuestion;
        if (question is null)
        {
            return null;
        }

        return new
        {
            examId = quiz.ExamId,
            id = question.Id,
            content = question.Content,
            type = question.Type.ToString(),
            imageUrl = question.ImageUrl,
            options = question.Options,
            orderIndex = quiz.CurrentQuestionIndex + 1,
            totalQuestions = quiz.Questions.Count,
            hasAnswered = quiz.HasAnswered(userId),
            revealed = quiz.CurrentQuestionRevealed
        };
    }

    private static LiveQuizQuestion ToLiveQuestion(Shared.DTOs.QuestionWithAnswerDto question)
    {
        var type = Enum.TryParse<QuestionType>(question.Type, ignoreCase: true, out var parsed)
            ? parsed
            : QuestionType.MultipleChoice;

        // True/false questions are answered by picking one of two options even when none were stored.
        var options = question.Options is { Count: > 0 }
            ? question.Options
            : type == QuestionType.TrueFalse ? ["Doğru", "Yanlış"] : [];

        return new LiveQuizQuestion(
            question.Id, type, question.Content, question.ImageUrl, options, question.CorrectAnswer, question.Points);
    }

    /// <summary>
    /// Resolves a running quiz only for the instructor who started it. Presenter commands change what
    /// every participant sees, so a participant must not be able to issue them.
    /// </summary>
    private LiveQuiz RequirePresenter(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        if (!_quizzes.TryGetByExam(examGuid, out var quiz))
        {
            throw new HubException("No live quiz is running for this exam.");
        }

        if (!quiz.IsPresenter(caller.UserId))
        {
            _logger.LogWarning(
                "User {UserId} attempted to control the live quiz of exam {ExamId}", caller.UserId, examGuid);
            throw new HubException("Only the presenter can do that.");
        }

        return quiz;
    }

    private static string UserGroup(Guid userId) => $"user_{userId}";

    private static string ExamGroup(Guid examId) => $"exam_{examId}";

    private static string QuizGroup(Guid examId) => $"quiz_{examId}";

    private static Guid ParseId(string value) =>
        Guid.TryParse(value, out var id) ? id : throw new HubException("The supplied id is not valid.");

    private (Caller Caller, Guid ExamId) Identify(string examId) => (Caller(), ParseId(examId));

    private Caller Caller() => Context.User.TryGetCaller(out var caller)
        ? caller
        : throw new HubException("The connection is not authenticated.");

    private string DisplayName()
    {
        var parts = new[] { Context.User?.FindFirst("firstName")?.Value, Context.User?.FindFirst("lastName")?.Value };
        var name = string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return string.IsNullOrWhiteSpace(name) ? "Katılımcı" : name;
    }
}
