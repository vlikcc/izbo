using ContentService.Data;
using ContentService.Services.Assessments;
using ContentService.Services.Import;
using ContentService.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Shared.Audit;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Questions;

public interface IQuestionBankService
{
    Task<PagedResponse<BankQuestionDto>> ListAsync(QuestionListQuery query, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> GetAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> CreateAsync(SaveBankQuestionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> UpdateAsync(Guid id, SaveBankQuestionRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<BankQuestionDto>> SubmitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> ReviewAsync(Guid id, ReviewContentRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<BankQuestionDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<BankQuestionDto>> GetReviewQueueAsync(PagedRequest paging, CancellationToken cancellationToken = default);

    /// <summary>Stores an image for a question or option. At most <see cref="QuestionImageRules.MaxBytes"/>.</summary>
    Task<ContentResult<QuestionAssetDto>> UploadAssetAsync(Stream body, string fileName, Caller caller, CancellationToken cancellationToken = default);

    Task<QuestionAsset?> FindAssetAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Imports platform questions from an .xlsx or .csv into an existing curriculum. Imported questions are
    /// published. The same (topic, question text) updates the earlier import instead of adding a copy; any
    /// invalid row rejects the whole file.
    /// </summary>
    Task<ContentResult<QuestionImportResult>> ImportAsync(Stream file, string fileName, bool dryRun, Caller caller, CancellationToken cancellationToken = default);
}

public class QuestionBankService : IQuestionBankService
{
    private readonly ContentDbContext _db;
    private readonly IContentStorage _storage;
    private readonly IAuditLogger _audit;
    private readonly TimeProvider _clock;
    private readonly ILogger<QuestionBankService> _logger;

    public QuestionBankService(
        ContentDbContext db,
        IContentStorage storage,
        IAuditLogger audit,
        TimeProvider clock,
        ILogger<QuestionBankService> logger)
    {
        _db = db;
        _storage = storage;
        _audit = audit;
        _clock = clock;
        _logger = logger;
    }

    // ---- Reading ----

    public async Task<PagedResponse<BankQuestionDto>> ListAsync(QuestionListQuery query, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(caller);

        var questions = VisibleTo(caller);

        if (query.Mine) questions = questions.Where(q => q.OwnerId == caller.UserId);
        if (query.TopicId is { } topicId) questions = questions.Where(q => q.TopicId == topicId);
        if (query.UnitId is { } unitId) questions = questions.Where(q => q.Topic!.UnitId == unitId);
        if (query.SubjectId is { } subjectId) questions = questions.Where(q => q.Topic!.Unit!.SubjectId == subjectId);
        if (query.LevelId is { } levelId) questions = questions.Where(q => q.Topic!.Unit!.Subject!.LevelId == levelId);
        if (query.OutcomeId is { } outcomeId) questions = questions.Where(q => q.LearningOutcomeId == outcomeId);
        if (query.Difficulty is { } difficulty) questions = questions.Where(q => q.Difficulty == difficulty);
        if (query.Status is { } status) questions = questions.Where(q => q.Status == status);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = "%" + query.Search.Trim()
                .Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("%", "\\%", StringComparison.Ordinal)
                .Replace("_", "\\_", StringComparison.Ordinal) + "%";
            questions = questions.Where(q => EF.Functions.ILike(q.Stem, pattern, "\\"));
        }

        var paging = new PagedRequest(query.Page, query.PageSize);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;
        var total = await questions.CountAsync(cancellationToken);

        var rows = await WithDetails(questions)
            .OrderByDescending(q => q.UpdatedAt)
            .ThenBy(q => q.Id)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        return new PagedResponse<BankQuestionDto>(
            rows.Select(ToDto).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<ContentResult<BankQuestionDto>> GetAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var question = await WithDetails(VisibleTo(caller)).FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        return question is null
            ? ContentResult.NotFound<BankQuestionDto>("Question not found")
            : ContentResult.Ok(ToDto(question));
    }

    // ---- Authoring ----

    public async Task<ContentResult<BankQuestionDto>> CreateAsync(SaveBankQuestionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.CanManageContent)
        {
            return ContentResult.Forbidden<BankQuestionDto>("Only teachers and administrators can write questions");
        }

        var (normalized, error) = await ValidateAsync(request, caller, cancellationToken);
        if (normalized is null)
        {
            return ContentResult.Invalid<BankQuestionDto>(error!);
        }

        var now = DateTime.UtcNow;
        var question = new BankQuestion
        {
            Id = Guid.NewGuid(),
            OwnerId = caller.UserId,
            OwnerKind = caller.IsPlatformAdmin ? ContentOwnerKind.Platform : ContentOwnerKind.Teacher,
            Status = ContentStatus.Draft,
            CreatedAt = now,
        };
        Apply(question, request, normalized, now);

        _db.BankQuestions.Add(question);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bank question {QuestionId} created by {UserId}", question.Id, caller.UserId);
        return ContentResult.Ok(await LoadDtoAsync(question.Id, cancellationToken));
    }

    public async Task<ContentResult<BankQuestionDto>> UpdateAsync(Guid id, SaveBankQuestionRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var (question, failure) = await FindManageableAsync(id, caller, cancellationToken);
        if (question is null)
        {
            return failure!;
        }

        var (normalized, error) = await ValidateAsync(request, caller, cancellationToken);
        if (normalized is null)
        {
            return ContentResult.Invalid<BankQuestionDto>(error!);
        }

        Apply(question, request, normalized, DateTime.UtcNow);

        // Approval covers what the reviewer saw; a teacher's change sends the question back to Draft.
        if (!caller.IsPlatformAdmin && question.Status != ContentStatus.Draft)
        {
            question.Status = ContentStatus.Draft;
            question.SubmittedAt = null;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(await LoadDtoAsync(question.Id, cancellationToken));
    }

    public async Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var (question, _) = await FindManageableAsync(id, caller, cancellationToken);
        if (question is null)
        {
            return ContentResult.NotFound<bool>("Question not found");
        }

        // Results point at their questions; a used question is retired by unpublishing it instead.
        if (await _db.AttemptItems.AnyAsync(i => i.QuestionId == id, cancellationToken) ||
            await _db.AssessmentQuestions.AnyAsync(q => q.QuestionId == id, cancellationToken))
        {
            return ContentResult.Conflict<bool>("This question is used in tests; unpublish it instead");
        }

        _db.BankQuestions.Remove(question);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("QuestionDeleted", caller.UserId, "BankQuestion", id.ToString()), cancellationToken);
        return ContentResult.Ok(true);
    }

    // ---- Review workflow ----

    public async Task<ContentResult<BankQuestionDto>> SubmitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var question = await _db.BankQuestions.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (question is null || question.OwnerId != caller.UserId)
        {
            return ContentResult.NotFound<BankQuestionDto>("Question not found");
        }

        if (question.Status is not (ContentStatus.Draft or ContentStatus.Rejected))
        {
            return ContentResult.Conflict<BankQuestionDto>($"A question in status {question.Status} cannot be submitted");
        }

        question.Status = ContentStatus.InReview;
        question.SubmittedAt = DateTime.UtcNow;
        question.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(await LoadDtoAsync(id, cancellationToken));
    }

    public async Task<ContentResult<BankQuestionDto>> ReviewAsync(Guid id, ReviewContentRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<BankQuestionDto>("Only administrators review questions");
        }

        var question = await _db.BankQuestions.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (question is null)
        {
            return ContentResult.NotFound<BankQuestionDto>("Question not found");
        }

        if (question.Status != ContentStatus.InReview)
        {
            return ContentResult.Conflict<BankQuestionDto>("Only questions waiting for review can be reviewed");
        }

        var now = DateTime.UtcNow;
        question.Status = request.Approve ? ContentStatus.Published : ContentStatus.Rejected;
        question.ReviewNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        question.ReviewedAt = now;
        question.ReviewedBy = caller.UserId;
        question.UpdatedAt = now;
        if (request.Approve)
        {
            question.PublishedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord(request.Approve ? "QuestionApproved" : "QuestionRejected", caller.UserId, "BankQuestion", id.ToString(), question.ReviewNote),
            cancellationToken);
        return ContentResult.Ok(await LoadDtoAsync(id, cancellationToken));
    }

