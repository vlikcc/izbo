using Shared.Models;
using Shouldly;
using SubscriptionService.Services.Learner;

namespace EduPlatform.UnitTests;

public class LearnerRulesTests
{
    [Fact]
    public void Order_references_are_short_and_avoid_look_alike_characters()
    {
        var codes = Enumerable.Range(0, 500).Select(_ => LearnerRules.NewReference()).ToList();
        codes.ShouldAllBe(c => System.Text.RegularExpressions.Regex.IsMatch(c, "^YZK-[2-9A-HJ-NP-Z]{5}$"));
        codes.Distinct().Count().ShouldBeGreaterThan(490);
    }

    [Fact]
    public void Fixed_terms_count_days_from_the_start()
    {
        var start = new DateTime(2026, 11, 7, 9, 0, 0, DateTimeKind.Utc);
        LearnerRules.EndsAt(LearnerTerm.Month3, 90, start, start, 9, 15).ShouldBe(start.AddDays(90));
    }

    [Theory]
    [InlineData(2027, 6, 20, 2027)]   // bought in June: this September
    [InlineData(2027, 9, 20, 2028)]   // after mid-September: next year's
    public void Summer_ends_on_the_next_mid_September_in_Istanbul(int year, int month, int day, int endYear)
    {
        var now = new DateTime(year, month, day, 9, 0, 0, DateTimeKind.Utc);
        LearnerRules.EndsAt(LearnerTerm.Summer, 0, now, now, 9, 15)
            .ShouldBe(new DateTime(endYear, 9, 15, 20, 59, 59, DateTimeKind.Utc));
    }

    [Theory]
    [InlineData(4, 30, 20, false)]  // 23:00 on 30 April in Istanbul
    [InlineData(4, 30, 21, true)]   // already 1 May in Istanbul
    [InlineData(5, 1, 9, true)]
    [InlineData(8, 31, 20, true)]   // 23:00 on 31 August in Istanbul
    [InlineData(8, 31, 21, false)]  // already 1 September in Istanbul
    public void The_summer_sale_follows_the_Istanbul_calendar(int month, int day, int hourUtc, bool open)
    {
        var now = new DateTime(2027, month, day, hourUtc, 0, 0, DateTimeKind.Utc);
        LearnerRules.IsSummerSaleOpen(now, 5, 8).ShouldBe(open);
    }
}
