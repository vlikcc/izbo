using System.Collections.Concurrent;
using System.Security.Cryptography;
using Shared.Exams;
using Shared.Models;

namespace ExamService.Services;

/// <summary>A question as the live quiz presents and grades it, snapshotted when the quiz starts.</summary>
public sealed record LiveQuizQuestion(
    Guid Id,
    QuestionType Type,
    string Content,
    string? ImageUrl,
    IReadOnlyList<string> Options,
    string? CorrectAnswer,
    int Points);

/// <summary>How one participant fared on the question that was just revealed.</summary>
public sealed record LiveQuizOutcome(Guid UserId, string? ConnectionId, bool Answered, bool IsCorrect, int PointsAwarded, int Score, int Rank);

/// <summary>What revealing the current question's answer produced.</summary>
public sealed record LiveQuizReveal(LiveQuizQuestion Question, int QuestionIndex, string? CorrectLetter, IReadOnlyList<LiveQuizOutcome> Outcomes);

/// <summary>
/// A presenter-led quiz that participants join with a short code. The quiz holds the exam's questions
/// and answer keys, so answers are graded here and participants' scores are kept on the server.
/// </summary>
public sealed class LiveQuiz
{
    private const string OptionLetters = "ABCDEF";

    private readonly object _gate = new();
    private readonly Dictionary<Guid, Participant> _participants = [];
    private readonly Dictionary<int, Dictionary<Guid, RecordedAnswer>> _answers = [];
    private readonly HashSet<int> _revealed = [];

    internal LiveQuiz(Guid examId, Guid presenterId, string presenterConnectionId, string code, IReadOnlyList<LiveQuizQuestion> questions)
    {
        ExamId = examId;
        PresenterId = presenterId;
        PresenterConnectionId = presenterConnectionId;
        Code = code;
        Questions = questions;
        StartedAt = DateTime.UtcNow;
    }

    public Guid ExamId { get; }

    public Guid PresenterId { get; }

    public string PresenterConnectionId { get; }

    public string Code { get; }

    public DateTime StartedAt { get; }

    public IReadOnlyList<LiveQuizQuestion> Questions { get; }

    public int CurrentQuestionIndex { get; private set; }

    public LiveQuizQuestion? CurrentQuestion =>
        CurrentQuestionIndex < Questions.Count ? Questions[CurrentQuestionIndex] : null;

    public bool ShowingResults { get; private set; }

    public bool CurrentQuestionRevealed
    {
        get
        {
            lock (_gate)
            {
                return _revealed.Contains(CurrentQuestionIndex);
            }
        }
    }

    /// <summary>Participants currently connected.</summary>
    public int ParticipantCount
    {
        get
        {
            lock (_gate)
            {
                return _participants.Values.Count(p => p.ConnectionId is not null);
            }
        }
    }

    public bool IsPresenter(Guid userId) => PresenterId == userId;

    public bool HasParticipant(Guid userId)
    {
        lock (_gate)
        {
            return _participants.TryGetValue(userId, out var participant) && participant.ConnectionId is not null;
        }
    }

    /// <summary>Adds a participant, or reconnects one who left; a returning participant keeps their score.</summary>
    public int AddParticipant(Guid userId, string userName, string connectionId)
    {
        lock (_gate)
        {
            var score = _participants.TryGetValue(userId, out var existing) ? existing.Score : 0;
            _participants[userId] = new Participant(userName, connectionId, score);
            return score;
        }
    }

    /// <summary>Marks a participant as gone. Their score stays on the leaderboard.</summary>
    public void RemoveParticipant(Guid userId)
    {
        lock (_gate)
        {
            if (_participants.TryGetValue(userId, out var participant))
            {
                _participants[userId] = participant with { ConnectionId = null };
            }
        }
    }

    /// <summary>Disconnects whichever participant holds a connection, and reports who it was.</summary>
    public Guid? RemoveConnection(string connectionId)
    {
        lock (_gate)
        {
            foreach (var (userId, participant) in _participants)
            {
                if (participant.ConnectionId == connectionId)
                {
                    _participants[userId] = participant with { ConnectionId = null };
                    return userId;
                }
            }

            return null;
        }
    }

