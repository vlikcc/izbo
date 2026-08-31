using Shared.Models;

namespace Shared.Exams;

/// <summary>
/// Objective scoring for an exam answer. Essays always need a person; everything else is a trimmed,
/// case-insensitive match against the stored key.
/// </summary>
public static class AnswerEvaluator
{
    public static bool IsCorrect(QuestionType type, string? correctAnswer, string? studentAnswer)
    {
        if (string.IsNullOrWhiteSpace(studentAnswer) || string.IsNullOrWhiteSpace(correctAnswer))
        {
            return false;
        }

        return type switch
        {
            QuestionType.MultipleChoice => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.TrueFalse => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.FillInBlank => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.Matching => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.Essay => false,
            _ => Unhandled(type)
        };
    }

    public static int Score(QuestionType type, int points, string? correctAnswer, string? studentAnswer) =>
        IsCorrect(type, correctAnswer, studentAnswer) ? points : 0;

    private static bool EqualsIgnoreCase(string left, string right) =>
        left.Trim().Equals(right.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool Unhandled(QuestionType type)
    {
        throw new InvalidOperationException($"Unhandled question type '{type}'.");
    }
}
