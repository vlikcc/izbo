namespace ExamService.Hubs;

/// <summary>
/// Names of the live-quiz messages <see cref="ExamHub"/> sends to clients. The web client mirrors these
/// in <c>frontend/src/services/liveQuizHub.ts</c> (<c>LIVE_QUIZ_EVENTS</c>); a test keeps the two in step,
/// because a name that drifts on one side fails silently — the message is simply never handled.
/// </summary>
public static class LiveQuizEvents
{
    /// <summary>To the presenter: someone joined. Payload: userId, userName, score, participantCount.</summary>
    public const string ParticipantJoined = "ParticipantJoined";

    /// <summary>To the presenter: someone left. Payload: userId, participantCount.</summary>
    public const string ParticipantLeft = "ParticipantLeft";

    /// <summary>To a participant who joined. Payload: examId, totalQuestions, score.</summary>
    public const string JoinedQuiz = "JoinedQuiz";

    /// <summary>To participants: the question now open. Payload: see <c>QuestionStartedPayload</c>.</summary>
    public const string QuestionStarted = "QuestionStarted";

    /// <summary>To the presenter: an answer came in. Payload: userId, answer, responseCount.</summary>
    public const string AnswerReceived = "AnswerReceived";

    /// <summary>To everyone in the quiz: the answer tally. Payload: answers, totalResponses.</summary>
    public const string QuestionResults = "QuestionResults";

    /// <summary>To everyone in the quiz: the current question closed. Payload: questionId, questionIndex, correctAnswer.</summary>
    public const string QuestionEnded = "QuestionEnded";

    /// <summary>To one participant after a reveal. Payload: score, rank, answered, correct, pointsAwarded.</summary>
    public const string ScoreUpdated = "ScoreUpdated";

    /// <summary>To whoever asked, and to the presenter after a reveal. Payload: LeaderboardEntry[].</summary>
    public const string Leaderboard = "Leaderboard";

    /// <summary>To everyone in the quiz. Payload: leaderboard, totalQuestions, and for a participant rank and totalScore.</summary>
    public const string QuizEnded = "QuizEnded";

    public static IReadOnlyList<string> All { get; } =
    [
        ParticipantJoined,
        ParticipantLeft,
        JoinedQuiz,
        QuestionStarted,
        AnswerReceived,
        QuestionResults,
        QuestionEnded,
        ScoreUpdated,
        Leaderboard,
        QuizEnded,
    ];
}