    public bool HasAnswered(Guid userId)
    {
        lock (_gate)
        {
            return _answers.TryGetValue(CurrentQuestionIndex, out var answers) && answers.ContainsKey(userId);
        }
    }

    /// <summary>Moves to another question, staying within the exam's questions.</summary>
    public int MoveToQuestion(int delta)
    {
        lock (_gate)
        {
            var last = Math.Max(0, Questions.Count - 1);
            CurrentQuestionIndex = Math.Clamp(CurrentQuestionIndex + delta, 0, last);
            ShowingResults = false;
            return CurrentQuestionIndex;
        }
    }

    public void RevealResults() => ShowingResults = true;

    /// <summary>
    /// Records and grades a participant's answer to the current question. Only the first answer counts,
    /// and an answer is refused once the question has been revealed or when it names another question
    /// (the presenter moved on while it was in flight). Returns the answer as recorded, or null.
    /// </summary>
    public string? TryRecordAnswer(Guid userId, Guid questionId, string answer)
    {
        lock (_gate)
        {
            var question = CurrentQuestion;
            if (question is null || question.Id != questionId || string.IsNullOrWhiteSpace(answer) ||
                _revealed.Contains(CurrentQuestionIndex) || !_participants.TryGetValue(userId, out var participant))
            {
                return null;
            }

            if (!_answers.TryGetValue(CurrentQuestionIndex, out var answers))
            {
                answers = [];
                _answers[CurrentQuestionIndex] = answers;
            }

            if (answers.ContainsKey(userId))
            {
                return null;
            }

            var recorded = NormalizeAnswer(question, answer);
            var isCorrect = AnswerEvaluator.IsCorrect(question.Type, question.CorrectAnswer, ToOptionText(question, recorded), question.Options);
            var points = isCorrect ? question.Points : 0;

            answers[userId] = new RecordedAnswer(recorded, isCorrect, points);
            _participants[userId] = participant with { Score = participant.Score + points };
            return recorded;
        }
    }

    public IReadOnlyDictionary<string, int> AnswerTally()
    {
        lock (_gate)
        {
            return _answers.TryGetValue(CurrentQuestionIndex, out var answers)
                ? answers.Values
                    .GroupBy(answer => answer.Answer, StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal)
                : new Dictionary<string, int>(StringComparer.Ordinal);
        }
    }

    public int ResponseCount
    {
        get
        {
            lock (_gate)
            {
                return _answers.TryGetValue(CurrentQuestionIndex, out var answers) ? answers.Count : 0;
            }
        }
    }

    /// <summary>
    /// Closes the current question to further answers and reports, for every participant, whether they
    /// got it right and where they now stand.
    /// </summary>
    public LiveQuizReveal? Reveal()
    {
        lock (_gate)
        {
            var question = CurrentQuestion;
            if (question is null)
            {
                return null;
            }

            _revealed.Add(CurrentQuestionIndex);
            _answers.TryGetValue(CurrentQuestionIndex, out var answers);

            var ranks = RanksLocked();
            var outcomes = _participants
                .Select(entry =>
                {
                    RecordedAnswer? answer = answers is not null && answers.TryGetValue(entry.Key, out var a) ? a : null;
                    return new LiveQuizOutcome(
                        entry.Key,
                        entry.Value.ConnectionId,
                        answer is not null,
                        answer?.IsCorrect ?? false,
                        answer?.Points ?? 0,
                        entry.Value.Score,
                        ranks[entry.Key]);
                })
                .ToList();

            return new LiveQuizReveal(question, CurrentQuestionIndex, CorrectLetter(question), outcomes);
        }
    }

    public IReadOnlyList<LeaderboardEntry> Leaderboard(int take)
    {
        lock (_gate)
        {
            var ranks = RanksLocked();
            return _participants
                .OrderBy(entry => ranks[entry.Key])
                .ThenBy(entry => entry.Value.UserName, StringComparer.CurrentCulture)
                .Take(take)
                .Select(entry => new LeaderboardEntry(ranks[entry.Key], entry.Key, entry.Value.UserName, entry.Value.Score))
                .ToList();
        }
    }

