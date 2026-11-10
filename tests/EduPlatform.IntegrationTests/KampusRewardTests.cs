using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>The reward ledger: one reward per (kind, ref), at most 10 ⭐ a day, KP uncapped, answers graded here.</summary>
[Collection("postgres")]
public class KampusRewardTests : KampusTestBase
{
    public KampusRewardTests(PostgresFixture postgres) : base(postgres)
    {
    }

    [SkippableFact]
    public async Task A_stop_rewards_its_first_completion_once_and_the_daily_quest_once_a_day()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        var first = (await s.Learner.SaveStopAsync(student, Topic, "anlatim", null)).Value!;
        first.First.ShouldBeTrue();
        first.Kp.ShouldBe(10);
        first.Daily.ShouldBe(0, "one activity is not the daily quest yet");

        var again = (await s.Learner.SaveStopAsync(student, Topic, "anlatim", null)).Value!;
        again.First.ShouldBeFalse();
        again.Kp.ShouldBe(0, "a repeated stop earns nothing");
        again.Daily.ShouldBe(5, "the second activity of the day completes the daily quest");

        (await s.Learner.SaveStopAsync(student, Topic, "anlatim", null)).Value!.Daily.ShouldBe(0, "the daily quest pays once a day");

        (await db.Rewards.CountAsync(r => r.StudentId == student.UserId && r.Kind == "durak")).ShouldBe(1);
        (await KpAsync(db, student.UserId)).ShouldBe(15);

