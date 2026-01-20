using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ExamService.Hubs;

[Authorize]
public class ExamHub : Hub
{
    private readonly ILogger<ExamHub> _logger;

    // In-memory store for active quizzes (in production, use Redis or database)
    private static readonly Dictionary<string, LiveQuizState> _activeQuizzes = new();
    private static readonly Dictionary<string, string> _quizCodes = new(); // code -> examId
    private static readonly Dictionary<string, List<QuizParticipant>> _participants = new();

    public ExamHub(ILogger<ExamHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("User {UserId} connected to ExamHub", userId);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("User {UserId} disconnected from ExamHub", userId);

            // Remove from any active quiz participants
            foreach (var kvp in _participants)
            {
                var participant = kvp.Value.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
                if (participant != null)
                {
                    kvp.Value.Remove(participant);
                    await Clients.Group($"quiz_{kvp.Key}").SendAsync("ParticipantLeft", new { userId = participant.UserId });
                }
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinExam(string examId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"exam_{examId}");
        _logger.LogInformation("Connection {ConnectionId} joined exam {ExamId}", Context.ConnectionId, examId);
    }

    public async Task LeaveExam(string examId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"exam_{examId}");
        _logger.LogInformation("Connection {ConnectionId} left exam {ExamId}", Context.ConnectionId, examId);
    }

    // Called when a student saves an answer (for real-time sync across devices)
    public async Task AnswerSaved(string sessionId, string questionId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user_{userId}").SendAsync("AnswerSynced", new { sessionId, questionId });
    }

    // Heartbeat to track active connections
    public async Task Heartbeat(string sessionId)
    {
        await Clients.Caller.SendAsync("HeartbeatAck", DateTime.UtcNow);
    }

    #region Live Quiz Methods

    // Presenter: Start a live quiz session
    public async Task<string> StartLiveQuiz(string examId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        
        // Generate a 6-character quiz code
        var code = GenerateQuizCode();
        while (_quizCodes.ContainsKey(code))
        {
            code = GenerateQuizCode();
        }

        var state = new LiveQuizState
        {
            ExamId = examId,
            PresenterId = userId!,
            PresenterConnectionId = Context.ConnectionId,
            QuizCode = code,
            CurrentQuestionIndex = 0,
            IsActive = true,
            StartedAt = DateTime.UtcNow
        };

        _activeQuizzes[examId] = state;
        _quizCodes[code] = examId;
        _participants[examId] = new List<QuizParticipant>();

        await Groups.AddToGroupAsync(Context.ConnectionId, $"quiz_{examId}");
        
        _logger.LogInformation("Live quiz started for exam {ExamId} with code {Code}", examId, code);
        
        return code;
    }

    // Presenter: End the live quiz
    public async Task EndLiveQuiz(string examId)
    {
        if (_activeQuizzes.TryGetValue(examId, out var state))
        {
            state.IsActive = false;
            
            // Get final leaderboard
            var leaderboard = _participants.GetValueOrDefault(examId)?
                .OrderByDescending(p => p.Score)
                .Select((p, i) => new { rank = i + 1, userId = p.UserId, userName = p.UserName, score = p.Score })
                .ToList();

            await Clients.Group($"quiz_{examId}").SendAsync("QuizEnded", new 
            { 
                leaderboard,
                totalQuestions = state.CurrentQuestionIndex + 1
            });

            // Cleanup
            _quizCodes.Remove(state.QuizCode);
            _activeQuizzes.Remove(examId);
            _participants.Remove(examId);

            _logger.LogInformation("Live quiz ended for exam {ExamId}", examId);
        }
    }

    // Voter: Join a quiz using code
    public async Task JoinQuiz(string quizCode)
    {
        var code = quizCode.ToUpper();
        if (!_quizCodes.TryGetValue(code, out var examId))
        {
            await Clients.Caller.SendAsync("Error", "Quiz bulunamadı. Kodu kontrol edin.");
            return;
        }

        if (!_activeQuizzes.TryGetValue(examId, out var state) || !state.IsActive)
        {
            await Clients.Caller.SendAsync("Error", "Bu quiz artık aktif değil.");
            return;
        }

        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        var firstName = Context.User?.FindFirstValue("firstName") ?? "Katılımcı";
        var lastName = Context.User?.FindFirstValue("lastName") ?? "";
        var userName = $"{firstName} {lastName}".Trim();

        var participant = new QuizParticipant
        {
            UserId = userId!,
            UserName = userName,
            ConnectionId = Context.ConnectionId,
            Score = 0
        };

        if (!_participants.ContainsKey(examId))
            _participants[examId] = new List<QuizParticipant>();

        // Check if already joined
        if (!_participants[examId].Any(p => p.UserId == userId))
        {
            _participants[examId].Add(participant);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"quiz_{examId}");

        // Notify presenter
        await Clients.Client(state.PresenterConnectionId).SendAsync("ParticipantJoined", new
        {
            userId,
            userName,
            connectionId = Context.ConnectionId,
            participantCount = _participants[examId].Count
        });

        // Confirm to voter
        await Clients.Caller.SendAsync("JoinedQuiz", new
        {
            examId,
            currentQuestionIndex = state.CurrentQuestionIndex
        });

        _logger.LogInformation("User {UserId} joined quiz {ExamId}", userId, examId);
    }

