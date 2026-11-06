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
using Shared.Subscription;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>Student packages in ContentService: premium content, daily practice tests, premium mock exams.</summary>
[Collection("postgres")]
public class PremiumAccessTests
{
    private static readonly Guid FifthGradeMath = CurriculumSeed.IdFor("subject:5-sinif:matematik");
    private static readonly Guid LgsLevel = CurriculumSeed.IdFor("level:lgs");

    private static readonly LearnerProfile Free = LearnerProfile.Free(3, ["5-sinif"]);
    private static readonly LearnerProfile Temel = new(1, [LearnerFeatureCodes.PremiumContent], 3, ["5-sinif"]);
    private static readonly LearnerProfile TemelSixthGrade = Temel with { Levels = ["6-sinif"] };
    private static readonly LearnerProfile Plus = new(2,
        [LearnerFeatureCodes.PremiumContent, LearnerFeatureCodes.UnlimitedPractice, LearnerFeatureCodes.PremiumAssessments], -1, ["5-sinif", "lgs"]);

    private readonly PostgresFixture _postgres;
    private readonly ManualClock _clock = new(new DateTimeOffset(2026, 11, 6, 9, 0, 0, TimeSpan.Zero));
    private readonly Caller _admin = new(Guid.NewGuid(), UserRole.Admin);
    private readonly Caller _teacher = new(Guid.NewGuid(), UserRole.Instructor);

    public PremiumAccessTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Premium_items_are_listed_locked_and_open_only_with_a_package_at_the_students_level()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var authoring = CreateItems(db, new AllowAllContentAccessPolicy());
        var freeItem = await PublishedEmbedAsync(authoring, topicId, "Ücretsiz anlatım", ContentAccessTier.Free);
        var premiumItem = await PublishedEmbedAsync(authoring, topicId, "Premium anlatım", ContentAccessTier.Premium);

        var student = new Caller(Guid.NewGuid(), UserRole.Student);

        // Free: sees both, the premium one locked, and cannot open it.
        var freePolicy = Policy(Free);
        var topic = (await CreateCurriculum(db, freePolicy).GetTopicAsync(topicId, student))!;
        topic.Items.Single(i => i.Id == freeItem).Locked.ShouldBeFalse();
        topic.Items.Single(i => i.Id == premiumItem).Locked.ShouldBeTrue();

        var freeItems = CreateItems(db, freePolicy);
        var detail = (await freeItems.GetAsync(premiumItem, student)).Value!;
        detail.Locked.ShouldBeTrue();
        detail.EmbedUrl.ShouldBeNull("a locked embed must not hand out its URL");
        (await freeItems.GetAsync(freeItem, student)).Value!.EmbedUrl.ShouldNotBeNull();

        var denied = await Should.ThrowAsync<PackageRequiredException>(() => freeItems.FindPlayableAsync(premiumItem, student));
        denied.Reason.ShouldBe(PackageRequiredReasons.PremiumContent);
        denied.RequiredTier.ShouldBe(1);
        await Should.ThrowAsync<PackageRequiredException>(() =>
            freeItems.SaveProgressAsync(premiumItem, new UpdateProgressRequest(10, false), student));
        (await freeItems.FindPlayableAsync(freeItem, student)).ShouldNotBeNull();

        // Temel at the item's level opens it.
        var temelItems = CreateItems(db, Policy(Temel));
        (await temelItems.FindPlayableAsync(premiumItem, student)).ShouldNotBeNull();
        (await temelItems.GetAsync(premiumItem, student)).Value!.Locked.ShouldBeFalse();
        (await CreateCurriculum(db, Policy(Temel)).GetTopicAsync(topicId, student))!
            .Items.ShouldAllBe(i => !i.Locked);

        // A package covers the student's own grade, not every grade.
        await Should.ThrowAsync<PackageRequiredException>(() =>
            CreateItems(db, Policy(TemelSixthGrade)).FindPlayableAsync(premiumItem, student));

