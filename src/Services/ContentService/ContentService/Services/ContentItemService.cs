using ContentService.Data;
using ContentService.Services.Media;
using ContentService.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shared.Audit;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using Shared.Subscription;

namespace ContentService.Services;

public interface IContentItemService
{
    Task<ContentResult<ContentItemDto>> CreateAsync(CreateContentItemRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> GetAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> UpdateAsync(Guid id, UpdateContentItemRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<ContentItemSummaryDto>> GetMineAsync(Caller caller, PagedRequest paging, CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams a media file into object storage. Ownership is checked before a byte of
    /// <paramref name="body"/> is read. Videos are queued for transcoding; documents are ready at once.
    /// </summary>
    Task<ContentResult<ContentItemDto>> UploadAsync(Guid id, Stream body, string fileName, Caller caller, CancellationToken cancellationToken = default);

    Task<ContentResult<ContentItemDto>> SubmitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> ReviewAsync(Guid id, ReviewContentRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);
    Task<PagedResponse<ContentItemDto>> GetReviewQueueAsync(PagedRequest paging, CancellationToken cancellationToken = default);
    Task<ContentResult<ContentItemDto>> RetryProcessingAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>The item when the caller may play it; null otherwise (reported as 404, so ids can't be probed).</summary>
    Task<ContentItem?> FindViewableAsync(Guid id, Caller caller, CancellationToken cancellationToken = default);

    /// <summary>A published item, for unauthenticated thumbnail requests from public pages.</summary>
    Task<ContentItem?> FindPublishedAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ContentResult<ContentProgressDto>> SaveProgressAsync(Guid id, UpdateProgressRequest request, Caller caller, CancellationToken cancellationToken = default);
    Task<List<ContinueWatchingDto>> GetContinueAsync(Caller caller, int take = 5, CancellationToken cancellationToken = default);

    /// <summary>
    /// What a student studied since a point in time. The caller must already have checked that the asker may
    /// follow this student (the student, a linked parent, or an administrator).
    /// </summary>
    Task<StudentContentActivityDto> GetStudentActivityAsync(Guid studentId, DateTime since, int take = 5, CancellationToken cancellationToken = default);
}

public class ContentItemService : IContentItemService
{
    private readonly ContentDbContext _db;
    private readonly IContentStorage _storage;
    private readonly IContentAccessPolicy _accessPolicy;
    private readonly IQuotaGuard _quotaGuard;
    private readonly IAuditLogger _audit;
    private readonly ContentOptions _options;
    private readonly ILogger<ContentItemService> _logger;

    public ContentItemService(
        ContentDbContext db,
        IContentStorage storage,
        IContentAccessPolicy accessPolicy,
        IQuotaGuard quotaGuard,
        IAuditLogger audit,
        IOptions<ContentOptions> options,
        ILogger<ContentItemService> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _db = db;
        _storage = storage;
        _accessPolicy = accessPolicy;
        _quotaGuard = quotaGuard;
        _audit = audit;
        _options = options.Value;
        _logger = logger;
    }

    // ---- Authoring ----

    public async Task<ContentResult<ContentItemDto>> CreateAsync(CreateContentItemRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.CanManageContent)
        {
            return ContentResult.Forbidden<ContentItemDto>("Only teachers and administrators can create content");
        }

        if (!await _db.Topics.AnyAsync(t => t.Id == request.TopicId, cancellationToken))
        {
            return ContentResult.Invalid<ContentItemDto>("Topic not found");
        }

        var outcomeError = await ValidateOutcomesAsync(request.TopicId, request.OutcomeIds, cancellationToken);
        if (outcomeError is not null)
        {
            return ContentResult.Invalid<ContentItemDto>(outcomeError);
        }

        var now = DateTime.UtcNow;
        var item = new ContentItem
        {
            Id = Guid.NewGuid(),
            TopicId = request.TopicId,
            Type = request.Type,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            AccessTier = request.AccessTier,
            Status = ContentStatus.Draft,
            OwnerId = caller.UserId,
            OwnerKind = caller.IsPlatformAdmin ? ContentOwnerKind.Platform : ContentOwnerKind.Teacher,
            EmbedUrl = request.Type == ContentItemType.Embed ? request.EmbedUrl : null,
            ProcessingStatus = ContentProcessingStatus.None,
            Order = request.Order ?? (await _db.ContentItems
                .Where(i => i.TopicId == request.TopicId)
                .Select(i => (int?)i.Order)
                .MaxAsync(cancellationToken) ?? 0) + 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var outcomeId in (request.OutcomeIds ?? []).Distinct())
        {
            item.Outcomes.Add(new ContentItemOutcome { ContentItemId = item.Id, LearningOutcomeId = outcomeId });
        }

        _db.ContentItems.Add(item);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Content item {ItemId} created by {UserId}", item.Id, caller.UserId);
        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> GetAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var item = await FindViewableAsync(id, caller, cancellationToken);
        return item is null
            ? ContentResult.NotFound<ContentItemDto>("Content not found")
            : ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> UpdateAsync(Guid id, UpdateContentItemRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var (item, failure) = await FindManageableAsync(id, caller, cancellationToken);
        if (item is null)
        {
            return failure!;
        }

        var topicId = request.TopicId ?? item.TopicId;
        if (topicId != item.TopicId && !await _db.Topics.AnyAsync(t => t.Id == topicId, cancellationToken))
        {
            return ContentResult.Invalid<ContentItemDto>("Topic not found");
        }

        if (request.EmbedUrl is not null && item.Type != ContentItemType.Embed)
        {
            return ContentResult.Invalid<ContentItemDto>("Only embed content has an embed URL");
        }

        var outcomeError = await ValidateOutcomesAsync(topicId, request.OutcomeIds, cancellationToken);
        if (outcomeError is not null)
        {
            return ContentResult.Invalid<ContentItemDto>(outcomeError);
        }

        await _db.Entry(item).Collection(i => i.Outcomes).LoadAsync(cancellationToken);

        if (request.Title is not null) item.Title = request.Title.Trim();
        if (request.Description is not null) item.Description = request.Description.Trim();
        if (request.AccessTier.HasValue) item.AccessTier = request.AccessTier.Value;
        if (request.EmbedUrl is not null) item.EmbedUrl = request.EmbedUrl;
        if (request.Order.HasValue) item.Order = request.Order.Value;

        if (request.OutcomeIds is not null || topicId != item.TopicId)
        {
            // Outcomes belong to a topic, so moving the item without a new list drops the old ones.
            item.Outcomes.Clear();
            foreach (var outcomeId in (request.OutcomeIds ?? []).Distinct())
            {
                item.Outcomes.Add(new ContentItemOutcome { ContentItemId = item.Id, LearningOutcomeId = outcomeId });
            }
        }

        item.TopicId = topicId;
        ReturnTeacherEditToDraft(item, caller);
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<bool>> DeleteAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var (item, _) = await FindManageableAsync(id, caller, cancellationToken);
        if (item is null)
        {
            return ContentResult.NotFound<bool>("Content not found");
        }

        if (item.ProcessingStatus == ContentProcessingStatus.Processing)
        {
            return ContentResult.Conflict<bool>("The video is being processed; try again when it finishes");
        }

        try
        {
            await _storage.DeletePrefixAsync(ContentStorageKeys.ItemPrefix(item.Id), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The row still goes: leaving it would make the item undeletable while storage is down.
            _logger.LogWarning(ex, "Could not remove stored media for content item {ItemId}", item.Id);
        }

        var releasedBytes = item.OwnerKind == ContentOwnerKind.Teacher ? item.FileSize : null;

        _db.ContentItems.Remove(item);
        await _db.SaveChangesAsync(cancellationToken);

        if (releasedBytes is > 0)
        {
            await _quotaGuard.ReleaseAsync(QuotaMetric.StorageMegabytes, ToMegabytes(releasedBytes.Value), cancellationToken);
        }

        await _audit.WriteAsync(new AuditRecord("ContentItemDeleted", caller.UserId, "ContentItem", id.ToString()), cancellationToken);
        return ContentResult.Ok(true);
    }

    public async Task<PagedResponse<ContentItemSummaryDto>> GetMineAsync(Caller caller, PagedRequest paging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);
        ArgumentNullException.ThrowIfNull(paging);

        var query = _db.ContentItems.AsNoTracking().Where(i => i.OwnerId == caller.UserId);
        var total = await query.CountAsync(cancellationToken);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;

        var items = await query
            .OrderByDescending(i => i.UpdatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        return new PagedResponse<ContentItemSummaryDto>(
            items.Select(i => i.ToSummary(null)).ToList(),
            page,
            size,
            total,
            (int)Math.Ceiling(total / (double)size));
    }

    // ---- Upload ----

    public async Task<ContentResult<ContentItemDto>> UploadAsync(Guid id, Stream body, string fileName, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(body);

        var (item, failure) = await FindManageableAsync(id, caller, cancellationToken);
        if (item is null)
        {
            return failure!;
        }

        if (item.Type == ContentItemType.Embed)
        {
            return ContentResult.Invalid<ContentItemDto>("Embed content has no file; set its URL instead");
        }

        if (item.ProcessingStatus == ContentProcessingStatus.Processing)
        {
            return ContentResult.Conflict<ContentItemDto>("The previous video is still being processed");
        }

        var head = new byte[ContentUploadRules.SniffLength];
        var headLength = await body.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false, cancellationToken);
        if (headLength == 0)
        {
            return ContentResult.Invalid<ContentItemDto>("The file is empty");
        }

        var check = ContentUploadRules.Check(item.Type, fileName, head.AsSpan(0, headLength));
        if (!check.IsValid)
        {
            return ContentResult.Invalid<ContentItemDto>(check.Error!);
        }

        var key = ContentStorageKeys.Source(item.Id, check.Extension);
        var previousKey = item.StorageKey;
        var previousSize = item.FileSize;

        await using var limited = new LimitedReadStream(
            new PrefixedReadStream(head[..headLength], body), _options.MaxUploadBytes);
        var size = await _storage.PutAsync(key, limited, -1, check.ContentType, cancellationToken);

        var chargesQuota = item.OwnerKind == ContentOwnerKind.Teacher;
        if (chargesQuota)
        {
            try
            {
                await _quotaGuard.TryConsumeAsync(QuotaMetric.StorageMegabytes, ToMegabytes(size), cancellationToken);
            }
            catch (QuotaExceededException)
            {
                await _storage.DeleteAsync(key, CancellationToken.None);
                throw;
            }
        }

        if (previousKey is not null && previousKey != key)
        {
            await TryDeleteAsync(previousKey);
        }

        if (chargesQuota && previousSize is > 0)
        {
            await _quotaGuard.ReleaseAsync(QuotaMetric.StorageMegabytes, ToMegabytes(previousSize.Value), cancellationToken);
        }

        item.StorageKey = key;
        item.OriginalFileName = SanitizeFileName(fileName);
        item.FileContentType = check.ContentType;
        item.FileSize = size;
        item.ProcessingError = null;

        if (item.IsVideo)
        {
            // The ladder and thumbnail are rebuilt from the new source; until then nothing stale is served.
            item.ProcessingStatus = ContentProcessingStatus.Queued;
            item.ProcessingAttempts = 0;
            item.ProcessingStartedAt = null;
            item.HlsPrefix = null;
            item.ThumbnailKey = null;
            item.DurationSeconds = null;
        }
        else
        {
            item.ProcessingStatus = ContentProcessingStatus.Ready;
        }

        ReturnTeacherEditToDraft(item, caller);
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Uploaded {Bytes} bytes for content item {ItemId}", size, item.Id);
        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> RetryProcessingAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        var (item, failure) = await FindManageableAsync(id, caller, cancellationToken);
        if (item is null)
        {
            return failure!;
        }

        if (!item.IsVideo || item.StorageKey is null)
        {
            return ContentResult.Invalid<ContentItemDto>("Only an uploaded video can be reprocessed");
        }

        if (item.ProcessingStatus != ContentProcessingStatus.Failed)
        {
            return ContentResult.Conflict<ContentItemDto>("Only failed processing can be retried");
        }

        item.ProcessingStatus = ContentProcessingStatus.Queued;
        item.ProcessingAttempts = 0;
        item.ProcessingError = null;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    // ---- Review workflow ----

    public async Task<ContentResult<ContentItemDto>> SubmitAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var item = await _db.ContentItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null || !item.OwnerId.Equals(caller.UserId))
        {
            return ContentResult.NotFound<ContentItemDto>("Content not found");
        }

        if (item.Status is not (ContentStatus.Draft or ContentStatus.Rejected))
        {
            return ContentResult.Conflict<ContentItemDto>($"Content in status {item.Status} cannot be submitted");
        }

        var hasMedia = item.Type == ContentItemType.Embed
            ? item.EmbedUrl is not null
            : item.ProcessingStatus is ContentProcessingStatus.Queued or ContentProcessingStatus.Processing or ContentProcessingStatus.Ready;
        if (!hasMedia)
        {
            return ContentResult.Invalid<ContentItemDto>("Upload the media before submitting for review");
        }

        item.Status = ContentStatus.InReview;
        item.SubmittedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> ReviewAsync(Guid id, ReviewContentRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<ContentItemDto>("Only administrators review content");
        }

        var item = await _db.ContentItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return ContentResult.NotFound<ContentItemDto>("Content not found");
        }

        if (item.Status != ContentStatus.InReview)
        {
            return ContentResult.Conflict<ContentItemDto>("Only content waiting for review can be reviewed");
        }

        var now = DateTime.UtcNow;
        item.Status = request.Approve ? ContentStatus.Published : ContentStatus.Rejected;
        item.ReviewNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        item.ReviewedAt = now;
        item.ReviewedBy = caller.UserId;
        item.UpdatedAt = now;
        if (request.Approve)
        {
            item.PublishedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(
            new AuditRecord(request.Approve ? "ContentApproved" : "ContentRejected", caller.UserId, "ContentItem", id.ToString(), item.ReviewNote),
            cancellationToken);

        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> PublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<ContentItemDto>("Only administrators publish directly");
        }

        var item = await _db.ContentItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return ContentResult.NotFound<ContentItemDto>("Content not found");
        }

        var now = DateTime.UtcNow;
        item.Status = ContentStatus.Published;
        item.PublishedAt ??= now;
        item.ReviewedAt = now;
        item.ReviewedBy = caller.UserId;
        item.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("ContentPublished", caller.UserId, "ContentItem", id.ToString()), cancellationToken);

        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<ContentResult<ContentItemDto>> UnpublishAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<ContentItemDto>("Only administrators unpublish content");
        }

