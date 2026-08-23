using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace ExamService.Services;

/// <summary>
/// A presenter-led quiz that participants join with a short code.
/// </summary>
public sealed class LiveQuiz
{
    private readonly ConcurrentDictionary<Guid, Participant> _participants = new();
    private readonly ConcurrentDictionary<Guid, string> _answers = new();

    internal LiveQuiz(Guid examId, Guid presenterId, string presenterConnectionId, string code)
    {
        ExamId = examId;
        PresenterId = presenterId;
        PresenterConnectionId = presenterConnectionId;
        Code = code;
        StartedAt = DateTime.UtcNow;
    }

    public Guid ExamId { get; }

    public Guid PresenterId { get; }

    public string PresenterConnectionId { get; }

    public string Code { get; }

    public DateTime StartedAt { get; }

    public int CurrentQuestionIndex { get; private set; }

    public bool ShowingResults { get; private set; }

    public int ParticipantCount => _participants.Count;

    public bool IsPresenter(Guid userId) => PresenterId == userId;

    public bool HasParticipant(Guid userId) => _participants.ContainsKey(userId);

    public void AddParticipant(Guid userId, string userName, string connectionId) =>
        _participants.AddOrUpdate(
            userId,
            _ => new Participant(userName, connectionId, Score: 0),
            (_, existing) => existing with { ConnectionId = connectionId });

    public void RemoveParticipant(Guid userId) => _participants.TryRemove(userId, out _);

    /// <summary>Drops whichever participant holds a connection, and reports who it was.</summary>
    public Guid? RemoveConnection(string connectionId)
    {
        foreach (var (userId, participant) in _participants)
        {
            if (participant.ConnectionId == connectionId)
            {
                _participants.TryRemove(userId, out _);
                return userId;
            }
        }

        return null;
    }

    public int MoveToQuestion(int delta)
    {
        CurrentQuestionIndex = Math.Max(0, CurrentQuestionIndex + delta);
        ShowingResults = false;
        _answers.Clear();
        return CurrentQuestionIndex;
    }

    public void RevealResults() => ShowingResults = true;

    /// <summary>Records a participant's answer. Only the first answer per question counts.</summary>
    public bool TryRecordAnswer(Guid userId, string answer) => _answers.TryAdd(userId, answer);

    public IReadOnlyDictionary<string, int> AnswerTally() => _answers.Values
        .GroupBy(answer => answer, StringComparer.Ordinal)
        .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);

    public int ResponseCount => _answers.Count;

    public IReadOnlyList<LeaderboardEntry> Leaderboard(int take) => _participants
        .OrderByDescending(entry => entry.Value.Score)
        .Take(take)
        .Select((entry, index) => new LeaderboardEntry(index + 1, entry.Key, entry.Value.UserName, entry.Value.Score))
        .ToList();

    private readonly record struct Participant(string UserName, string ConnectionId, int Score);
}

public sealed record LeaderboardEntry(int Rank, Guid UserId, string UserName, int Score);

/// <summary>
/// The quizzes currently running on this instance, keyed by exam and by join code.
/// </summary>
public interface ILiveQuizStore
{
    /// <summary>
    /// Starts a quiz for an exam, or returns the one already running so a reconnecting presenter does
    /// not orphan the participants who joined with the original code.
    /// </summary>
    LiveQuiz Start(Guid examId, Guid presenterId, string presenterConnectionId);

    bool TryGetByExam(Guid examId, out LiveQuiz quiz);

    bool TryGetByCode(string code, out LiveQuiz quiz);

    LiveQuiz? End(Guid examId);

    /// <summary>Removes a dropped connection from every quiz it participates in.</summary>
    IReadOnlyCollection<(LiveQuiz Quiz, Guid UserId)> RemoveConnection(string connectionId);
}

/// <summary>
/// Per-instance store. Live quizzes are ephemeral and every participant of one quiz is connected to the
/// same instance only when the deployment is single-instance or sticky; scaling out requires moving this
/// behind the Redis backplane that already carries the hub's messages.
/// </summary>
public sealed class InMemoryLiveQuizStore : ILiveQuizStore
{
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 6;

    private readonly ConcurrentDictionary<Guid, LiveQuiz> _byExam = new();
    private readonly ConcurrentDictionary<string, LiveQuiz> _byCode = new(StringComparer.Ordinal);

    public LiveQuiz Start(Guid examId, Guid presenterId, string presenterConnectionId)
    {
        if (_byExam.TryGetValue(examId, out var running))
        {
            return running;
        }

        // Retry on the vanishingly unlikely collision rather than reusing a live code.
        while (true)
        {
            var code = GenerateCode();
            var quiz = new LiveQuiz(examId, presenterId, presenterConnectionId, code);

            if (!_byCode.TryAdd(code, quiz))
            {
                continue;
            }

            if (_byExam.TryAdd(examId, quiz))
            {
                return quiz;
            }

            _byCode.TryRemove(code, out _);
            return _byExam[examId];
        }
    }

    public bool TryGetByExam(Guid examId, out LiveQuiz quiz) => _byExam.TryGetValue(examId, out quiz!);

    public bool TryGetByCode(string code, out LiveQuiz quiz) =>
        _byCode.TryGetValue(Normalize(code), out quiz!);

    public LiveQuiz? End(Guid examId)
    {
        if (!_byExam.TryRemove(examId, out var quiz))
        {
            return null;
        }

        _byCode.TryRemove(quiz.Code, out _);
        return quiz;
    }

    public IReadOnlyCollection<(LiveQuiz Quiz, Guid UserId)> RemoveConnection(string connectionId)
    {
        var removed = new List<(LiveQuiz, Guid)>();

        foreach (var quiz in _byExam.Values)
        {
            if (quiz.RemoveConnection(connectionId) is { } userId)
            {
                removed.Add((quiz, userId));
            }
        }

        return removed;
    }

    private static string Normalize(string code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    /// <summary>
    /// Codes are the only credential for joining a quiz, so they are drawn from a cryptographic source
    /// rather than <c>Random</c>, whose sequence a participant could otherwise predict.
    /// </summary>
    private static string GenerateCode() => RandomNumberGenerator.GetString(CodeAlphabet, CodeLength);
}
