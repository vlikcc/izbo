using ExamService.Services;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>Grading and standings of a live quiz; no database or hub involved.</summary>
public class LiveQuizTests
{
    private static readonly LiveQuizQuestion Capital = new(
        Guid.NewGuid(), QuestionType.MultipleChoice, "Başkent?", null, ["İstanbul", "Ankara", "İzmir"], "B", 10);

    private static readonly LiveQuizQuestion LegacyKey = new(
        Guid.NewGuid(), QuestionType.MultipleChoice, "En büyük şehir?", null, ["Ankara", "İstanbul"], "İstanbul", 5);

    private static readonly LiveQuizQuestion TrueFalse = new(
        Guid.NewGuid(), QuestionType.TrueFalse, "Dünya yuvarlaktır.", null, ["Doğru", "Yanlış"], "Doğru", 3);

    private static LiveQuiz Start(params LiveQuizQuestion[] questions) =>
        new InMemoryLiveQuizStore().Start(Guid.NewGuid(), Guid.NewGuid(), "presenter", questions);

    [Fact]
    public void Correct_letter_answer_scores_the_question_points()
    {
        var quiz = Start(Capital);
        var ali = Guid.NewGuid();
        var ayse = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");
        quiz.AddParticipant(ayse, "Ayşe", "c2");

        quiz.TryRecordAnswer(ali, Capital.Id, "b").ShouldBe("B");
        quiz.TryRecordAnswer(ayse, Capital.Id, "A").ShouldBe("A");

        var reveal = quiz.Reveal();

        reveal.ShouldNotBeNull();
        reveal.CorrectLetter.ShouldBe("B");
        var aliOutcome = reveal.Outcomes.Single(o => o.UserId == ali);
        aliOutcome.IsCorrect.ShouldBeTrue();
        aliOutcome.Score.ShouldBe(10);
        aliOutcome.Rank.ShouldBe(1);
        var ayseOutcome = reveal.Outcomes.Single(o => o.UserId == ayse);
        ayseOutcome.IsCorrect.ShouldBeFalse();
        ayseOutcome.Score.ShouldBe(0);
        ayseOutcome.Rank.ShouldBe(2);
        quiz.AnswerTally().ShouldBe(new Dictionary<string, int> { ["B"] = 1, ["A"] = 1 });
    }

    [Fact]
    public void Legacy_text_key_and_true_false_are_graded_by_option_letter()
    {
        var quiz = Start(LegacyKey, TrueFalse);
        var ali = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");

        quiz.TryRecordAnswer(ali, LegacyKey.Id, "B").ShouldNotBeNull();
        quiz.Reveal()!.CorrectLetter.ShouldBe("B");

        quiz.MoveToQuestion(1);
        quiz.TryRecordAnswer(ali, TrueFalse.Id, "A").ShouldNotBeNull();
        var reveal = quiz.Reveal()!;

        reveal.CorrectLetter.ShouldBe("A");
        reveal.Outcomes.Single().Score.ShouldBe(8);
    }

    [Fact]
    public void Only_the_first_answer_counts_and_none_after_the_reveal()
    {
        var quiz = Start(Capital);
        var ali = Guid.NewGuid();
        var veli = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");
        quiz.AddParticipant(veli, "Veli", "c2");

        quiz.TryRecordAnswer(ali, Capital.Id, "A").ShouldNotBeNull();
        quiz.TryRecordAnswer(ali, Capital.Id, "B").ShouldBeNull();
        quiz.Reveal();
        quiz.TryRecordAnswer(veli, Capital.Id, "B").ShouldBeNull();

        quiz.Leaderboard(take: 10).ShouldAllBe(entry => entry.Score == 0);
    }

    [Fact]
    public void Answer_naming_another_question_is_refused()
    {
        var quiz = Start(Capital, TrueFalse);
        var ali = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");

        quiz.MoveToQuestion(1);

        quiz.TryRecordAnswer(ali, Capital.Id, "B").ShouldBeNull();
        quiz.ResponseCount.ShouldBe(0);
    }

    [Fact]
    public void Stepping_back_does_not_let_a_question_be_answered_twice()
    {
        var quiz = Start(Capital, TrueFalse);
        var ali = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");

        quiz.TryRecordAnswer(ali, Capital.Id, "B").ShouldNotBeNull();
        quiz.MoveToQuestion(1);
        quiz.MoveToQuestion(-1);

        quiz.HasAnswered(ali).ShouldBeTrue();
        quiz.TryRecordAnswer(ali, Capital.Id, "B").ShouldBeNull();
        quiz.Leaderboard(take: 1).Single().Score.ShouldBe(10);
    }

    [Fact]
    public void Moving_stays_within_the_questions()
    {
        var quiz = Start(Capital, TrueFalse);

        quiz.MoveToQuestion(-1).ShouldBe(0);
        quiz.MoveToQuestion(5).ShouldBe(1);
        quiz.CurrentQuestion.ShouldBe(TrueFalse);
    }

    [Fact]
    public void Reconnecting_participant_keeps_their_score()
    {
        var quiz = Start(Capital);
        var ali = Guid.NewGuid();
        quiz.AddParticipant(ali, "Ali", "c1");
        quiz.TryRecordAnswer(ali, Capital.Id, "B");

        quiz.RemoveConnection("c1").ShouldBe(ali);
        quiz.HasParticipant(ali).ShouldBeFalse();
        quiz.ParticipantCount.ShouldBe(0);

        quiz.AddParticipant(ali, "Ali", "c9").ShouldBe(10);
        quiz.HasParticipant(ali).ShouldBeTrue();
    }

    [Fact]
    public void Equal_scores_share_a_rank()
    {
        var quiz = Start(Capital);
        var ids = Enumerable.Range(0, 3).Select(_ => Guid.NewGuid()).ToList();
        for (var i = 0; i < ids.Count; i++)
        {
            quiz.AddParticipant(ids[i], $"Öğrenci {i}", $"c{i}");
        }

        quiz.TryRecordAnswer(ids[0], Capital.Id, "B");
        quiz.TryRecordAnswer(ids[1], Capital.Id, "B");
        quiz.TryRecordAnswer(ids[2], Capital.Id, "C");

        quiz.Leaderboard(take: 10).Select(e => e.Rank).ShouldBe([1, 1, 3]);
        quiz.Standings().Select(s => s.Rank).Order().ShouldBe([1, 1, 3]);
    }
}
