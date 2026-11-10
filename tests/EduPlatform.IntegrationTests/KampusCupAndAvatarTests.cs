using ContentService.Kampus;
using ContentService.Kampus.Services;
using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>Yıldız Kupası groups, nicknames and winners; avatar items paid for with KP.</summary>
[Collection("postgres")]
public class KampusCupAndAvatarTests : KampusTestBase
{
    public KampusCupAndAvatarTests(PostgresFixture postgres) : base(postgres)
    {
    }

    [SkippableFact]
    public async Task Joining_needs_the_weeks_two_tasks_and_happens_once()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        (await s.Cup.JoinAsync(student, null)).Status.ShouldBe(ContentResultStatus.Invalid);

        // Week 0: an exercise (or mini test) and a lesson, done through the real stops.
        await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers());
        (await s.Cup.ProgressAsync(student.UserId)).DoneCount.ShouldBe(1);
        await s.Learner.SaveStopAsync(student, Topic, "anlatim", null);
        (await s.Cup.ProgressAsync(student.UserId)).Ready.ShouldBeTrue();

        var entry = (await s.Cup.JoinAsync(student, "Cesur Yunus")).Value!;
        entry.Group.ShouldBe(1);
        (await s.Cup.JoinAsync(student, "Mavi Balina")).Value!.Nick.ShouldBe("Cesur Yunus", "a second join returns the first entry");

        var summary = await s.Cup.SummaryAsync(student.UserId);
        summary.Joined.ShouldBeTrue();
        summary.Points.ShouldBe(TopicData.Exercises.Count);
        summary.Rank.ShouldBe(1);
        summary.Theme.Id.ShouldBe(Catalog.Data.Cup.Themes[0].Id);
    }

    [SkippableFact]
    public async Task Groups_of_twenty_fill_in_join_order_per_grade()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);

        var groups = new List<int>();
        for (var i = 0; i < 45; i++)
        {
            var student = NewStudent();
            await MakeCupReadyAsync(db, student.UserId);
            groups.Add((await s.Cup.JoinAsync(student, null)).Value!.Group);
        }

        groups.Take(20).ShouldAllBe(g => g == 1);
        groups.Skip(20).Take(20).ShouldAllBe(g => g == 2);
        groups.Skip(40).ShouldAllBe(g => g == 3);

        var firstGrader = NewStudent(grade: 1);
        await MakeCupReadyAsync(db, firstGrader.UserId);
        (await s.Cup.JoinAsync(firstGrader, null)).Value!.Group.ShouldBe(1, "each grade has its own groups");

        (await db.CupEntries.Where(e => e.Grade == 3).GroupBy(e => e.GroupNo).Select(g => g.Select(e => e.Nick).Distinct().Count() == g.Count()).ToListAsync())
            .ShouldAllBe(unique => unique, "automatic nicknames are unique within a group");
    }

    [SkippableFact]
    public async Task Concurrent_joins_still_fill_groups_exactly()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using (var setup = await FreshDbAsync())
        {
        }

        var students = Enumerable.Range(0, 25).Select(_ => NewStudent()).ToList();
        await using (var db = CreateDb())
        {
            foreach (var student in students)
            {
                await MakeCupReadyAsync(db, student.UserId);
            }
        }

        await Task.WhenAll(students.Select(student => Task.Run(async () =>
        {
            await using var db = CreateDb();
            (await Services(db).Cup.JoinAsync(student, null)).IsOk.ShouldBeTrue();
        })));

        await using var check = CreateDb();
        var entries = await check.CupEntries.ToListAsync();
        entries.Select(e => e.Seq).Order().ShouldBe(Enumerable.Range(0, 25));
        entries.Count(e => e.GroupNo == 1).ShouldBe(20);
        entries.Count(e => e.GroupNo == 2).ShouldBe(5);
    }

    [SkippableFact]
    public async Task A_nickname_comes_from_the_lists_and_is_unique_within_its_group()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);

        var first = NewStudent();
        await MakeCupReadyAsync(db, first.UserId);
        (await s.Cup.JoinAsync(first, "Cesur Yunus")).IsOk.ShouldBeTrue();

        var second = NewStudent();
        await MakeCupReadyAsync(db, second.UserId);
        (await s.Cup.NickChoicesAsync(second)).Taken.ShouldContain("Cesur Yunus");
        (await s.Cup.JoinAsync(second, "Cesur Yunus")).Status.ShouldBe(ContentResultStatus.Conflict);
        (await s.Cup.JoinAsync(second, "Cesur   Yunus")).Status.ShouldBe(ContentResultStatus.Conflict);
        (await s.Cup.JoinAsync(second, "Cesur Ejderha")).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Cup.JoinAsync(second, "Bay Yunus")).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Cup.JoinAsync(second, "Mavi Yunus")).IsOk.ShouldBeTrue();

        // Fill group 1, then the same nickname is free again in group 2.
        for (var i = 0; i < 18; i++)
        {
            var filler = NewStudent();
            await MakeCupReadyAsync(db, filler.UserId);
            await s.Cup.JoinAsync(filler, null);
        }

        var late = NewStudent();
        await MakeCupReadyAsync(db, late.UserId);
        var lateEntry = (await s.Cup.JoinAsync(late, "Cesur Yunus")).Value!;
        lateEntry.Group.ShouldBe(2);

        // The chosen name is remembered for next week.
        Time.Advance(TimeSpan.FromDays(7));
        (await s.Cup.NickChoicesAsync(late)).Last.ShouldBe("Cesur Yunus");
    }

    [SkippableFact]
    public async Task Winners_are_the_top_three_of_a_seven_child_group_ties_included_and_are_settled_after_the_week()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var points = new[] { 10, 9, 8, 8, 5, 3, 0 };
        var students = new List<Shared.Authorization.Caller>();
        foreach (var p in points)
        {
            var student = NewStudent();
            await MakeCupReadyAsync(db, student.UserId);
            await s.Cup.JoinAsync(student, null);
            if (p > 0)
            {
                await GiveStarsAsync(db, student.UserId, p);
            }

            students.Add(student);
        }

        var board = await s.Cup.BoardAsync(students[0].UserId, KampusClock.WeekOf(Time.GetUtcNow().UtcDateTime));
        board.Winners.ShouldBe(3);
        board.Rows.Select(r => r.Rank).ShouldBe([1, 2, 3, 3, 5, 6, 7]);
        board.Rows.Count(r => r.Winner).ShouldBe(4, "a tie at the cut-off line wins too");
        board.Rows.Count(r => r.Me).ShouldBe(1);

        var week = KampusClock.WeekOf(Time.GetUtcNow().UtcDateTime);
        Time.Advance(TimeSpan.FromDays(7));
        (await s.Cup.CupsWonAsync(students[3].UserId)).Single().ShouldSatisfyAllConditions(
            w => w.Week.ShouldBe(KampusCupService.WeekKey(week)),
            w => w.Rank.ShouldBe(3),
            w => w.Size.ShouldBe(7),
            w => w.Cup.ShouldBe(Catalog.Data.Cup.Themes[0].Id));
        (await s.Cup.CupsWonAsync(students[4].UserId)).ShouldBeEmpty();
        (await s.Cup.CupsWonAsync(students[3].UserId)).Count.ShouldBe(1, "settling is idempotent");

        (await s.Cup.SummaryAsync(students[0].UserId)).ShouldSatisfyAllConditions(
            x => x.Joined.ShouldBeFalse("a new week needs a new join"),
            x => x.Points.ShouldBe(0, "cup stars start again each week"));
    }

    [SkippableFact]
    public async Task Avatar_items_cost_kp_are_bought_once_and_only_owned_items_are_worn()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        (await s.Avatar.BuyAsync(student, "roket-gozluk")).Error.ShouldBe("Bu parça için 30 KP daha gerekiyor.");
        await using (var other = CreateDb())
        {
            await SetKpAsync(other, student.UserId, 50);
        }

        (await s.Avatar.BuyAsync(student, "roket-gozluk")).Value!.Kp.ShouldBe(20);
        (await s.Avatar.BuyAsync(student, "roket-gozluk")).Value!.Kp.ShouldBe(20, "an owned item is not charged again");
        (await s.Avatar.BuyAsync(student, "kasif-sapka")).Error.ShouldBe("Bu parça için 15 KP daha gerekiyor.");
        (await s.Avatar.BuyAsync(student, "yok-boyle-bir-parca")).Status.ShouldBe(ContentResultStatus.NotFound);

        (await s.Avatar.SaveAsync(student, new SaveAvatarRequest(null, new() { ["acc"] = "kasif-sapka" }))).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Avatar.SaveAsync(student, new SaveAvatarRequest(null, new() { ["outfit"] = "roket-gozluk" }))).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Avatar.SaveAsync(student, new SaveAvatarRequest(new() { ["skin"] = "#000000" }, null))).Status.ShouldBe(ContentResultStatus.Invalid);

        var saved = (await s.Avatar.SaveAsync(student, new SaveAvatarRequest(new() { ["hair"] = "uzun" }, new() { ["acc"] = "roket-gozluk" }))).Value!;
        saved.Custom.ShouldBeTrue();
        saved.Cfg["hair"].ShouldBe("uzun");
        saved.Cfg["skin"].ShouldBe(Catalog.Data.Avatar.Default["skin"]);
        saved.Eq["acc"].ShouldBe("roket-gozluk");

        (await StarsAsync(db, student.UserId)).ShouldBe(0, "spending KP never touches ⭐");
    }

    [SkippableFact]
    public async Task Concurrent_purchases_never_spend_below_zero()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using (var db = await FreshDbAsync())
        {
        }

        var student = NewStudent();
        await using (var db = CreateDb())
        {
            await SetKpAsync(db, student.UserId, 50);
        }

        var results = await Task.WhenAll(new[] { "roket-gozluk", "kulaklik" }.Select(item => Task.Run(async () =>
        {
            await using var db = CreateDb();
            return (await Services(db).Avatar.BuyAsync(student, item)).IsOk;
        })));

        results.Count(ok => ok).ShouldBe(1, "30 + 25 KP does not fit in 50");
        await using var check = CreateDb();
        (await KpAsync(check, student.UserId)).ShouldBeGreaterThanOrEqualTo(0);
        (await check.OwnedItems.CountAsync()).ShouldBe(1);
    }
}
