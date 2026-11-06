using System.Text;
using ContentService.Data;
using ContentService.Services;
using ContentService.Services.Media;
using ContentService.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class ContentServiceTests
{
    private static readonly byte[] Mp4Bytes =
        [0, 0, 0, 0x18, (byte)'f', (byte)'t', (byte)'y', (byte)'p', (byte)'m', (byte)'p', (byte)'4', (byte)'2', 0, 0, 0, 0, 1, 2, 3, 4];

    private static readonly Guid FifthGradeMath = CurriculumSeed.IdFor("subject:5-sinif:matematik");

    private readonly PostgresFixture _postgres;
    private readonly Caller _admin = new(Guid.NewGuid(), UserRole.Admin);
    private readonly Caller _teacher = new(Guid.NewGuid(), UserRole.Instructor);
    private readonly Caller _otherTeacher = new(Guid.NewGuid(), UserRole.Instructor);
    private readonly Caller _student = new(Guid.NewGuid(), UserRole.Student);

    public ContentServiceTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Curriculum_import_is_an_idempotent_upsert()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var curriculum = CreateCurriculum(db);
        var unit = "Ünite " + Guid.NewGuid().ToString("N")[..8];
        var csv = $"""
            Seviye;Ders;Ünite;Konu;Kazanım Kodu;Açıklama
            5. Sınıf;Matematik;{unit};Doğal Sayılar;M.5.1.1.1;Okur ve yazar.
            5. Sınıf;Matematik;{unit};Doğal Sayılar;M.5.1.1.2;Bölüklere ayırır.
            5. Sınıf;Matematik;{unit};Kesirler;;
            5. Sınıf;Yeni Ders {unit};{unit};Giriş;;
            """;

        var first = (await curriculum.ImportAsync(Csv(csv), "mufredat.csv", dryRun: false, _admin)).Value!;
        first.Errors.ShouldBeEmpty();
        first.RowCount.ShouldBe(4);
        first.SubjectsCreated.ShouldBe(1, "Matematik is seeded; only the new subject is created");
        first.UnitsCreated.ShouldBe(2);
        first.TopicsCreated.ShouldBe(3);
        first.OutcomesCreated.ShouldBe(2);

        var counts = await CountsAsync(db);

        var second = (await CreateCurriculum(db).ImportAsync(Csv(csv), "mufredat.csv", dryRun: false, _admin)).Value!;
        second.Errors.ShouldBeEmpty();
        (second.SubjectsCreated, second.UnitsCreated, second.TopicsCreated, second.OutcomesCreated, second.OutcomesUpdated)
            .ShouldBe((0, 0, 0, 0, 0));
        (await CountsAsync(db)).ShouldBe(counts);

        // Changing a description updates the outcome in place instead of adding another.
        var edited = csv.Replace("Okur ve yazar.", "Okur, yazar ve karşılaştırır.", StringComparison.Ordinal);
        var third = (await CreateCurriculum(db).ImportAsync(Csv(edited), "mufredat.csv", dryRun: false, _admin)).Value!;
        third.OutcomesUpdated.ShouldBe(1);
        third.OutcomesCreated.ShouldBe(0);
        (await CountsAsync(db)).ShouldBe(counts);
        (await db.LearningOutcomes.SingleAsync(o => o.Code == "M.5.1.1.1" && o.Topic!.Unit!.Name == unit))
            .Description.ShouldBe("Okur, yazar ve karşılaştırır.");
    }

    [SkippableFact]
    public async Task Curriculum_import_with_an_invalid_row_writes_nothing()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var unit = "Ünite " + Guid.NewGuid().ToString("N")[..8];
        var csv = $"""
            Seviye,Ders,Ünite,Konu
            5. Sınıf,Matematik,{unit},Bölme
            13. Sınıf,Matematik,{unit},Çarpma
            """;
        var before = await CountsAsync(db);

        var result = (await CreateCurriculum(db).ImportAsync(Csv(csv), "x.csv", dryRun: false, _admin)).Value!;

        result.Errors.ShouldHaveSingleItem().Row.ShouldBe(3);
        (await CountsAsync(db)).ShouldBe(before);
    }

    [SkippableFact]
    public async Task Teacher_cannot_change_another_teachers_content()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var items = CreateItems(db);
        var item = (await items.CreateAsync(Embed(topicId, "Benim dersim"), _teacher)).Value!;

        var edit = await items.UpdateAsync(item.Id, new UpdateContentItemRequest(null, "Ele geçirildi", null, null, null, null, null), _otherTeacher);
        edit.Status.ShouldBe(ContentResultStatus.NotFound, "a draft must not even be revealed to other teachers");
        (await items.DeleteAsync(item.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await items.SubmitAsync(item.Id, _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await items.UploadAsync(item.Id, new MemoryStream(Mp4Bytes), "x.mp4", _otherTeacher)).Status.ShouldBe(ContentResultStatus.NotFound);

        (await items.PublishAsync(item.Id, _admin)).IsOk.ShouldBeTrue();
        var afterPublish = await items.UpdateAsync(item.Id, new UpdateContentItemRequest(null, "Ele geçirildi", null, null, null, null, null), _otherTeacher);
        afterPublish.Status.ShouldBe(ContentResultStatus.Forbidden);

        db.ChangeTracker.Clear();
        (await db.ContentItems.SingleAsync(i => i.Id == item.Id)).Title.ShouldBe("Benim dersim");

        // The owner and administrators can still edit.
        (await items.UpdateAsync(item.Id, new UpdateContentItemRequest(null, "Yeni başlık", null, null, null, null, null), _admin)).IsOk.ShouldBeTrue();
        (await items.UpdateAsync(item.Id, new UpdateContentItemRequest(null, "Sahibi değiştirdi", null, null, null, null, null), _teacher)).IsOk.ShouldBeTrue();
    }

    [SkippableFact]
    public async Task Draft_content_is_invisible_to_students()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var items = CreateItems(db);
        var curriculum = CreateCurriculum(db);
        var draft = (await items.CreateAsync(Embed(topicId, "Taslak"), _teacher)).Value!;

        (await items.GetAsync(draft.Id, _student)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await items.FindViewableAsync(draft.Id, _student)).ShouldBeNull();
        (await items.SaveProgressAsync(draft.Id, new UpdateProgressRequest(10), _student)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await curriculum.GetTopicAsync(topicId, _student))!.Items.ShouldBeEmpty();
        (await items.FindPublishedAsync(draft.Id)).ShouldBeNull();

        // Its author and administrators do see it.
        (await items.GetAsync(draft.Id, _teacher)).IsOk.ShouldBeTrue();
        (await items.GetAsync(draft.Id, _admin)).IsOk.ShouldBeTrue();
    }

    [SkippableFact]
    public async Task Teacher_content_reaches_students_only_through_approval()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var items = CreateItems(db);
        var curriculum = CreateCurriculum(db);

        var created = (await items.CreateAsync(Embed(topicId, "Kesirler anlatımı"), _teacher)).Value!;
        created.OwnerKind.ShouldBe(ContentOwnerKind.Teacher);
        created.Status.ShouldBe(ContentStatus.Draft);

        (await items.SubmitAsync(created.Id, _teacher)).Value!.Status.ShouldBe(ContentStatus.InReview);
        (await items.SubmitAsync(created.Id, _teacher)).Status.ShouldBe(ContentResultStatus.Conflict);
        (await items.GetAsync(created.Id, _student)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await items.GetReviewQueueAsync(new PagedRequest(1, 100))).Items.ShouldContain(i => i.Id == created.Id);

        // Teachers cannot review, not even their own submission.
        (await items.ReviewAsync(created.Id, new ReviewContentRequest(true, null), _teacher)).Status.ShouldBe(ContentResultStatus.Forbidden);

        var rejected = (await items.ReviewAsync(created.Id, new ReviewContentRequest(false, "Ses kaydı düşük"), _admin)).Value!;
        rejected.Status.ShouldBe(ContentStatus.Rejected);
        rejected.ReviewNote.ShouldBe("Ses kaydı düşük");
        (await items.GetAsync(created.Id, _student)).Status.ShouldBe(ContentResultStatus.NotFound);

        (await items.SubmitAsync(created.Id, _teacher)).Value!.Status.ShouldBe(ContentStatus.InReview);
        var approved = (await items.ReviewAsync(created.Id, new ReviewContentRequest(true, null), _admin)).Value!;
        approved.Status.ShouldBe(ContentStatus.Published);
        approved.PublishedAt.ShouldNotBeNull();

        (await items.GetAsync(created.Id, _student)).IsOk.ShouldBeTrue();
        (await curriculum.GetTopicAsync(topicId, _student))!.Items.ShouldContain(i => i.Id == created.Id);
        (await items.GetReviewQueueAsync(new PagedRequest(1, 100))).Items.ShouldNotContain(i => i.Id == created.Id);

        // Changing approved content sends it back for review and off the students' shelves.
        var edited = (await items.UpdateAsync(created.Id, new UpdateContentItemRequest(null, "Kesirler (yeni)", null, null, null, null, null), _teacher)).Value!;
        edited.Status.ShouldBe(ContentStatus.Draft);
        (await items.GetAsync(created.Id, _student)).Status.ShouldBe(ContentResultStatus.NotFound);
    }

    [SkippableFact]
    public async Task Admin_video_flows_from_upload_through_the_transcode_queue_to_progress()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var storage = new InMemoryContentStorage();
        var items = CreateItems(db, storage);

        var video = (await items.CreateAsync(
            new CreateContentItemRequest(topicId, ContentItemType.Video, "Kesir videosu", null), _admin)).Value!;
        video.OwnerKind.ShouldBe(ContentOwnerKind.Platform);

        var uploaded = (await items.UploadAsync(video.Id, new MemoryStream(Mp4Bytes), "kesir.mp4", _admin)).Value!;
        uploaded.ProcessingStatus.ShouldBe(ContentProcessingStatus.Queued);
        uploaded.FileSize.ShouldBe(Mp4Bytes.Length);
        storage.Objects.Keys.ShouldContain(ContentStorageKeys.Source(video.Id, ".mp4"));

        (await items.PublishAsync(video.Id, _admin)).IsOk.ShouldBeTrue();
        (await CreateCurriculum(db).GetTopicAsync(topicId, _student))!.Items
            .ShouldNotContain(i => i.Id == video.Id, "a video that has not finished processing is not listed");

        // The worker's claim/complete cycle, minus ffmpeg. Earlier tests may have left queued rows, so
        // drain until this item is claimed.
        var jobs = new TranscodeJobStore(db);
        TranscodeJob? job;
        do
        {
            job = await jobs.ClaimNextAsync();
            job.ShouldNotBeNull();
        }
        while (job.ItemId != video.Id);

        job.StorageKey.ShouldBe(ContentStorageKeys.Source(video.Id, ".mp4"));
        (await jobs.CompleteAsync(job, 600, ContentStorageKeys.HlsPrefix(video.Id), ContentStorageKeys.Thumbnail(video.Id))).ShouldBeTrue();
        (await jobs.CompleteAsync(job, 600, "x", null)).ShouldBeFalse("a claim completes once");

        db.ChangeTracker.Clear();
        var ready = (await items.GetAsync(video.Id, _student)).Value!;
        ready.ProcessingStatus.ShouldBe(ContentProcessingStatus.Ready);
        ready.DurationSeconds.ShouldBe(600);

        // Progress is one row per (user, item), updated in place; completion sticks.
        (await items.SaveProgressAsync(video.Id, new UpdateProgressRequest(30), _student)).Value!.PositionSeconds.ShouldBe(30);
        (await items.SaveProgressAsync(video.Id, new UpdateProgressRequest(120), _student)).Value!.PositionSeconds.ShouldBe(120);
        (await db.Progress.CountAsync(p => p.UserId == _student.UserId && p.ContentItemId == video.Id)).ShouldBe(1);

        var resume = (await items.GetContinueAsync(_student)).ShouldHaveSingleItem();
        resume.Item.Id.ShouldBe(video.Id);
        resume.PositionSeconds.ShouldBe(120);

        (await items.SaveProgressAsync(video.Id, new UpdateProgressRequest(560), _student)).Value!.Completed
            .ShouldBeTrue("90 % watched counts as finished");
        var rewatch = (await items.SaveProgressAsync(video.Id, new UpdateProgressRequest(5), _student)).Value!;
        rewatch.Completed.ShouldBeTrue();
        rewatch.PositionSeconds.ShouldBe(5);
        (await items.GetContinueAsync(_student)).ShouldBeEmpty();

        var tree = (await CreateCurriculum(db).GetSubjectTreeAsync(FifthGradeMath, _student))!;
        var node = tree.Units.SelectMany(u => u.Topics).Single(t => t.Id == topicId);
        node.ItemCount.ShouldBe(1);
        node.CompletedCount.ShouldBe(1);

        var publicLevel = (await CreateCurriculum(db).GetPublicLevelAsync("5-sinif"))!;
        publicLevel.Subjects.Single(s => s.Id == FifthGradeMath).VideoMinutes.ShouldBeGreaterThanOrEqualTo(10);
        publicLevel.FreeSamples.ShouldContain(s => s.Id == video.Id);
    }

    [SkippableFact]
    public async Task Transcode_claims_never_hand_the_same_video_to_two_workers()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var setupDb = await CreateDbAsync("content_queue");
        var topicId = await CreateTopicAsync(setupDb);
        var items = CreateItems(setupDb);
        for (var i = 0; i < 3; i++)
        {
            var video = (await items.CreateAsync(new CreateContentItemRequest(topicId, ContentItemType.Video, $"Video {i}", null), _admin)).Value!;
            (await items.UploadAsync(video.Id, new MemoryStream(Mp4Bytes), "v.mp4", _admin)).IsOk.ShouldBeTrue();
        }

        var queued = await setupDb.ContentItems.CountAsync(i => i.ProcessingStatus == ContentProcessingStatus.Queued);

        // Separate contexts stand in for separate worker instances polling concurrently.
        var claims = await Task.WhenAll(Enumerable.Range(0, queued + 2).Select(async _ =>
        {
            await using var db = await CreateDbAsync("content_queue");
            return await new TranscodeJobStore(db).ClaimNextAsync();
        }));

        var claimed = claims.Where(c => c is not null).Select(c => c!.ItemId).ToList();
        claimed.Count.ShouldBe(queued);
        claimed.Distinct().Count().ShouldBe(queued);
        (await setupDb.ContentItems.CountAsync(i => i.ProcessingStatus == ContentProcessingStatus.Queued)).ShouldBe(0);
    }

    [SkippableFact]
    public async Task Documents_are_ready_on_upload_and_must_really_be_pdfs()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        await using var db = await CreateDbAsync();
        var topicId = await CreateTopicAsync(db);
        var storage = new InMemoryContentStorage();
        var items = CreateItems(db, storage);
        var pdf = (await items.CreateAsync(new CreateContentItemRequest(topicId, ContentItemType.Worksheet, "Çalışma kağıdı", null), _teacher)).Value!;

        (await items.UploadAsync(pdf.Id, new MemoryStream(Mp4Bytes), "sahte.pdf", _teacher)).Status.ShouldBe(ContentResultStatus.Invalid);
        storage.Objects.ShouldBeEmpty();

        var uploaded = (await items.UploadAsync(pdf.Id, new MemoryStream("%PDF-1.7 içerik"u8.ToArray()), "calisma.pdf", _teacher)).Value!;
        uploaded.ProcessingStatus.ShouldBe(ContentProcessingStatus.Ready);
        uploaded.OriginalFileName.ShouldBe("calisma.pdf");

        (await items.DeleteAsync(pdf.Id, _teacher)).IsOk.ShouldBeTrue();
        storage.Objects.ShouldBeEmpty();
    }

    // ---- helpers ----

    private async Task<ContentDbContext> CreateDbAsync(string database = "content_service")
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>()
            .UseNpgsql(_postgres.ConnectionStringFor(database))
            .Options;
        var db = new ContentDbContext(options);
        // The real migration, not EnsureCreated: the queue and progress SQL depend on its column names.
        await db.Database.MigrateAsync();
        return db;
    }

    private static CurriculumService CreateCurriculum(ContentDbContext db) =>
        new(db, new NullAuditLogger(), NullLogger<CurriculumService>.Instance);

    private static ContentItemService CreateItems(ContentDbContext db, IContentStorage? storage = null) =>
        new(db,
            storage ?? new InMemoryContentStorage(),
            new AllowAllContentAccessPolicy(),
            new NoopQuotaGuard(),
            new NullAuditLogger(),
            Options.Create(new ContentOptions()),
            NullLogger<ContentItemService>.Instance);

    private static CreateContentItemRequest Embed(Guid topicId, string title) =>
        new(topicId, ContentItemType.Embed, title, "Açıklama", ContentAccessTier.Free, "https://www.youtube.com/embed/abc");

    private static async Task<Guid> CreateTopicAsync(ContentDbContext db)
    {
        var curriculum = CreateCurriculum(db);
        var unit = (await curriculum.CreateUnitAsync(new CreateUnitRequest(FifthGradeMath, "Ünite " + Guid.NewGuid().ToString("N")[..8], null))).Value!;
        return (await curriculum.CreateTopicAsync(new CreateTopicRequest(unit.Id, "Konu", null, null))).Value!.Id;
    }

    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));

    private static async Task<(int Subjects, int Units, int Topics, int Outcomes)> CountsAsync(ContentDbContext db) =>
        (await db.Subjects.CountAsync(), await db.Units.CountAsync(), await db.Topics.CountAsync(), await db.LearningOutcomes.CountAsync());
}
