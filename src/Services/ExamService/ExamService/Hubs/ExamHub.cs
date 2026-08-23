using ExamService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Shared.Authorization;

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
    private readonly ILogger<ExamHub> _logger;

    public ExamHub(ILiveQuizStore quizzes, IExamManagementService exams, ILogger<ExamHub> logger)
    {
        _quizzes = quizzes;
        _exams = exams;
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
            await Clients.Client(quiz.PresenterConnectionId).SendAsync("ParticipantLeft", new { userId });
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

        var quiz = _quizzes.Start(examGuid, caller.UserId, Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, QuizGroup(examGuid));

        _logger.LogInformation("Live quiz started for exam {ExamId}", examGuid);

        return quiz.Code;
    }

    public async Task EndLiveQuiz(string examId)
    {
        var quiz = RequirePresenter(examId);
        var leaderboard = quiz.Leaderboard(take: int.MaxValue);

        _quizzes.End(quiz.ExamId);

        await Clients.Group(QuizGroup(quiz.ExamId)).SendAsync("QuizEnded", new
        {
            leaderboard,
            totalQuestions = quiz.CurrentQuestionIndex + 1
        });

        _logger.LogInformation("Live quiz ended for exam {ExamId}", quiz.ExamId);
    }

    public async Task JoinQuiz(string quizCode)
    {
        var caller = Caller();

        if (!_quizzes.TryGetByCode(quizCode, out var quiz))
        {
            await Clients.Caller.SendAsync("Error", "Quiz bulunamadı. Kodu kontrol edin.");
            return;
        }

        // Knowing the code is not sufficient: a quiz belongs to a classroom, and only its members may
        // take part. Otherwise a leaked code would expose the quiz to the whole platform.
        var access = await _exams.GetExamAccessAsync(quiz.ExamId, caller, Context.ConnectionAborted);
        if (access?.CanView != true)
        {
            await Clients.Caller.SendAsync("Error", "Bu quizin sınıfına kayıtlı değilsiniz.");
            return;
        }

        quiz.AddParticipant(caller.UserId, DisplayName(), Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, QuizGroup(quiz.ExamId));

        await Clients.Client(quiz.PresenterConnectionId).SendAsync("ParticipantJoined", new
        {
            userId = caller.UserId,
            userName = DisplayName(),
            connectionId = Context.ConnectionId,
            participantCount = quiz.ParticipantCount
        });

        await Clients.Caller.SendAsync("JoinedQuiz", new
        {
            examId = quiz.ExamId,
            currentQuestionIndex = quiz.CurrentQuestionIndex
        });

        _logger.LogInformation("User {UserId} joined the live quiz for exam {ExamId}", caller.UserId, quiz.ExamId);
    }

    public async Task LeaveQuiz(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, QuizGroup(examGuid));

        if (_quizzes.TryGetByExam(examGuid, out var quiz))
        {
            quiz.RemoveParticipant(caller.UserId);
            await Clients.Client(quiz.PresenterConnectionId).SendAsync("ParticipantLeft", new { userId = caller.UserId });
        }
    }

    public Task NextQuestion(string examId) => MoveToQuestion(examId, delta: 1);

    public Task PreviousQuestion(string examId) => MoveToQuestion(examId, delta: -1);

    public Task ShowResults(string examId)
    {
        var quiz = RequirePresenter(examId);
        quiz.RevealResults();

        return Clients.Group(QuizGroup(quiz.ExamId)).SendAsync("QuestionResults", new
        {
            answers = quiz.AnswerTally(),
            totalResponses = quiz.ResponseCount
        });
    }

    public Task RevealAnswer(string examId)
    {
        var quiz = RequirePresenter(examId);

        return Clients.Group(QuizGroup(quiz.ExamId)).SendAsync("AnswerRevealed", new
        {
            questionIndex = quiz.CurrentQuestionIndex
        });
    }

    public async Task SubmitAnswer(string examId, string questionId, string answer)
    {
        var (caller, examGuid) = Identify(examId);

        if (!_quizzes.TryGetByExam(examGuid, out var quiz) || !quiz.HasParticipant(caller.UserId))
        {
            throw new HubException("Join the quiz first.");
        }

        if (!quiz.TryRecordAnswer(caller.UserId, answer))
        {
            return;
        }

        await Clients.Client(quiz.PresenterConnectionId).SendAsync("AnswerReceived", new
        {
            userId = caller.UserId,
            answer
        });
    }

    public Task GetLeaderboard(string examId)
    {
        var (caller, examGuid) = Identify(examId);

        if (!_quizzes.TryGetByExam(examGuid, out var quiz) ||
            (!quiz.IsPresenter(caller.UserId) && !quiz.HasParticipant(caller.UserId)))
        {
            throw new HubException("Join the quiz first.");
        }

        return Clients.Caller.SendAsync("Leaderboard", quiz.Leaderboard(take: 10));
    }

    private Task MoveToQuestion(string examId, int delta)
    {
        var quiz = RequirePresenter(examId);

        return Clients.Group(QuizGroup(quiz.ExamId)).SendAsync("QuestionChanged", new
        {
            questionIndex = quiz.MoveToQuestion(delta)
        });
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