        // Teachers author the catalogue; nothing is locked for them.
        var staffPolicy = new PackageContentAccessPolicy(new FixedLearnerAccess(Free));
        (await CreateItems(db, staffPolicy).FindPlayableAsync(premiumItem, _teacher)).ShouldNotBeNull();
    }

    [SkippableFact]
    public async Task Free_students_get_three_new_tests_a_day_resuming_does_not_count_and_Plus_is_unlimited()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var bank = CreateBank(db);
        var topics = new List<Guid>();
        for (var t = 0; t < 5; t++)
        {
            var topicId = await CreateTopicAsync(db);
            topics.Add(topicId);
            for (var q = 0; q < 5; q++)
            {
                await PublishedQuestionAsync(bank, topicId, $"Soru {t}-{q}");
            }
        }

        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var attempts = CreateAttempts(db, Policy(Free));

        for (var i = 0; i < 3; i++)
        {
            (await attempts.StartPracticeAsync(new StartPracticeRequest(topics[i], null), student)).IsOk.ShouldBeTrue();
        }

        (await attempts.GetPracticeUsageAsync(student)).ShouldBe(new PracticeUsageDto(3, 3));
        (await attempts.StartPracticeAsync(new StartPracticeRequest(topics[0], null), student)).IsOk
            .ShouldBeTrue("resuming the running test is not a new one");

        var limited = await Should.ThrowAsync<PackageRequiredException>(() =>
            attempts.StartPracticeAsync(new StartPracticeRequest(topics[3], null), student));
        limited.Reason.ShouldBe(PackageRequiredReasons.DailyLimit);
        limited.RequiredTier.ShouldBe(2);

        // A new Istanbul day (21:00 UTC is midnight in Istanbul) resets the allowance.
        _clock.Advance(TimeSpan.FromHours(12));
        (await attempts.StartPracticeAsync(new StartPracticeRequest(topics[3], null), student)).IsOk.ShouldBeTrue();

        // Plus: unlimited.
        var plusStudent = new Caller(Guid.NewGuid(), UserRole.Student);
        var plusAttempts = CreateAttempts(db, Policy(Plus));
        foreach (var topicId in topics)
        {
            (await plusAttempts.StartPracticeAsync(new StartPracticeRequest(topicId, null), plusStudent)).IsOk.ShouldBeTrue();
        }

        (await plusAttempts.GetPracticeUsageAsync(plusStudent)).DailyLimit.ShouldBe(-1);
    }

    [SkippableFact]
    public async Task Premium_mock_exams_need_Plus()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var bank = CreateBank(db);
        var questions = new List<Guid>();
        for (var q = 0; q < 3; q++)
        {
            questions.Add(await PublishedQuestionAsync(bank, topicId, $"Deneme sorusu {q}"));
        }

        var assessments = new AssessmentService(db, _clock, new NullAuditLogger());
        var start = _clock.Now.AddMinutes(10);
        var created = (await assessments.CreateAsync(new SaveAssessmentRequest(
            AssessmentKind.MockExam, "Premium deneme", null, LgsLevel, 40, null, start, start.AddHours(2), ContentAccessTier.Premium), _admin)).Value!;
        (await assessments.SaveSectionsAsync(created.Summary.Id, new SaveSectionsRequest(
            [new SectionInput(FifthGradeMath, "Matematik", questions)]))).IsOk.ShouldBeTrue();
        (await assessments.PublishAsync(created.Summary.Id, _admin)).IsOk.ShouldBeTrue();
        _clock.Advance(TimeSpan.FromMinutes(15));

        var student = new Caller(Guid.NewGuid(), UserRole.Student);
        var denied = await Should.ThrowAsync<PackageRequiredException>(() =>
            CreateAttempts(db, Policy(Temel)).StartAssessmentAsync(created.Summary.Id, student));
        denied.Reason.ShouldBe(PackageRequiredReasons.PremiumAssessment);
        denied.RequiredTier.ShouldBe(2);

        (await CreateAttempts(db, Policy(Plus)).StartAssessmentAsync(created.Summary.Id, student)).IsOk.ShouldBeTrue();
    }

    // ---- helpers ----

    private static PackageContentAccessPolicy Policy(LearnerProfile profile) => new(new FixedLearnerAccess(profile));

    private sealed class FixedLearnerAccess(LearnerProfile profile) : ILearnerAccessClient
    {
        public Task<LearnerProfile> GetAsync(Caller caller, CancellationToken cancellationToken = default) => Task.FromResult(profile);
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

    private static CurriculumService CreateCurriculum(ContentDbContext db, IContentAccessPolicy? policy = null) =>
        new(db, new NullAuditLogger(), NullLogger<CurriculumService>.Instance, policy);

    private static ContentItemService CreateItems(ContentDbContext db, IContentAccessPolicy policy) =>
        new(db,
            new InMemoryContentStorage(),
            policy,
            new NoopQuotaGuard(),
            new NullAuditLogger(),
            Options.Create(new ContentOptions()),
            NullLogger<ContentItemService>.Instance);

    private QuestionBankService CreateBank(ContentDbContext db) =>
        new(db, new InMemoryContentStorage(), new NullAuditLogger(), _clock, NullLogger<QuestionBankService>.Instance);

    private AttemptService CreateAttempts(ContentDbContext db, IContentAccessPolicy policy) =>
        new(db, _clock, NullLogger<AttemptService>.Instance, policy);

    private async Task<Guid> PublishedEmbedAsync(ContentItemService items, Guid topicId, string title, ContentAccessTier tier)
    {
        var created = (await items.CreateAsync(
            new CreateContentItemRequest(topicId, ContentItemType.Embed, title, "Açıklama", tier, "https://www.youtube.com/embed/abc"), _admin)).Value!;
        (await items.PublishAsync(created.Id, _admin)).IsOk.ShouldBeTrue();
        return created.Id;
    }

    private async Task<Guid> PublishedQuestionAsync(QuestionBankService bank, Guid topicId, string stem)
    {
        var created = (await bank.CreateAsync(
            new SaveBankQuestionRequest(topicId, null, BankQuestionType.MultipleChoice, stem, null,
                [new("1"), new("2"), new("3"), new("4")], "B"), _admin)).Value!;
        (await bank.PublishAsync(created.Id, _admin)).IsOk.ShouldBeTrue();
        return created.Id;
    }

    private static async Task<Guid> CreateTopicAsync(ContentDbContext db)
    {
        var curriculum = CreateCurriculum(db);
        var unit = (await curriculum.CreateUnitAsync(new CreateUnitRequest(FifthGradeMath, "Ünite " + Guid.NewGuid().ToString("N")[..8], null))).Value!;
        return (await curriculum.CreateTopicAsync(new CreateTopicRequest(unit.Id, "Konu", null, null))).Value!.Id;
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
