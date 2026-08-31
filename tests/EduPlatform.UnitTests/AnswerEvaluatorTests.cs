using Shared.Exams;
using Shared.Models;
using Shouldly;

namespace EduPlatform.UnitTests;

public class AnswerEvaluatorTests
{
    [Theory]
    [InlineData(QuestionType.MultipleChoice, "B", "b", true)]
    [InlineData(QuestionType.TrueFalse, "true", "True", true)]
    [InlineData(QuestionType.FillInBlank, "Ankara", "ankara", true)]
    [InlineData(QuestionType.MultipleChoice, "A", "B", false)]
    [InlineData(QuestionType.Essay, "anything", "anything", false)]
    public void Scores_objective_questions(QuestionType type, string correct, string given, bool expected)
    {
        AnswerEvaluator.IsCorrect(type, correct, given).ShouldBe(expected);
        AnswerEvaluator.Score(type, 5, correct, given).ShouldBe(expected ? 5 : 0);
    }

    [Fact]
    public void Blank_answers_are_never_correct()
    {
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "A", "  ").ShouldBeFalse();
    }
}
