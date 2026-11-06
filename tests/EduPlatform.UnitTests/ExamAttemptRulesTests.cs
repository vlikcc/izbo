using Shared.Exams;
using Shouldly;

namespace EduPlatform.UnitTests;

public class ExamAttemptRulesTests
{
    private static readonly DateTime Started = new(2026, 11, 6, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Deadline_is_the_duration_when_the_exam_window_is_wider()
    {
        ExamAttemptRules.Deadline(Started, 40, Started.AddHours(2)).ShouldBe(Started.AddMinutes(40));
    }

    [Fact]
    public void Deadline_is_cut_short_by_the_exam_end_time()
    {
        ExamAttemptRules.Deadline(Started, 40, Started.AddMinutes(10)).ShouldBe(Started.AddMinutes(10));
    }

    [Theory]
    [InlineData(39, true)]
    [InlineData(40, true)]
    [InlineData(40.4, true)]
    [InlineData(40.6, false)]
    public void Answers_are_accepted_until_the_deadline_plus_grace(double minutesIn, bool accepted)
    {
        ExamAttemptRules.AcceptsAnswersAt(Started.AddMinutes(minutesIn), Started, 40, Started.AddHours(2))
            .ShouldBe(accepted);
    }

    [Fact]
    public void Shuffle_is_stable_for_the_same_session()
    {
        var items = Enumerable.Range(1, 20).ToList();
        var session = Guid.NewGuid();
        var question = Guid.NewGuid();

        var first = ExamAttemptRules.Shuffle(items, session, question);
        var resumed = ExamAttemptRules.Shuffle(items, session, question);

        resumed.ShouldBe(first);
        first.OrderBy(x => x).ShouldBe(items);
    }

    [Fact]
    public void Shuffle_differs_between_sessions()
    {
        var items = Enumerable.Range(1, 20).ToList();

        var orders = Enumerable.Range(0, 5)
            .Select(_ => string.Join(',', ExamAttemptRules.Shuffle(items, Guid.NewGuid())))
            .Distinct()
            .Count();

        orders.ShouldBeGreaterThan(1);
    }
}
