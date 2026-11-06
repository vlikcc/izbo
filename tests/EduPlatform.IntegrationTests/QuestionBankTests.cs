using System.Text;
using ContentService.Data;
using ContentService.Services;
using ContentService.Services.Questions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class QuestionBankTests
{
    private static readonly Guid FifthGradeMath = CurriculumSeed.IdFor("subject:5-sinif:matematik");

    private static readonly byte[] PngBytes =
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52];

    private readonly PostgresFixture _postgres;
    private readonly Caller _admin = new(Guid.NewGuid(), UserRole.Admin);
    private readonly Caller _teacher = new(Guid.NewGuid(), UserRole.Instructor);
    private readonly Caller _otherTeacher = new(Guid.NewGuid(), UserRole.Instructor);
    private readonly Caller _student = new(Guid.NewGuid(), UserRole.Student);

    public QuestionBankTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Teacher_questions_stay_private_until_approved_and_only_their_owner_edits_them()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var bank = CreateBank(db);

        var draft = (await bank.CreateAsync(Choice(topicId, "Taslak soru"), _teacher)).Value!;
        draft.Status.ShouldBe(ContentStatus.Draft);
        draft.OwnerKind.ShouldBe(ContentOwnerKind.Teacher);
        draft.SubjectName.ShouldBe("Matematik");

        // Nobody but the author and administrators can see or touch a draft.
        (await bank.GetAsync(draft.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.GetAsync(draft.Id, _student)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.ListAsync(new QuestionListQuery(TopicId: topicId), _otherTeacher)).Items.ShouldBeEmpty();
        (await bank.ListAsync(new QuestionListQuery(TopicId: topicId), _student)).Items.ShouldBeEmpty();
        (await bank.UpdateAsync(draft.Id, Choice(topicId, "Ele geçirildi"), _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.DeleteAsync(draft.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.SubmitAsync(draft.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.GetAsync(draft.Id, _admin)).IsOk.ShouldBeTrue();

        // Review: only administrators, only once submitted.
        (await bank.ReviewAsync(draft.Id, new ReviewContentRequest(true, null), _admin)).Status.ShouldBe(ContentResultStatus.Conflict);
        (await bank.SubmitAsync(draft.Id, _teacher)).Value!.Status.ShouldBe(ContentStatus.InReview);
        (await bank.GetReviewQueueAsync(new PagedRequest(1, 100))).Items.ShouldContain(q => q.Id == draft.Id);
        (await bank.ReviewAsync(draft.Id, new ReviewContentRequest(true, null), _teacher)).Status.ShouldBe(ContentResultStatus.Forbidden);
        var approved = (await bank.ReviewAsync(draft.Id, new ReviewContentRequest(true, "Güzel"), _admin)).Value!;
        approved.Status.ShouldBe(ContentStatus.Published);
        approved.PublishedAt.ShouldNotBeNull();

        // Published: other teachers read it (with the key, to build exams) but still cannot change it.
        var seen = (await bank.GetAsync(draft.Id, _otherTeacher)).Value!;
        seen.CorrectKey.ShouldBe("B");
        (await bank.UpdateAsync(draft.Id, Choice(topicId, "Ele geçirildi"), _otherTeacher)).Status.ShouldBe(ContentResultStatus.Forbidden);

        // The author's edit sends it back to Draft; an administrator's edit keeps it published.
        (await bank.UpdateAsync(draft.Id, Choice(topicId, "Düzeltilmiş soru"), _teacher)).Value!.Status.ShouldBe(ContentStatus.Draft);
        (await bank.GetAsync(draft.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await bank.PublishAsync(draft.Id, _admin)).IsOk.ShouldBeTrue();
        (await bank.UpdateAsync(draft.Id, Choice(topicId, "Editör düzeltmesi"), _admin)).Value!.Status.ShouldBe(ContentStatus.Published);
    }

    [SkippableFact]
    public async Task Questions_are_checked_against_the_curriculum_and_their_images()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var otherTopicId = await CreateTopicAsync(db);
        var outcome = (await CreateCurriculum(db).CreateOutcomeAsync(new CreateOutcomeRequest(otherTopicId, "M.5.9.9.9", "Başka konu"))).Value!;
        var storage = new InMemoryContentStorage();
        var bank = CreateBank(db, storage);

        (await bank.CreateAsync(Choice(Guid.NewGuid(), "Konu yok"), _teacher)).Status.ShouldBe(ContentResultStatus.Invalid);
        (await bank.CreateAsync(Choice(topicId, "Yanlış kazanım") with { LearningOutcomeId = outcome.Id }, _teacher))
            .Error!.ShouldContain("outcome");
        (await bank.CreateAsync(Choice(topicId, "Görsel yok") with { StemAssetId = Guid.NewGuid() }, _teacher))
            .Error!.ShouldContain("image");
        (await bank.CreateAsync(Choice(topicId, "Soru"), _student)).Status.ShouldBe(ContentResultStatus.Forbidden);

        // A real upload can be referenced and is served by its id.
        (await bank.UploadAssetAsync(new MemoryStream(Encoding.ASCII.GetBytes("<svg/>")), "x.png", _teacher)).Status
            .ShouldBe(ContentResultStatus.Invalid);
        (await bank.UploadAssetAsync(new MemoryStream(PngBytes), "sekil.png", _student)).Status.ShouldBe(ContentResultStatus.Forbidden);
        var asset = (await bank.UploadAssetAsync(new MemoryStream(PngBytes), "sekil.png", _teacher)).Value!;
        asset.ContentType.ShouldBe("image/png");

        var withImage = (await bank.CreateAsync(
            Choice(topicId, "") with { StemAssetId = asset.Id, Options = [new("Üçgen"), new(null, asset.Id)] }, _teacher)).Value!;
        withImage.StemAssetId.ShouldBe(asset.Id);
        withImage.Options[1].AssetId.ShouldBe(asset.Id);

        var stored = (await bank.FindAssetAsync(asset.Id))!;
        (await storage.StatAsync(stored.StorageKey))!.Size.ShouldBe(PngBytes.Length);

        // A topic that still has questions cannot be deleted from under them.
        (await CreateCurriculum(db).DeleteTopicAsync(topicId, _admin)).Status.ShouldBe(ContentResultStatus.Conflict);
    }

    [SkippableFact]
    public async Task Question_import_is_an_idempotent_upsert_into_the_existing_curriculum()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var unit = "Ünite " + Guid.NewGuid().ToString("N")[..8];
        var curriculum = $"""
            Seviye;Ders;Ünite;Konu;Kazanım Kodu;Açıklama
            5. Sınıf;Matematik;{unit};Bölme;M.5.1.2.1;Bölme yapar.
            """;
        (await CreateCurriculum(db).ImportAsync(Csv(curriculum), "m.csv", dryRun: false, _admin)).Value!.Errors.ShouldBeEmpty();

        var questions = $"""
            Seviye;Ders;Ünite;Konu;Kazanım Kodu;Soru;A;B;C;D;Doğru;Zorluk;Çözüm
            5;Matematik;{unit};Bölme;M.5.1.2.1;12 ÷ 3 kaçtır?;2;3;4;6;C;Kolay;12'yi 3'e böl.
            5;Matematik;{unit};Bölme;;0 bir doğal sayıdır.;;;;;Doğru;;
            """;

        var dry = (await CreateBank(db).ImportAsync(Csv(questions), "s.csv", dryRun: true, _admin)).Value!;
        dry.Created.ShouldBe(2);
        (await db.BankQuestions.CountAsync(q => q.Topic!.Unit!.Name == unit)).ShouldBe(0, "a dry run writes nothing");

        (await CreateBank(db).ImportAsync(Csv(questions), "s.csv", dryRun: false, _teacher)).Status
            .ShouldBe(ContentResultStatus.Forbidden);

        var first = (await CreateBank(db).ImportAsync(Csv(questions), "s.csv", dryRun: false, _admin)).Value!;
        first.Errors.ShouldBeEmpty();
        (first.Created, first.Updated, first.Unchanged).ShouldBe((2, 0, 0));

        var imported = await db.BankQuestions.AsNoTracking().Include(q => q.LearningOutcome)
            .Where(q => q.Topic!.Unit!.Name == unit).OrderBy(q => q.Type).ToListAsync();
        imported.ShouldAllBe(q => q.Status == ContentStatus.Published && q.OwnerKind == ContentOwnerKind.Platform);
        imported[0].LearningOutcome!.Code.ShouldBe("M.5.1.2.1");
        imported[1].Type.ShouldBe(BankQuestionType.TrueFalse);

        var second = (await CreateBank(db).ImportAsync(Csv(questions), "s.csv", dryRun: false, _admin)).Value!;
        (second.Created, second.Updated, second.Unchanged).ShouldBe((0, 0, 2));

        var fixedKey = questions.Replace(";C;Kolay;", ";D;Kolay;", StringComparison.Ordinal);
        var third = (await CreateBank(db).ImportAsync(Csv(fixedKey), "s.csv", dryRun: false, _admin)).Value!;
        (third.Created, third.Updated, third.Unchanged).ShouldBe((0, 1, 1));
        (await db.BankQuestions.CountAsync(q => q.Topic!.Unit!.Name == unit)).ShouldBe(2);

        // One unknown topic rejects the whole file.
        var bad = fixedKey + $"\n5;Matematik;{unit};Olmayan Konu;;Yeni soru;1;2;;;A;;\n";
        var rejected = (await CreateBank(db).ImportAsync(Csv(bad), "s.csv", dryRun: false, _admin)).Value!;
        rejected.Errors.ShouldHaveSingleItem().Row.ShouldBe(4);
        (await db.BankQuestions.CountAsync(q => q.Topic!.Unit!.Name == unit)).ShouldBe(2);
    }

    private async Task<ContentDbContext> CreateDbAsync(string database = "content_service")
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor(database))
            .Options;
        var db = new ContentDbContext(options);
        await db.Database.MigrateAsync();
        return db;
    }

    private static CurriculumService CreateCurriculum(ContentDbContext db) =>
        new(db, new NullAuditLogger(), NullLogger<CurriculumService>.Instance);

    private static QuestionBankService CreateBank(ContentDbContext db, InMemoryContentStorage? storage = null) =>
        new(db, storage ?? new InMemoryContentStorage(), new NullAuditLogger(), NullLogger<QuestionBankService>.Instance);

    private static SaveBankQuestionRequest Choice(Guid topicId, string stem) =>
        new(topicId, null, BankQuestionType.MultipleChoice, stem, null, [new("1"), new("2"), new("3"), new("4")], "B");

    private static async Task<Guid> CreateTopicAsync(ContentDbContext db)
    {
        var curriculum = CreateCurriculum(db);
        var unit = (await curriculum.CreateUnitAsync(new CreateUnitRequest(FifthGradeMath, "Ünite " + Guid.NewGuid().ToString("N")[..8], null))).Value!;
        return (await curriculum.CreateTopicAsync(new CreateTopicRequest(unit.Id, "Konu", null, null))).Value!.Id;
    }

    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));
}