        Time.Advance(TimeSpan.FromDays(1));
        await s.Learner.SaveStopAsync(student, Topic, "anlatim", null);
        (await s.Learner.SaveStopAsync(student, Topic, "anlatim", null)).Value!.Daily.ShouldBe(5, "a new day, a new daily quest");
    }

    [SkippableFact]
    public async Task Stars_stop_at_ten_a_day_and_a_question_earns_its_star_once_ever()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        var exercises = (await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers())).Value!;
        exercises.Cup.ShouldBe(TopicData.Exercises.Count);
        exercises.Kp.ShouldBe(10);

        var game = (await s.Learner.FinishGameAsync(student, "sayi-balonlari", 8)).Value!;
        game.Cup.ShouldBe(10 - TopicData.Exercises.Count, "only what is left of today's 10 ⭐");
        game.Kp.ShouldBe(5, "KP is not capped");
        (await StarsAsync(db, student.UserId)).ShouldBe(10);
        (await s.Learner.StarPreviewAsync(student.UserId, Topic, "minitest")).Value!.Max.ShouldBe(0);

        (await s.Learner.FinishGameAsync(student, "sayi-balonlari", 8)).Value!.ShouldSatisfyAllConditions(
            g => g.Kp.ShouldBe(0, "the game rewards its first round of the day"),
            g => g.Cup.ShouldBe(0));

        Time.Advance(TimeSpan.FromDays(1));
        var replay = (await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers())).Value!;
        replay.Cup.ShouldBe(0, "every exercise already earned its star");
        replay.Repeat.ShouldBe(TopicData.Exercises.Count);
        (await s.Learner.FinishGameAsync(student, "sayi-balonlari", 99)).Value!.Cup.ShouldBe(8, "the score is clamped to the game's rounds");
    }

    [SkippableFact]
    public async Task A_star_lost_to_the_daily_limit_can_still_be_earned_another_day()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();
        await GiveStarsAsync(db, student.UserId, 8);

        var capped = (await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers())).Value!;
        capped.Cup.ShouldBe(2);
        capped.Capped.ShouldBe(true);

        Time.Advance(TimeSpan.FromDays(1));
        (await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers())).Value!.Cup.ShouldBe(TopicData.Exercises.Count - 2);
    }

    [SkippableFact]
    public async Task Concurrent_rewards_never_pass_the_daily_limit()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using (await FreshDbAsync())
        {
        }

        var student = NewStudent();
        await Task.WhenAll(
            Task.Run(async () => { await using var db = CreateDb(); await Services(db).Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers()); }),
            Task.Run(async () => { await using var db = CreateDb(); await Services(db).Learner.FinishGameAsync(student, "sayi-balonlari", 8); }));

        await using var check = CreateDb();
        (await StarsAsync(check, student.UserId)).ShouldBe(10);
    }

    [SkippableFact]
    public async Task Two_simultaneous_stop_starts_both_succeed_and_keep_one_row()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using (await FreshDbAsync())
        {
        }

        // The page opens a stop twice at once in React StrictMode; the second insert must not fail.
        var student = NewStudent();
        var results = await Task.WhenAll(
            Task.Run(async () => { await using var db = CreateDb(); return await Services(db).Learner.StartStopAsync(student, Topic, "anlatim"); }),
            Task.Run(async () => { await using var db = CreateDb(); return await Services(db).Learner.StartStopAsync(student, Topic, "alistirma"); }));

        results.ShouldAllBe(r => r.Value);
        await using var check = CreateDb();
        (await check.InProgress.CountAsync(p => p.StudentId == student.UserId)).ShouldBe(1);
    }

    [SkippableFact]
    public async Task Only_this_topics_exercises_answered_at_the_first_try_earn_stars()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();
        var answers = FirstTryAnswers();
        answers[TopicData.Exercises[0].Id] = KampusAnswers.Practice(1);
        answers["uydurma-soru"] = KampusAnswers.Practice(0);
        answers["baska-konu"] = KampusAnswers.Practice(0);

        (await s.Learner.SaveStopAsync(student, Topic, "alistirma", answers)).Value!.Cup.ShouldBe(TopicData.Exercises.Count - 1);
        (await db.TopicAnswers.SingleAsync()).Answers.Keys.ShouldNotContain("uydurma-soru");
    }

    [SkippableFact]
    public async Task A_mini_test_is_picked_and_graded_by_the_server_and_each_set_rewards_once()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        (await s.Learner.SaveStopAsync(student, Topic, "minitest", null)).Status.ShouldBe(ContentResultStatus.Invalid, "the stop is only finished by the test itself");
        (await s.Learner.AnswerMiniTestAsync(student, Topic, "x", null)).Status.ShouldBe(ContentResultStatus.NotFound);

        var set = (await s.Learner.NewMiniTestAsync(student, Topic)).Value!;
        set.Set.Count.ShouldBe(5);
        set.Set.ShouldAllBe(id => TopicData.TestPool.Any(q => q.Id == id));
        (await s.Learner.CompleteMiniTestAsync(student, Topic, null)).Status.ShouldBe(ContentResultStatus.Invalid);

        var outside = TopicData.TestPool.First(q => !set.Set.Contains(q.Id));
        (await s.Learner.AnswerMiniTestAsync(student, Topic, outside.Id, KampusAnswers.Right(outside))).Status.ShouldBe(ContentResultStatus.Invalid);

        var questions = set.Set.Select(id => TopicData.TestPool.Single(q => q.Id == id)).ToList();
        (await s.Learner.AnswerMiniTestAsync(student, Topic, questions[0].Id, KampusAnswers.Wrong())).Value!.Ok.ShouldBeFalse();
        (await s.Learner.AnswerMiniTestAsync(student, Topic, questions[0].Id, KampusAnswers.Right(questions[0]))).Value!.Ok
            .ShouldBeFalse("an answered question cannot be changed");
        foreach (var q in questions.Skip(1))
        {
            (await s.Learner.AnswerMiniTestAsync(student, Topic, q.Id, KampusAnswers.Right(q))).Value!.Ok.ShouldBeTrue();
        }

        var done = (await s.Learner.CompleteMiniTestAsync(student, Topic, null)).Value!;
        done.Kp.ShouldBe(10);
        done.Cup.ShouldBe(4);
        (await s.Learner.CompleteMiniTestAsync(student, Topic, null)).Value!.ShouldSatisfyAllConditions(
            r => r.Kp.ShouldBe(0, "the same set rewards once"),
            r => r.Cup.ShouldBe(0));
        (await s.Learner.GetMiniTestAsync(student, Topic)).Value!.Best.ShouldBe(4);

        var next = (await s.Learner.NewMiniTestAsync(student, Topic)).Value!;
        next.Attempt.ShouldBe(2);
        next.Set.Intersect(set.Set).ShouldBeEmpty("a new attempt uses questions not shown before");
    }

    [SkippableFact]
    public async Task Finishing_all_four_stops_adds_the_planet_a_level_and_a_topic_record_once()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();

        await s.Learner.SaveStopAsync(student, Topic, "anlatim", null);
        await s.Learner.SaveStopAsync(student, Topic, "alistirma", FirstTryAnswers());
        await s.Learner.NewMiniTestAsync(student, Topic);
        var state = (await s.Learner.GetMiniTestAsync(student, Topic)).Value!;
        foreach (var id in state.Set)
        {
            await s.Learner.AnswerMiniTestAsync(student, Topic, id, KampusAnswers.Wrong());
        }

        (await s.Learner.CompleteMiniTestAsync(student, Topic, null)).Value!.AllDone.ShouldBeFalse();
        var last = (await s.Learner.SaveStopAsync(student, Topic, "ozet", null)).Value!;
        last.AllDone.ShouldBeTrue();
        last.LevelUp.ShouldBe(1);

        (await s.Learner.TakeLevelUpAsync(student)).Level.ShouldBe(1);
        (await s.Learner.TakeLevelUpAsync(student)).Level.ShouldBe(0, "the level-up message is shown once");
        (await s.Learner.SaveStopAsync(student, Topic, "ozet", null)).Value!.LevelUp.ShouldBe(0);

        var progress = await s.Learner.ProgressAsync(student.UserId);
        progress.CampusLevel.ShouldBe(1);
        progress.CompletedTopics.ShouldBe([Topic]);
        (await db.TopicAttempts.CountAsync(a => a.StudentId == student.UserId)).ShouldBe(1);
        (await s.Learner.BadgeAsync(student.UserId, "3-matematik")).Count.ShouldBe(1);
    }

    [SkippableFact]
    public async Task Book_answers_are_graded_here_and_the_first_right_answer_rewards_once()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();
        var book = Catalog.Data.Books[0];
        var q = book.Questions[0];

        (await s.Learner.FinishBookAsync(student, book.Id)).Value!.Kp.ShouldBe(5);
        (await s.Learner.FinishBookAsync(student, book.Id)).Value!.Kp.ShouldBe(0);

        (await s.Learner.AnswerBookAsync(student, book.Id, q.Id, "z")).Value!.ShouldSatisfyAllConditions(
            r => r.Ok.ShouldBeFalse(), r => r.Gain.Kp.ShouldBe(0));
        var right = (await s.Learner.AnswerBookAsync(student, book.Id, q.Id, q.Answer)).Value!;
        right.Ok.ShouldBeTrue();
        right.Gain.Kp.ShouldBe(3);
        right.Gain.Cup.ShouldBe(1);
        (await s.Learner.AnswerBookAsync(student, book.Id, q.Id, q.Answer)).Value!.Gain.Kp.ShouldBe(0);

        foreach (var other in book.Questions.Skip(1))
        {
            await s.Learner.AnswerBookAsync(student, book.Id, other.Id, other.Answer);
        }

        var state = (await s.Learner.BooksAsync(student.UserId)).Single(b => b.BookId == book.Id);
        state.Kp.ShouldBe(20, "a book is worth at most 20 KP");
        state.CompletedAt.ShouldNotBeNull();
    }

    [SkippableFact]
    public async Task Only_students_create_their_own_progress()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);

        foreach (var role in new[] { UserRole.Parent, UserRole.Instructor, UserRole.Admin })
        {
            var caller = NewCaller(role);
            (await s.Learner.SaveStopAsync(caller, Topic, "anlatim", null)).Status.ShouldBe(ContentResultStatus.Forbidden);
            (await s.Learner.FinishGameAsync(caller, "sayi-balonlari", 8)).Status.ShouldBe(ContentResultStatus.Forbidden);
            (await s.Avatar.BuyAsync(caller, "orman")).Status.ShouldBe(ContentResultStatus.Forbidden);
            (await s.Cup.JoinAsync(caller, null)).Status.ShouldBe(ContentResultStatus.Forbidden);
        }

        (await db.Rewards.CountAsync()).ShouldBe(0);
        (await db.Wallets.CountAsync()).ShouldBe(0);
    }
}