    /// <summary>Connected participants and their connections.</summary>
    public IReadOnlyList<(string ConnectionId, Guid UserId)> ConnectedParticipants()
    {
        lock (_gate)
        {
            return _participants
                .Where(entry => entry.Value.ConnectionId is not null)
                .Select(entry => (entry.Value.ConnectionId!, entry.Key))
                .ToList();
        }
    }

    /// <summary>Connected participants' connections, with each one's final standing.</summary>
    public IReadOnlyList<(string ConnectionId, int Rank, int Score)> Standings()
    {
        lock (_gate)
        {
            var ranks = RanksLocked();
            return _participants
                .Where(entry => entry.Value.ConnectionId is not null)
                .Select(entry => (entry.Value.ConnectionId!, ranks[entry.Key], entry.Value.Score))
                .ToList();
        }
    }

    /// <summary>
    /// The option letter of a question's key: a letter key as is, or the letter of the option a legacy
    /// text key names. Null when the key does not point at an option (fill-in-the-blank).
    /// </summary>
    public static string? CorrectLetter(LiveQuizQuestion question)
    {
        ArgumentNullException.ThrowIfNull(question);

        var key = question.CorrectAnswer?.Trim();
        if (string.IsNullOrEmpty(key) || question.Options.Count == 0)
        {
            return null;
        }

        if (question.Type == QuestionType.MultipleChoice && key.Length == 1)
        {
            var index = OptionLetters.IndexOf(char.ToUpperInvariant(key[0]), StringComparison.Ordinal);
            if (index >= 0 && index < question.Options.Count)
            {
                return OptionLetters[index].ToString();
            }
        }

        for (var i = 0; i < question.Options.Count && i < OptionLetters.Length; i++)
        {
            if (string.Equals(question.Options[i].Trim(), key, StringComparison.OrdinalIgnoreCase))
            {
                return OptionLetters[i].ToString();
            }
        }

        return null;
    }

    /// <summary>Competition ranking (1, 2, 2, 4): equal scores share a rank.</summary>
    private Dictionary<Guid, int> RanksLocked()
    {
        var ordered = _participants.OrderByDescending(entry => entry.Value.Score).ToList();
        var ranks = new Dictionary<Guid, int>(ordered.Count);
        for (var i = 0; i < ordered.Count; i++)
        {
            ranks[ordered[i].Key] = i > 0 && ordered[i].Value.Score == ordered[i - 1].Value.Score
                ? ranks[ordered[i - 1].Key]
                : i + 1;
        }

        return ranks;
    }

    /// <summary>Participants pick options by letter; letters are upper-cased so tallies line up.</summary>
    private static string NormalizeAnswer(LiveQuizQuestion question, string answer)
    {
        var trimmed = answer.Trim();
        return question.Options.Count > 0 && trimmed.Length == 1 &&
               OptionLetters.Contains(char.ToUpperInvariant(trimmed[0]), StringComparison.Ordinal)
            ? trimmed.ToUpperInvariant()
            : trimmed;
    }

    /// <summary>The option text a letter answer picks, which is what the evaluator compares.</summary>
    private static string ToOptionText(LiveQuizQuestion question, string answer)
    {
        if (answer.Length == 1)
        {
            var index = OptionLetters.IndexOf(answer[0], StringComparison.Ordinal);
            if (index >= 0 && index < question.Options.Count)
            {
                return question.Options[index];
            }
        }

        return answer;
    }

    private readonly record struct Participant(string UserName, string? ConnectionId, int Score);

    private sealed record RecordedAnswer(string Answer, bool IsCorrect, int Points);
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
    LiveQuiz Start(Guid examId, Guid presenterId, string presenterConnectionId, IReadOnlyList<LiveQuizQuestion> questions);

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

    public LiveQuiz Start(Guid examId, Guid presenterId, string presenterConnectionId, IReadOnlyList<LiveQuizQuestion> questions)
    {
        if (_byExam.TryGetValue(examId, out var running))
        {
            return running;
        }

        // Retry on the vanishingly unlikely collision rather than reusing a live code.
        while (true)
        {
            var code = GenerateCode();
            var quiz = new LiveQuiz(examId, presenterId, presenterConnectionId, code, questions);

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
