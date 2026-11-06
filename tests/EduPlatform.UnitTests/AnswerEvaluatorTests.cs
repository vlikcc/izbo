using Shared.Exams;
using Shared.Models;
using Shouldly;

namespace EduPlatform.UnitTests;

public class AnswerEvaluatorTests
{
    private static readonly string[] Capitals = ["İstanbul", "Ankara", "İzmir", "Bursa"];

    [Theory]
    [InlineData(QuestionType.MultipleChoice, "B", "b", true)]
    [InlineData(QuestionType.TrueFalse, "true", "True", true)]
    [InlineData(QuestionType.FillInBlank, "Ankara", "ankara", true)]
    [InlineData(QuestionType.MultipleChoice, "A", "B", false)]
    [InlineData(QuestionType.Essay, "anything", "anything", false)]
    public void Scores_objective_questions(QuestionType type, string correct, string given, bool expected)
    {
        AnswerEvaluator.IsCorrect(type, correct, given, options: null).ShouldBe(expected);
        AnswerEvaluator.Score(type, 5, correct, given, options: null).ShouldBe(expected ? 5 : 0);
    }

    [Fact]
    public void Blank_answers_are_never_correct()
    {
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "A", "  ", Capitals).ShouldBeFalse();
    }

    [Theory]
    [InlineData("B", "Ankara", true)]
    [InlineData("b", " ankara ", true)]
    [InlineData("B", "İstanbul", false)]
    [InlineData("D", "Bursa", true)]
    public void Letter_key_is_matched_against_the_option_text(string key, string given, bool expected)
    {
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, key, given, Capitals).ShouldBe(expected);
    }

    [Fact]
    public void Letter_key_points_at_the_stored_order_even_when_the_student_saw_shuffled_options()
    {
        // The student sees a shuffled list and submits the text they clicked; the key still refers to
        // the stored (unshuffled) options.
        var shuffledForStudent = ExamAttemptRules.Shuffle(Capitals, Guid.NewGuid(), Guid.NewGuid());
        var clicked = shuffledForStudent.Single(o => o == "Ankara");

        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "B", clicked, Capitals).ShouldBeTrue();
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "B", shuffledForStudent.First(o => o != "Ankara"), Capitals)
            .ShouldBeFalse();
    }

    [Fact]
    public void Legacy_text_key_still_works()
    {
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "Ankara", "ankara", Capitals).ShouldBeTrue();
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "Ankara", "İzmir", Capitals).ShouldBeFalse();
    }

    [Fact]
    public void Letter_key_beyond_the_options_falls_back_to_a_plain_comparison()
    {
        AnswerEvaluator.IsCorrect(QuestionType.MultipleChoice, "F", "Bursa", Capitals).ShouldBeFalse();
        AnswerEvaluator.ResolveCorrectAnswer(QuestionType.MultipleChoice, "F", Capitals).ShouldBe("F");
    }

    [Fact]
    public void Resolved_key_shows_the_option_text()
    {
        AnswerEvaluator.ResolveCorrectAnswer(QuestionType.MultipleChoice, "C", Capitals).ShouldBe("İzmir");
        AnswerEvaluator.ResolveCorrectAnswer(QuestionType.TrueFalse, "Doğru", ["Doğru", "Yanlış"]).ShouldBe("Doğru");
    }

    [Fact]
    public void True_false_keys_are_not_treated_as_letters()
    {
        AnswerEvaluator.IsCorrect(QuestionType.TrueFalse, "Doğru", "Doğru", ["Doğru", "Yanlış"]).ShouldBeTrue();
        AnswerEvaluator.IsCorrect(QuestionType.TrueFalse, "Doğru", "Yanlış", ["Doğru", "Yanlış"]).ShouldBeFalse();
    }
}
