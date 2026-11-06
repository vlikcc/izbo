using Shared.Models;
using Shouldly;
using UserService.Services.Promotion;

namespace EduPlatform.UnitTests;

public class PromotionRulesTests
{
    [Theory]
    [InlineData(1, 2)]
    [InlineData(8, 9)]
    [InlineData(11, 12)]
    [InlineData(12, 12)]
    public void Grades_move_up_by_one_and_twelfth_grade_stays(int grade, int next) =>
        PromotionRules.NextGrade(grade).ShouldBe(next);

    [Fact]
    public void Only_eighth_graders_preparing_for_LGS_lose_the_target()
    {
        PromotionRules.ClearsLgs(8, ExamTarget.Lgs).ShouldBeTrue();
        PromotionRules.ClearsLgs(7, ExamTarget.Lgs).ShouldBeFalse();
        PromotionRules.ClearsLgs(8, ExamTarget.None).ShouldBeFalse();
    }

    [Theory]
    [InlineData(2027, 8, 14, 20, null)]   // 23:00 on 14 August in Istanbul
    [InlineData(2027, 8, 14, 21, 2027)]   // midnight, 15 August in Istanbul
    [InlineData(2027, 9, 13, 9, 2027)]    // still inside the 30-day window
    [InlineData(2027, 9, 14, 21, null)]   // window over
    [InlineData(2026, 11, 7, 9, null)]    // deploying in November promotes nobody
    public void The_scheduled_run_is_due_from_15_August_for_a_month(int year, int month, int day, int hourUtc, int? due) =>
        PromotionRules.DueYear(new DateTime(year, month, day, hourUtc, 0, 0, DateTimeKind.Utc), new PromotionOptions()).ShouldBe(due);
}