        var item = await _db.ContentItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return ContentResult.NotFound<ContentItemDto>("Content not found");
        }

        item.Status = ContentStatus.Draft;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.WriteAsync(new AuditRecord("ContentUnpublished", caller.UserId, "ContentItem", id.ToString()), cancellationToken);

        return ContentResult.Ok(await ToDtoAsync(item.Id, caller, cancellationToken));
    }

    public async Task<PagedResponse<ContentItemDto>> GetReviewQueueAsync(PagedRequest paging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(paging);

        var query = _db.ContentItems.AsNoTracking().Where(i => i.Status == ContentStatus.InReview);
        var total = await query.CountAsync(cancellationToken);
        var page = paging.NormalizedPage;
        var size = paging.NormalizedPageSize;

        var items = await query
            .Include(i => i.Topic)
            .Include(i => i.Outcomes).ThenInclude(o => o.LearningOutcome)
            .OrderBy(i => i.SubmittedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return new PagedResponse<ContentItemDto>(
            items.Select(i => ToDto(i, null)).ToList(),
            page,
            size,
            total,
            (int)Math.Ceiling(total / (double)size));
    }

    // ---- Playback ----

    public async Task<ContentItem?> FindViewableAsync(Guid id, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var item = await _db.ContentItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        if (caller.IsPlatformAdmin || item.OwnerId == caller.UserId)
        {
            return item;
        }

        // Draft, in-review and rejected content exists only for its author and the reviewers.
        if (item.Status != ContentStatus.Published)
        {
            return null;
        }

        return await _accessPolicy.CanConsumeAsync(caller, item, cancellationToken) ? item : null;
    }

    public Task<ContentItem?> FindPublishedAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.ContentItems.AsNoTracking()
            .ListedForEveryone()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

    // ---- Progress ----

    public async Task<ContentResult<ContentProgressDto>> SaveProgressAsync(Guid id, UpdateProgressRequest request, Caller caller, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var item = await FindViewableAsync(id, caller, cancellationToken);
        if (item is null)
        {
            return ContentResult.NotFound<ContentProgressDto>("Content not found");
        }

        var position = item.DurationSeconds is > 0
            ? Math.Min(request.PositionSeconds, item.DurationSeconds.Value)
            : request.PositionSeconds;

        // Watching nine tenths of a video counts as finishing it — nobody sits through the outro.
        var completed = request.Completed
            || (item.DurationSeconds is > 0 && position >= item.DurationSeconds.Value * 0.9);
        var now = DateTime.UtcNow;

        // One statement so two tabs reporting at once cannot race to insert the same (user, item) row.
        // Completion is sticky: rewatching a finished lesson does not un-finish it.
        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO content_progress (id, user_id, content_item_id, position_seconds, completed, updated_at)
            VALUES ({Guid.NewGuid()}, {caller.UserId}, {id}, {position}, {completed}, {now})
            ON CONFLICT (user_id, content_item_id) DO UPDATE
               SET position_seconds = EXCLUDED.position_seconds,
                   completed = content_progress.completed OR EXCLUDED.completed,
                   updated_at = EXCLUDED.updated_at
            """, cancellationToken);

        var saved = await _db.Progress.AsNoTracking()
            .FirstAsync(p => p.UserId == caller.UserId && p.ContentItemId == id, cancellationToken);
        return ContentResult.Ok(saved.ToDto()!);
    }

    public async Task<List<ContinueWatchingDto>> GetContinueAsync(Caller caller, int take = 5, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var rows = await _db.Progress.AsNoTracking()
            .Where(p => p.UserId == caller.UserId && !p.Completed)
            .Join(_db.ContentItems.ListedForEveryone(), p => p.ContentItemId, i => i.Id, (p, i) => new { Progress = p, Item = i })
            .OrderByDescending(x => x.Progress.UpdatedAt)
            .Take(Math.Clamp(take, 1, 20))
            .Select(x => new
            {
                x.Progress,
                x.Item,
                SubjectId = x.Item.Topic!.Unit!.SubjectId,
                SubjectName = x.Item.Topic.Unit.Subject!.Name,
                TopicName = x.Item.Topic.Name
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new ContinueWatchingDto(
                r.Item.ToSummary(r.Progress),
                r.SubjectId,
                r.SubjectName,
                r.TopicName,
                r.Progress.PositionSeconds,
                r.Progress.UpdatedAt))
            .ToList();
    }

    public async Task<StudentContentActivityDto> GetStudentActivityAsync(
        Guid studentId,
        DateTime since,
        int take = 5,
        CancellationToken cancellationToken = default)
    {
        var sinceUtc = DateTime.SpecifyKind(since, DateTimeKind.Utc);
        var recentProgress = _db.Progress.AsNoTracking()
            .Where(p => p.UserId == studentId && p.UpdatedAt >= sinceUtc)
            .Join(_db.ContentItems.ListedForEveryone(), p => p.ContentItemId, i => i.Id, (p, i) => new { Progress = p, Item = i });

        var studied = await recentProgress.CountAsync(cancellationToken);
        var completed = await recentProgress.CountAsync(x => x.Progress.Completed, cancellationToken);

        var rows = await recentProgress
            .OrderByDescending(x => x.Progress.UpdatedAt)
            .Take(Math.Clamp(take, 1, 20))
            .Select(x => new
            {
                x.Progress,
                x.Item,
                SubjectId = x.Item.Topic!.Unit!.SubjectId,
                SubjectName = x.Item.Topic.Unit.Subject!.Name,
                TopicName = x.Item.Topic.Name
            })
            .ToListAsync(cancellationToken);

        var recent = rows
            .Select(r => new ContinueWatchingDto(
                r.Item.ToSummary(r.Progress),
                r.SubjectId,
                r.SubjectName,
                r.TopicName,
                r.Progress.PositionSeconds,
                r.Progress.UpdatedAt))
            .ToList();

        return new StudentContentActivityDto(studentId, sinceUtc, studied, completed, recent);
    }

    // ---- Helpers ----

    /// <summary>
    /// Teachers manage only their own items; administrators manage everything. A teacher touching
    /// someone else's item gets 403 when the item is visible to them anyway (published), and 404 when it
    /// is not, so drafts cannot be discovered by guessing ids.
    /// </summary>
    private async Task<(ContentItem? Item, ContentResult<ContentItemDto>? Failure)> FindManageableAsync(
        Guid id, Caller caller, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var item = await _db.ContentItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null)
        {
            return (null, ContentResult.NotFound<ContentItemDto>("Content not found"));
        }

        if (caller.IsPlatformAdmin || (caller.CanManageContent && item.OwnerId == caller.UserId))
        {
            return (item, null);
        }

        _logger.LogWarning("User {UserId} attempted to modify content item {ItemId} owned by {OwnerId}", caller.UserId, id, item.OwnerId);
        return item.Status == ContentStatus.Published
            ? (null, ContentResult.Forbidden<ContentItemDto>("You can only change your own content"))
            : (null, ContentResult.NotFound<ContentItemDto>("Content not found"));
    }

    /// <summary>
    /// Approval covers what the reviewer saw. When a teacher changes approved or pending content it goes
    /// back to Draft and must be resubmitted; administrators' edits keep the status.
    /// </summary>
    private static void ReturnTeacherEditToDraft(ContentItem item, Caller caller)
    {
        if (caller.IsPlatformAdmin || item.Status == ContentStatus.Draft)
        {
            return;
        }

        item.Status = ContentStatus.Draft;
        item.SubmittedAt = null;
    }

    private async Task<string?> ValidateOutcomesAsync(Guid topicId, List<Guid>? outcomeIds, CancellationToken cancellationToken)
    {
        if (outcomeIds is null || outcomeIds.Count == 0)
        {
            return null;
        }

        var distinct = outcomeIds.Distinct().ToList();
        var matching = await _db.LearningOutcomes.CountAsync(o => o.TopicId == topicId && distinct.Contains(o.Id), cancellationToken);
        return matching == distinct.Count ? null : "Every outcome must belong to the item's topic";
    }

    private async Task<ContentItemDto> ToDtoAsync(Guid id, Caller caller, CancellationToken cancellationToken)
    {
        var item = await _db.ContentItems.AsNoTracking()
            .Include(i => i.Topic)
            .Include(i => i.Outcomes).ThenInclude(o => o.LearningOutcome)
            .AsSplitQuery()
            .FirstAsync(i => i.Id == id, cancellationToken);
        var progress = await _db.Progress.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == caller.UserId && p.ContentItemId == id, cancellationToken);
        return ToDto(item, progress);
    }

    private static ContentItemDto ToDto(ContentItem item, ContentProgress? progress) => new(
        item.Id,
        item.TopicId,
        item.Topic?.Name ?? string.Empty,
        item.Type,
        item.Title,
        item.Description,
        item.DurationSeconds,
        item.AccessTier,
        item.Status,
        item.ReviewNote,
        item.OwnerId,
        item.OwnerKind,
        item.Order,
        item.ProcessingStatus,
        item.ProcessingError,
        item.OriginalFileName,
        item.FileSize,
        item.ThumbnailKey != null,
        item.EmbedUrl,
        item.Outcomes
            .Where(o => o.LearningOutcome != null)
            .Select(o => o.LearningOutcome!.ToDto())
            .OrderBy(o => o.Code, StringComparer.Ordinal)
            .ToList(),
        item.CreatedAt,
        item.UpdatedAt,
        item.SubmittedAt,
        item.PublishedAt,
        progress.ToDto());

    private async Task TryDeleteAsync(string key)
    {
        try
        {
            await _storage.DeleteAsync(key, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not remove replaced object {Key}", key);
        }
    }

    private static long ToMegabytes(long bytes) => Math.Max(1, (long)Math.Ceiling(bytes / (1024.0 * 1024.0)));

    /// <summary>Kept for display only; never used to build a storage key.</summary>
    private static string SanitizeFileName(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
        var cleaned = new string(name.Where(c => !char.IsControl(c) && c is not ('"' or '<' or '>' or '|')).ToArray()).Trim();
        if (cleaned.Length == 0)
        {
            return "upload";
        }

        return cleaned.Length > 255 ? cleaned[^255..] : cleaned;
    }
}
