using Shared.Models;

namespace Shared.Exams;

/// <summary>
/// Objective scoring for an exam answer. Essays always need a person; everything else is a trimmed,
/// case-insensitive match against the stored key.
/// </summary>
/// <remarks>
/// Multiple-choice keys are stored as a letter (A–F) that points at the question's options in their
/// stored (unshuffled) order, while the exam client submits the option text. A letter key is therefore
/// resolved to the option text before comparing, which keeps grading correct when options are shuffled
/// for the student. Older questions whose key is the option text itself keep working unchanged.
/// </remarks>
public static class AnswerEvaluator
{
    private const string OptionLetters = "ABCDEF";

    public static bool IsCorrect(
        QuestionType type,
        string? correctAnswer,
        string? studentAnswer,
        IReadOnlyList<string>? options)
    {
        if (string.IsNullOrWhiteSpace(studentAnswer) || string.IsNullOrWhiteSpace(correctAnswer))
        {
            return false;
        }

        return type switch
        {
            QuestionType.MultipleChoice => EqualsIgnoreCase(studentAnswer, ResolveCorrectAnswer(type, correctAnswer, options)),
            QuestionType.TrueFalse => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.FillInBlank => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.Matching => EqualsIgnoreCase(studentAnswer, correctAnswer),
            QuestionType.Essay => false,
            _ => Unhandled(type)
        };
    }

    public static int Score(
        QuestionType type,
        int points,
        string? correctAnswer,
        string? studentAnswer,
        IReadOnlyList<string>? options) =>
        IsCorrect(type, correctAnswer, studentAnswer, options) ? points : 0;

    /// <summary>
    /// The key as the student sees it: for a multiple-choice letter key, the option text it points at;
    /// otherwise the stored key unchanged. Use it when showing the correct answer next to the student's.
    /// </summary>
    public static string? ResolveCorrectAnswer(QuestionType type, string? correctAnswer, IReadOnlyList<string>? options)
    {
        if (type != QuestionType.MultipleChoice || correctAnswer is null || options is null)
        {
            return correctAnswer;
        }

        var key = correctAnswer.Trim();
        if (key.Length != 1)
        {
            return correctAnswer;
        }

        var index = OptionLetters.IndexOf(char.ToUpperInvariant(key[0]), StringComparison.Ordinal);
        return index >= 0 && index < options.Count ? options[index] : correctAnswer;
    }

    private static bool EqualsIgnoreCase(string left, string? right) =>
        right is not null && left.Trim().Equals(right.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool Unhandled(QuestionType type)
    {
        throw new InvalidOperationException($"Unhandled question type '{type}'.");
    }
}
