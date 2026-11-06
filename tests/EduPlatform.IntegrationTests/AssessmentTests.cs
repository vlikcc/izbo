using ContentService.Data;
using ContentService.Services;
using ContentService.Services.Assessments;
using ContentService.Services.Questions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class AssessmentTests
{
    private static readonly Guid FifthGradeMath = CurriculumSeed.IdFor("subject:5-sinif:matematik");
    private static readonly Guid LgsLevel = CurriculumSeed.IdFor("level:lgs");

    private readonly PostgresFixture _postgres;
    private readonly ManualClock _clock = new(new DateTimeOffset(2026, 11, 6, 9, 0, 0, TimeSpan.Zero));
    private readonly Caller _admin = new(Guid.NewGuid(), UserRole.Admin);
    private readonly Caller _teacher = new(Guid.NewGuid(), UserRole.Instructor);

    public AssessmentTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Topic_test_reports_weak_outcomes_and_recommends_the_content_that_teaches_them()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (topicId, outcomeId, otherOutcomeId) = await CreateTopicWithOutcomesAsync(db);
        var bank = CreateBank(db);
        var weakQuestions = new List<Guid>();
        for (var i = 0; i < 3; i++)
        {
            weakQuestions.Add(await PublishedQuestionAsync(bank, topicId, $"Zayıf kazanım sorusu {i}", outcomeId));
        }

        for (var i = 0; i < 3; i++)
        {
            await PublishedQuestionAsync(bank, topicId, $"Güçlü kazanım sorusu {i}", otherOutcomeId);
        }

        // Content that teaches the weak outcome, and some that does not.
        var items = CreateItems(db);
        var lesson = (await items.CreateAsync(Embed(topicId, "Bölme konu anlatımı", [outcomeId]), _admin)).Value!;
        await items.PublishAsync(lesson.Id, _admin);
        var unrelated = (await items.CreateAsync(Embed(topicId, "Başka anlatım", [otherOutcomeId]), _admin)).Value!;
        await items.PublishAsync(unrelated.Id, _admin);

        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var attempts = CreateAttempts(db);

        (await attempts.StartPracticeAsync(new StartPracticeRequest(topicId, topicId), student)).Status
            .ShouldBe(ContentResultStatus.Invalid);

        var started = (await attempts.StartPracticeAsync(new StartPracticeRequest(topicId, null, 6), student)).Value!;
        started.Questions.Count.ShouldBe(6);
        started.Summary.ScoringRule.ShouldBe(ScoringRule.Plain);
        started.Summary.Deadline.ShouldBe(_clock.Now.AddMinutes(9));

        // Starting again resumes the same sitting.
        (await attempts.StartPracticeAsync(new StartPracticeRequest(topicId, null), student)).Value!.Summary.Id
            .ShouldBe(started.Summary.Id);

        // Other people cannot read or answer it.
        var stranger = new Caller(Guid.NewGuid(), UserRole.Student);
        (await attempts.GetAsync(started.Summary.Id, stranger)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await attempts.SaveAnswerAsync(started.Summary.Id, 1, new SaveAnswerRequest("A"), stranger)).Status
            .ShouldBe(ContentResultStatus.NotFound);

        // Wrong on the weak outcome, right on the other. Every question's key is B.
        foreach (var question in started.Questions)
        {
            var answer = weakQuestions.Contains(question.QuestionId) ? "A" : "b";
            (await attempts.SaveAnswerAsync(started.Summary.Id, question.Order, new SaveAnswerRequest(answer), student)).IsOk.ShouldBeTrue();
        }

        (await attempts.SaveAnswerAsync(started.Summary.Id, 1, new SaveAnswerRequest("E"), student)).Status
            .ShouldBe(ContentResultStatus.Invalid, "the questions have four options");

        var finished = (await attempts.SubmitAsync(started.Summary.Id, student)).Value!;
        finished.Status.ShouldBe(AttemptStatus.Submitted);
        (finished.Correct, finished.Wrong, finished.Blank).ShouldBe((3, 3, 0));
        finished.Percent.ShouldBe(50m);
        (await attempts.SaveAnswerAsync(started.Summary.Id, 1, new SaveAnswerRequest("B"), student)).Status
            .ShouldBe(ContentResultStatus.Conflict);

        var report = (await attempts.GetReportAsync(started.Summary.Id))!;
        report.Summary.ResultsVisible.ShouldBeTrue();
        report.Questions.Count.ShouldBe(6);
        report.Questions.ShouldAllBe(q => q.CorrectKey == "B");
        report.Outcomes.Count.ShouldBe(2);
        var weak = report.Weak.ShouldHaveSingleItem();
        weak.OutcomeId.ShouldBe(outcomeId);
        weak.Percent.ShouldBe(0m);
        var recommended = report.Recommendations.ShouldHaveSingleItem();
        recommended.Item.Id.ShouldBe(lesson.Id);
        recommended.OutcomeCode.ShouldBe("M.5.T.1");

        // Mastery shows the topic at 50%; the attempt lists under the student.
        var mastery = await attempts.GetMasteryAsync(student.UserId, null, 90);
        var topic = mastery.Topics.ShouldHaveSingleItem();
        (topic.Correct, topic.Total, topic.Percent).ShouldBe((3, 6, 50m));
        (await attempts.ListForUserAsync(student.UserId, 10)).ShouldHaveSingleItem().Id.ShouldBe(started.Summary.Id);

        // A used question cannot be deleted any more.
        (await bank.DeleteAsync(weakQuestions[0], _admin)).Status.ShouldBe(ContentResultStatus.Conflict);
    }

    [SkippableFact]
    public async Task Answers_after_the_deadline_are_refused_and_abandoned_tests_are_closed()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (topicId, _, _) = await CreateTopicWithOutcomesAsync(db);
        var bank = CreateBank(db);
        for (var i = 0; i < 5; i++)
        {
            await PublishedQuestionAsync(bank, topicId, $"Süre sorusu {i}", null);
        }

        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var dropout = new Caller(Guid.NewGuid(), UserRole.Student);
        var attempts = CreateAttempts(db);
        var mine = (await attempts.StartPracticeAsync(new StartPracticeRequest(topicId, null, 5), student)).Value!;
        var abandoned = (await attempts.StartPracticeAsync(new StartPracticeRequest(topicId, null, 5), dropout)).Value!;
        (await attempts.SaveAnswerAsync(mine.Summary.Id, 1, new SaveAnswerRequest("B"), student)).IsOk.ShouldBeTrue();
        (await attempts.SaveAnswerAsync(abandoned.Summary.Id, 1, new SaveAnswerRequest("B"), dropout)).IsOk.ShouldBeTrue();

        // Inside the grace period an answer still counts.
        _clock.Advance(TimeSpan.FromMinutes(8) + TimeSpan.FromSeconds(20));
        (await attempts.SaveAnswerAsync(mine.Summary.Id, 2, new SaveAnswerRequest("B"), student)).IsOk.ShouldBeTrue();

        _clock.Advance(TimeSpan.FromSeconds(30));
        (await attempts.SaveAnswerAsync(mine.Summary.Id, 3, new SaveAnswerRequest("B"), student)).Status
            .ShouldBe(ContentResultStatus.Conflict);

        db.ChangeTracker.Clear();
        var closed = await db.Attempts.AsNoTracking().SingleAsync(a => a.Id == mine.Summary.Id);
        closed.Status.ShouldBe(AttemptStatus.Expired);
        (closed.Correct, closed.Blank).ShouldBe((2, 3));

        // Nobody touched the other one: the sweep closes and grades it.
        (await CreateAttempts(db).ExpireOverdueAsync()).ShouldBeGreaterThanOrEqualTo(1);
        var swept = await db.Attempts.AsNoTracking().SingleAsync(a => a.Id == abandoned.Summary.Id);
        swept.Status.ShouldBe(AttemptStatus.Expired);
        swept.Correct.ShouldBe(1);
    }

    [SkippableFact]
    public async Task Mock_exam_hides_results_until_its_window_closes_then_ranks_only_sittings_inside_it()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var (topicId, _, _) = await CreateTopicWithOutcomesAsync(db);
        var bank = CreateBank(db);
        var questionIds = new List<Guid>();
        for (var i = 0; i < 4; i++)
        {
            questionIds.Add(await PublishedQuestionAsync(bank, topicId, $"Deneme sorusu {i}", null));
        }

        var free = await PublishedQuestionAsync(bank, topicId, "Serbest soru", null);

        var assessments = CreateAssessments(db);
        var start = _clock.Now.AddMinutes(10);
        var end = start.AddHours(2);

        (await assessments.CreateAsync(new SaveAssessmentRequest(AssessmentKind.MockExam, "Deneme", null, LgsLevel, 40), _admin))
            .Status.ShouldBe(ContentResultStatus.Invalid, "a mock exam needs a window");

        var created = (await assessments.CreateAsync(
            new SaveAssessmentRequest(AssessmentKind.MockExam, "LGS Deneme 1", "Kasım denemesi", LgsLevel, 40, null, start, end), _admin)).Value!;
        created.Summary.ScoringRule.ShouldBe(ScoringRule.NetThird);
        (await assessments.PublishAsync(created.Summary.Id, _admin)).Status.ShouldBe(ContentResultStatus.Invalid, "no questions yet");

        (await assessments.SaveSectionsAsync(created.Summary.Id, new SaveSectionsRequest(
            [new SectionInput(FifthGradeMath, "Matematik", questionIds)]))).IsOk.ShouldBeTrue();
        (await assessments.PublishAsync(created.Summary.Id, _admin)).Value!.Summary.Status.ShouldBe(AssessmentStatus.Published);
        (await assessments.SaveSectionsAsync(created.Summary.Id, new SaveSectionsRequest([new SectionInput(null, "X", [free])])))
            .Status.ShouldBe(ContentResultStatus.Conflict);

        // The deneme's questions are held back from teachers and practice until it is over.
        var teacherView = await bank.ListAsync(new QuestionListQuery(TopicId: topicId), _teacher);
        teacherView.Items.Select(q => q.Id).ShouldBe([free]);
        var practicer = new Caller(Guid.NewGuid(), UserRole.Student);
        var practice = (await CreateAttempts(db).StartPracticeAsync(new StartPracticeRequest(topicId, null), practicer)).Value!;
        practice.Questions.Select(q => q.QuestionId).ShouldBe([free]);

        var listed = await assessments.ListForLearnerAsync(["lgs"], practicer);
        listed.ShouldContain(a => a.Id == created.Summary.Id && a.State == AssessmentWindowState.Upcoming);

        var first = new Caller(Guid.NewGuid(), UserRole.Student);
        var second = new Caller(Guid.NewGuid(), UserRole.Student);
        var late = new Caller(Guid.NewGuid(), UserRole.Student);
        var attempts = CreateAttempts(db);

        (await attempts.StartAssessmentAsync(created.Summary.Id, first)).Status.ShouldBe(ContentResultStatus.Conflict, "not open yet");

        _clock.Advance(TimeSpan.FromMinutes(15));
        var a1 = (await attempts.StartAssessmentAsync(created.Summary.Id, first)).Value!;
        a1.Summary.IsRanked.ShouldBeTrue();
        a1.Questions.Select(q => q.SectionTitle).ShouldAllBe(t => t == "Matematik");
        (await attempts.StartAssessmentAsync(created.Summary.Id, first)).Value!.Summary.Id.ShouldBe(a1.Summary.Id, "one sitting per student");
        var a2 = (await attempts.StartAssessmentAsync(created.Summary.Id, second)).Value!;

        // First: 4 right. Second: 3 right, 1 wrong → net 2.67 under the LGS rule.
        foreach (var q in a1.Questions)
        {
            await attempts.SaveAnswerAsync(a1.Summary.Id, q.Order, new SaveAnswerRequest("B"), first);
        }

        foreach (var q in a2.Questions)
        {
            await attempts.SaveAnswerAsync(a2.Summary.Id, q.Order, new SaveAnswerRequest(q.Order == 1 ? "A" : "B"), second);
        }

        var hidden = (await attempts.SubmitAsync(a1.Summary.Id, first)).Value!;
        hidden.ResultsVisible.ShouldBeFalse();
        hidden.Net.ShouldBeNull();
        hidden.ResultsAt.ShouldBe(end);
        var hiddenReport = (await attempts.GetReportAsync(a1.Summary.Id))!;
        hiddenReport.Questions.ShouldBeEmpty("the answer key must not leak while others are still sitting");
        (await attempts.GetMasteryAsync(first.UserId, null, 90)).Topics.ShouldBeEmpty();
        await attempts.SubmitAsync(a2.Summary.Id, second);

        // Nothing is ranked before the window closes.
        (await attempts.RankClosedAssessmentsAsync()).ShouldBe(0);

        _clock.Advance(TimeSpan.FromHours(2));
        var a3 = (await attempts.StartAssessmentAsync(created.Summary.Id, late)).Value!;
        a3.Summary.IsRanked.ShouldBeFalse();
        foreach (var q in a3.Questions)
        {
            await attempts.SaveAnswerAsync(a3.Summary.Id, q.Order, new SaveAnswerRequest("B"), late);
        }

        var lateResult = (await attempts.SubmitAsync(a3.Summary.Id, late)).Value!;
        lateResult.ResultsVisible.ShouldBeTrue();
        lateResult.Net.ShouldBe(4m);

        (await attempts.RankClosedAssessmentsAsync()).ShouldBe(1);
        (await attempts.RankClosedAssessmentsAsync()).ShouldBe(0, "ranking happens once");

        var r1 = (await attempts.GetReportAsync(a1.Summary.Id))!.Summary;
        (r1.Net, r1.Rank, r1.ParticipantCount, r1.TopPercent).ShouldBe((4m, 1, 2, 50m));
        var r2 = (await attempts.GetReportAsync(a2.Summary.Id))!;
        (r2.Summary.Net, r2.Summary.Rank).ShouldBe((2.67m, 2));
        r2.Sections.ShouldHaveSingleItem().Net.ShouldBe(2.67m);
        (await attempts.GetReportAsync(a3.Summary.Id))!.Summary.Rank.ShouldBeNull();

        // Once over, the questions return to the bank for teachers and practice.
        (await bank.ListAsync(new QuestionListQuery(TopicId: topicId), _teacher)).Items.Count.ShouldBe(5);
        (await assessments.UnpublishAsync(created.Summary.Id, _admin)).Status.ShouldBe(ContentResultStatus.Conflict);
    }

    private async Task<ContentDbContext> CreateDbAsync()
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor("content_service"))
            .Options;
        var db = new ContentDbContext(options);
        await db.Database.MigrateAsync();
        return db;
    }

    private static CurriculumService CreateCurriculum(ContentDbContext db) =>
        new(db, new NullAuditLogger(), NullLogger<CurriculumService>.Instance);

    private QuestionBankService CreateBank(ContentDbContext db) =>
        new(db, new InMemoryContentStorage(), new NullAuditLogger(), _clock, NullLogger<QuestionBankService>.Instance);

    private static ContentItemService CreateItems(ContentDbContext db) =>
        new(db,
            new InMemoryContentStorage(),
            new AllowAllContentAccessPolicy(),
            new NoopQuotaGuard(),
            new NullAuditLogger(),
            Options.Create(new ContentOptions()),
            NullLogger<ContentItemService>.Instance);

    private AttemptService CreateAttempts(ContentDbContext db) => new(db, _clock, NullLogger<AttemptService>.Instance);

    private AssessmentService CreateAssessments(ContentDbContext db) => new(db, _clock, new NullAuditLogger());

    private static CreateContentItemRequest Embed(Guid topicId, string title, List<Guid> outcomes) =>
        new(topicId, ContentItemType.Embed, title, "Açıklama", ContentAccessTier.Free, "https://www.youtube.com/embed/abc", null, outcomes);

    /// <summary>A fresh topic under 5. sınıf matematik with two outcomes, so tests never see each other's questions.</summary>
    private static async Task<(Guid Topic, Guid Outcome, Guid OtherOutcome)> CreateTopicWithOutcomesAsync(ContentDbContext db)
    {
        var curriculum = CreateCurriculum(db);
        var unit = (await curriculum.CreateUnitAsync(new CreateUnitRequest(FifthGradeMath, "Ünite " + Guid.NewGuid().ToString("N")[..8], null))).Value!;
        var topic = (await curriculum.CreateTopicAsync(new CreateTopicRequest(unit.Id, "Bölme", null, null))).Value!;
        var outcome = (await curriculum.CreateOutcomeAsync(new CreateOutcomeRequest(topic.Id, "M.5.T.1", "Bölme yapar."))).Value!;
        var other = (await curriculum.CreateOutcomeAsync(new CreateOutcomeRequest(topic.Id, "M.5.T.2", "Kalanı yorumlar."))).Value!;
        return (topic.Id, outcome.Id, other.Id);
    }

    private async Task<Guid> PublishedQuestionAsync(QuestionBankService bank, Guid topicId, string stem, Guid? outcomeId)
    {
        var created = (await bank.CreateAsync(
            new SaveBankQuestionRequest(topicId, outcomeId, BankQuestionType.MultipleChoice, stem, null,
                [new("1"), new("2"), new("3"), new("4")], "B"), _admin)).Value!;
        (await bank.PublishAsync(created.Id, _admin)).IsOk.ShouldBeTrue();
        return created.Id;
    }

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset _now;

        public ManualClock(DateTimeOffset start) => _now = start;

        public DateTime Now => _now.UtcDateTime;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }
}