    public async Task<ContentResult<BankQuestionDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default) =>
        await SetPublishedAsync(id, publish: true, caller, cancellationToken);

    public async Task<ContentResult<BankQuestionDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default) =>
        await SetPublishedAsync(id, publish: false, caller, cancellationToken);

    public async Task<PagedResponse<BankQuestionDto>> GetReviewQueueAsync(PagedRequest paging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(paging);

        var query = _db.BankQuestions.AsNoTracking().Where(q => q.Status == ContentStatus.InReview);
        var total = await query.CountAsync(cancellationToken);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;

        var rows = await WithDetails(query)
            .OrderBy(q => q.SubmittedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        return new PagedResponse<BankQuestionDto>(
            rows.Select(ToDto).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    // ---- Images ----

    public async Task<ContentResult<QuestionAssetDto>> UploadAssetAsync(Stream body, string fileName, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(body);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.CanManageContent)
        {
            return ContentResult.Forbidden<QuestionAssetDto>("Only teachers and administrators can upload question images");
        }

        // Images are small; reading one past the limit tells an oversized file apart without trusting headers.
        await using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await body.ReadAsync(chunk, cancellationToken)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > QuestionImageRules.MaxBytes)
            {
                return ContentResult.Invalid<QuestionAssetDto>($"Images must be at most {QuestionImageRules.MaxBytes / (1024 * 1024)} MB");
            }
        }

        if (buffer.Length == 0)
        {
            return ContentResult.Invalid<QuestionAssetDto>("The file is empty");
        }

        var head = buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, QuestionImageRules.SniffLength));
        var (isValid, error, extension, contentType) = QuestionImageRules.Check(fileName, head);
        if (!isValid)
        {
            return ContentResult.Invalid<QuestionAssetDto>(error!);
        }

        var asset = new QuestionAsset
        {
            Id = Guid.NewGuid(),
            ContentType = contentType,
            Size = buffer.Length,
            OwnerId = caller.UserId,
            CreatedAt = DateTime.UtcNow,
        };
        asset.StorageKey = ContentStorageKeys.QuestionAsset(asset.Id, extension);

        buffer.Position = 0;
        await _storage.PutAsync(asset.StorageKey, buffer, buffer.Length, contentType, cancellationToken);

        _db.QuestionAssets.Add(asset);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(new QuestionAssetDto(asset.Id, asset.ContentType, asset.Size));
    }

    public Task<QuestionAsset?> FindAssetAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.QuestionAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    // ---- Import ----

    public async Task<ContentResult<QuestionImportResult>> ImportAsync(
        Stream file,
        string fileName,
        bool dryRun,
        Caller caller,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<QuestionImportResult>("Only administrators import questions");
        }

        var (table, readError) = SpreadsheetTable.Read(file, fileName, QuestionImportParser.MaxRows);
        if (table is null)
        {
            return ContentResult.Invalid<QuestionImportResult>(readError!);
        }

        var parsed = QuestionImportParser.Parse(table);
        var errors = parsed.Errors;

        var levels = await _db.Levels.AsNoTracking().ToListAsync(cancellationToken);
        var subjectsByLevel = new Dictionary<Guid, List<Subject>>();
        var resolved = new List<(QuestionImportRow Row, Topic Topic, LearningOutcome? Outcome)>();

        foreach (var row in parsed.Rows)
        {
            var level = CurriculumService.ResolveLevel(row.Level, levels);
            if (level is null)
            {
                errors.Add(new CurriculumImportError(row.RowNumber, $"Unknown level '{row.Level}'"));
                continue;
            }

            if (!subjectsByLevel.TryGetValue(level.Id, out var subjects))
            {
                subjects = await _db.Subjects.AsNoTracking()
                    .Where(s => s.LevelId == level.Id)
                    .Include(s => s.Units).ThenInclude(u => u.Topics).ThenInclude(t => t.Outcomes)
                    .AsSplitQuery()
                    .ToListAsync(cancellationToken);
                subjectsByLevel[level.Id] = subjects;
            }

            var subjectSlug = Slug.From(row.Subject);
            var topic = subjects
                .FirstOrDefault(s => s.Slug == subjectSlug || Slug.From(s.Name) == subjectSlug)?
                .Units.FirstOrDefault(u => Slug.From(u.Name) == Slug.From(row.Unit))?
                .Topics.FirstOrDefault(t => t.Slug == Slug.From(row.Topic));
            if (topic is null)
            {
                errors.Add(new CurriculumImportError(
                    row.RowNumber, $"Unknown topic '{row.Subject} / {row.Unit} / {row.Topic}' — import the curriculum first"));
                continue;
            }

            LearningOutcome? outcome = null;
            if (row.OutcomeCode is not null)
            {
                outcome = topic.Outcomes.FirstOrDefault(o => string.Equals(o.Code, row.OutcomeCode, StringComparison.OrdinalIgnoreCase));
                if (outcome is null)
                {
                    errors.Add(new CurriculumImportError(row.RowNumber, $"Outcome '{row.OutcomeCode}' is not in topic '{row.Topic}'"));
                    continue;
                }
            }

            resolved.Add((row, topic, outcome));
        }

        var topicIds = resolved.Select(r => r.Topic.Id).Distinct().ToList();
        var existing = (await _db.BankQuestions
                .Where(q => q.OwnerKind == ContentOwnerKind.Platform && topicIds.Contains(q.TopicId))
                .ToListAsync(cancellationToken))
            .GroupBy(q => (q.TopicId, BankQuestionRules.StemKey(q.Stem)))
            .ToDictionary(g => g.Key, g => g.First());

        int created = 0, updated = 0, unchanged = 0;
        var now = DateTime.UtcNow;

        foreach (var (row, topic, outcome) in resolved)
        {
            var q = row.Question;
            if (existing.TryGetValue((topic.Id, BankQuestionRules.StemKey(q.Stem)), out var question))
            {
                var same = question.Type == row.Type
                    && question.LearningOutcomeId == outcome?.Id
                    && question.CorrectKey == q.CorrectKey
                    && question.Difficulty == row.Difficulty
                    && question.Explanation == q.Explanation
                    && question.Options.Select(o => (o.Key, o.Text)).SequenceEqual(q.Options.Select(o => (o.Key, o.Text)));
                if (same)
                {
                    unchanged++;
                    continue;
                }

                // Images added in the editor survive a re-import of the same text.
                var images = question.Options.ToDictionary(o => o.Key, o => o.AssetId);
                question.Type = row.Type;
                question.LearningOutcomeId = outcome?.Id;
                question.Options = q.Options.Select(o => o with { AssetId = images.GetValueOrDefault(o.Key) }).ToList();
                question.CorrectKey = q.CorrectKey;
                question.Difficulty = row.Difficulty;
                question.Explanation = q.Explanation;
                question.UpdatedAt = now;
                updated++;
                continue;
            }

            _db.BankQuestions.Add(new BankQuestion
            {
                Id = Guid.NewGuid(),
                TopicId = topic.Id,
                LearningOutcomeId = outcome?.Id,
                Type = row.Type,
                Stem = q.Stem,
                Options = q.Options,
                CorrectKey = q.CorrectKey,
                Difficulty = row.Difficulty,
                Explanation = q.Explanation,
                OwnerId = caller.UserId,
                OwnerKind = ContentOwnerKind.Platform,
                Status = ContentStatus.Published,
                CreatedAt = now,
                UpdatedAt = now,
                ReviewedAt = now,
                ReviewedBy = caller.UserId,
                PublishedAt = now,
            });
            created++;
        }

        errors.Sort((a, b) => a.Row.CompareTo(b.Row));
        var result = new QuestionImportResult(dryRun, parsed.Rows.Count, created, updated, unchanged, errors);

        if (dryRun || errors.Count > 0)
        {
            _db.ChangeTracker.Clear();
            return ContentResult.Ok(result);
        }

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Question import by {UserId}: {Created} created, {Updated} updated, {Unchanged} unchanged",
            caller.UserId, created, updated, unchanged);
        await _audit.WriteAsync(
            new AuditRecord("QuestionsImported", caller.UserId, "BankQuestion", null, $"created={created} updated={updated} unchanged={unchanged}"),
            cancellationToken);
        return ContentResult.Ok(result);
    }

    // ---- Helpers ----

    /// <summary>Administrators see every question; teachers see their own and everything published.</summary>
    private IQueryable<BankQuestion> VisibleTo(Caller caller)
    {
        var query = _db.BankQuestions.AsNoTracking();
        if (caller.IsPlatformAdmin)
        {
            return query;
        }

        if (!caller.CanManageContent)
        {
            return query.Where(_ => false);
        }

        // Questions held for a mock exam that is not over yet stay hidden from other teachers.
        var reserved = AssessmentQueries.ReservedQuestionIds(_db, _clock.GetUtcNow().UtcDateTime);
        return query.Where(q => q.OwnerId == caller.UserId
            || (q.Status == ContentStatus.Published && !reserved.Contains(q.Id)));
    }

    private static IQueryable<BankQuestion> WithDetails(IQueryable<BankQuestion> query) =>
        query
            .Include(q => q.Topic!).ThenInclude(t => t.Unit!).ThenInclude(u => u.Subject!).ThenInclude(s => s.Level)
            .Include(q => q.LearningOutcome)
            .Include(q => q.SolutionVideo);

    private async Task<BankQuestionDto> LoadDtoAsync(Guid id, CancellationToken cancellationToken) =>
        ToDto(await WithDetails(_db.BankQuestions.AsNoTracking()).FirstAsync(q => q.Id == id, cancellationToken));

    /// <summary>
    /// Teachers change only their own questions; administrators change everything. Someone else's
    /// published question answers 403, a draft 404, so drafts cannot be discovered by guessing ids.
    /// </summary>
    private async Task<(BankQuestion? Question, ContentResult<BankQuestionDto>? Failure)> FindManageableAsync(
        Guid id, Caller caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var question = await _db.BankQuestions.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (question is null)
        {
            return (null, ContentResult.NotFound<BankQuestionDto>("Question not found"));
        }

        if (caller.IsPlatformAdmin || (caller.CanManageContent && question.OwnerId == caller.UserId))
        {
            return (question, null);
        }

        _logger.LogWarning("User {UserId} attempted to modify question {QuestionId} owned by {OwnerId}", caller.UserId, id, question.OwnerId);
        return question.Status == ContentStatus.Published && caller.CanManageContent
            ? (null, ContentResult.Forbidden<BankQuestionDto>("You can only change your own questions"))
            : (null, ContentResult.NotFound<BankQuestionDto>("Question not found"));
    }

    private async Task<ContentResult<BankQuestionDto>> SetPublishedAsync(Guid id, bool publish, Caller caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<BankQuestionDto>("Only administrators publish or unpublish questions");
        }

        var question = await _db.BankQuestions.FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
        if (question is null)
        {
            return ContentResult.NotFound<BankQuestionDto>("Question not found");
        }

        var now = DateTime.UtcNow;
        if (publish)
        {
            question.Status = ContentStatus.Published;
            question.PublishedAt ??= now;
            question.ReviewedAt = now;
            question.ReviewedBy = caller.UserId;
        }
        else
        {
            question.Status = ContentStatus.Draft;
        }

        question.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord(publish ? "QuestionPublished" : "QuestionUnpublished", caller.UserId, "BankQuestion", id.ToString()),
            cancellationToken);
        return ContentResult.Ok(await LoadDtoAsync(id, cancellationToken));
    }

    private async Task<(NormalizedQuestion? Question, string? Error)> ValidateAsync(
        SaveBankQuestionRequest request, Caller caller, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Difficulty))
        {
            return (null, "Unknown difficulty");
        }

        if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId, cancellationToken))
        {
            return (null, "Topic not found");
        }

        if (request.LearningOutcomeId is { } outcomeId &&
            !await _db.LearningOutcomes.AnyAsync(o => o.Id == outcomeId && o.TopicId == request.TopicId, cancellationToken))
        {
            return (null, "The outcome must belong to the question's topic");
        }

        var (normalized, error) = BankQuestionRules.Normalize(
            request.Type, request.Stem, request.StemAssetId is not null, request.Options, request.CorrectKey, request.Explanation);
        if (normalized is null)
        {
            return (null, error);
        }

        var assetIds = BankQuestionRules.AssetIds(request.StemAssetId, normalized.Options).Distinct().ToList();
        if (assetIds.Count > 0 &&
            await _db.QuestionAssets.CountAsync(a => assetIds.Contains(a.Id), cancellationToken) != assetIds.Count)
        {
            return (null, "An image was not found; upload it again");
        }

        if (request.SolutionVideoItemId is { } videoId)
        {
            var videoOk = await _db.ContentItems.AnyAsync(i =>
                i.Id == videoId
                && (i.Type == ContentItemType.SolvedQuestionVideo || i.Type == ContentItemType.Video)
                && (i.Status == ContentStatus.Published || i.OwnerId == caller.UserId || caller.IsPlatformAdmin),
                cancellationToken);
            if (!videoOk)
            {
                return (null, "The solution video was not found");
            }
        }

        return (normalized, null);
    }

    private static void Apply(BankQuestion question, SaveBankQuestionRequest request, NormalizedQuestion normalized, DateTime now)
    {
        question.TopicId = request.TopicId;
        question.LearningOutcomeId = request.LearningOutcomeId;
        question.Type = request.Type;
        question.Stem = normalized.Stem;
        question.StemAssetId = request.StemAssetId;
        question.Options = normalized.Options;
        question.CorrectKey = normalized.CorrectKey;
        question.Difficulty = request.Difficulty;
        question.Explanation = normalized.Explanation;
        question.SolutionVideoItemId = request.SolutionVideoItemId;
        question.UpdatedAt = now;
    }

    internal static BankQuestionDto ToDto(BankQuestion q)
    {
        var topic = q.Topic;
        var unit = topic?.Unit;
        var subject = unit?.Subject;
        var level = subject?.Level;

        return new BankQuestionDto(
            q.Id,
            q.TopicId,
            topic?.Name ?? string.Empty,
            unit?.Id ?? Guid.Empty,
            unit?.Name ?? string.Empty,
            subject?.Id ?? Guid.Empty,
            subject?.Name ?? string.Empty,
            level?.Id ?? Guid.Empty,
            level?.Name ?? string.Empty,
            q.LearningOutcome?.ToDto(),
            q.Type,
            q.Stem,
            q.StemAssetId,
            q.Options.Select(o => new QuestionOptionDto(o.Key, o.Text, o.AssetId)).ToList(),
            q.CorrectKey,
            q.Difficulty,
            q.Explanation,
            q.SolutionVideoItemId,
            q.SolutionVideo?.Title,
            q.OwnerId,
            q.OwnerKind,
            q.Status,
            q.ReviewNote,
            q.CreatedAt,
            q.UpdatedAt,
            q.SubmittedAt,
            q.PublishedAt);
    }
}