    // Voter: Leave the quiz
    public async Task LeaveQuiz(string examId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        
        if (_participants.TryGetValue(examId, out var participants))
        {
            var participant = participants.FirstOrDefault(p => p.UserId == userId);
            if (participant != null)
            {
                participants.Remove(participant);
            }
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"quiz_{examId}");
        
        if (_activeQuizzes.TryGetValue(examId, out var state))
        {
            await Clients.Client(state.PresenterConnectionId).SendAsync("ParticipantLeft", new { userId });
        }
    }

    // Presenter: Go to next question
    public async Task NextQuestion(string examId)
    {
        if (_activeQuizzes.TryGetValue(examId, out var state))
        {
            state.CurrentQuestionIndex++;
            state.ShowingResults = false;
            state.CurrentAnswers.Clear();

            await Clients.Group($"quiz_{examId}").SendAsync("QuestionChanged", new
            {
                questionIndex = state.CurrentQuestionIndex
            });
        }
    }

    // Presenter: Go to previous question
    public async Task PreviousQuestion(string examId)
    {
        if (_activeQuizzes.TryGetValue(examId, out var state) && state.CurrentQuestionIndex > 0)
        {
            state.CurrentQuestionIndex--;
            state.ShowingResults = false;
            state.CurrentAnswers.Clear();

            await Clients.Group($"quiz_{examId}").SendAsync("QuestionChanged", new
            {
                questionIndex = state.CurrentQuestionIndex
            });
        }
    }

    // Presenter: Show results for current question
    public async Task ShowResults(string examId)
    {
        if (_activeQuizzes.TryGetValue(examId, out var state))
        {
            state.ShowingResults = true;
            
            var answerCounts = state.CurrentAnswers
                .GroupBy(a => a.Value)
                .ToDictionary(g => g.Key, g => g.Count());

            await Clients.Group($"quiz_{examId}").SendAsync("QuestionResults", new
            {
                answers = answerCounts,
                totalResponses = state.CurrentAnswers.Count
            });
        }
    }

    // Presenter: Reveal correct answer
    public async Task RevealAnswer(string examId)
    {
        if (_activeQuizzes.TryGetValue(examId, out var state))
        {
            await Clients.Group($"quiz_{examId}").SendAsync("AnswerRevealed", new
            {
                questionIndex = state.CurrentQuestionIndex
            });
        }
    }

    // Voter: Submit answer
    public async Task SubmitAnswer(string examId, string questionId, string answer)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!_activeQuizzes.TryGetValue(examId, out var state))
            return;

        // Store answer (only first answer counts)
        if (!state.CurrentAnswers.ContainsKey(userId!))
        {
            state.CurrentAnswers[userId!] = answer;

            // Notify presenter
            await Clients.Client(state.PresenterConnectionId).SendAsync("AnswerReceived", new
            {
                userId,
                answer
            });

            _logger.LogInformation("User {UserId} submitted answer {Answer} for quiz {ExamId}", userId, answer, examId);
        }
    }

    // Get current leaderboard
    public async Task GetLeaderboard(string examId)
    {
        if (_participants.TryGetValue(examId, out var participants))
        {
            var leaderboard = participants
                .OrderByDescending(p => p.Score)
                .Select((p, i) => new { rank = i + 1, userName = p.UserName, score = p.Score })
                .Take(10)
                .ToList();

            await Clients.Caller.SendAsync("Leaderboard", leaderboard);
        }
    }

    private static string GenerateQuizCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 6).Select(s => s[random.Next(s.Length)]).ToArray());
    }

    #endregion
}

// Helper classes
public class LiveQuizState
{
    public string ExamId { get; set; } = "";
    public string PresenterId { get; set; } = "";
    public string PresenterConnectionId { get; set; } = "";
    public string QuizCode { get; set; } = "";
    public int CurrentQuestionIndex { get; set; }
    public bool IsActive { get; set; }
    public bool ShowingResults { get; set; }
    public DateTime StartedAt { get; set; }
    public Dictionary<string, string> CurrentAnswers { get; set; } = new();
}

public class QuizParticipant
{
    public string UserId { get; set; } = "";
    public string UserName { get; set; } = "";
    public string ConnectionId { get; set; } = "";
    public int Score { get; set; }
}

