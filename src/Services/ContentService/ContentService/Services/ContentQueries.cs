using Microsoft.EntityFrameworkCore;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services;

internal static class ContentQueries
{
    /// <summary>
    /// What a student may see in listings: published, and actually playable — an embed with its URL, or
    /// media that finished processing. A published video still transcoding is not listed yet.
    /// </summary>
    public static IQueryable<ContentItem> ListedForEveryone(this IQueryable<ContentItem> query) =>
        query.Where(i => i.Status == ContentStatus.Published
            && ((i.Type == ContentItemType.Embed && i.EmbedUrl != null)
                || (i.Type != ContentItemType.Embed && i.ProcessingStatus == ContentProcessingStatus.Ready)));

    public static bool IsListedForEveryone(ContentItem item) =>
        item.Status == ContentStatus.Published
        && ((item.Type == ContentItemType.Embed && item.EmbedUrl != null)
            || (item.Type != ContentItemType.Embed && item.ProcessingStatus == ContentProcessingStatus.Ready));

    public static ContentProgressDto? ToDto(this ContentProgress? progress) =>
        progress is null ? null : new ContentProgressDto(progress.PositionSeconds, progress.Completed, progress.UpdatedAt);

    public static ContentItemSummaryDto ToSummary(this ContentItem item, ContentProgress? progress, bool locked = false) => new(
        item.Id,
        item.TopicId,
        item.Type,
        item.Title,
        item.DurationSeconds,
        item.AccessTier,
        item.Status,
        item.ProcessingStatus,
        item.ThumbnailKey != null,
        item.Order,
        progress.ToDto(),
        locked);

    /// <summary>The slug of the level an item belongs to (through topic, unit and subject).</summary>
    public static Task<string?> LevelSlugOfItemAsync(this ContentService.Data.ContentDbContext db, Guid itemId, CancellationToken cancellationToken) =>
        db.ContentItems.AsNoTracking()
            .Where(i => i.Id == itemId)
            .Select(i => i.Topic!.Unit!.Subject!.Level!.Slug)
            .FirstOrDefaultAsync(cancellationToken);

    public static LevelDto ToDto(this Level level) =>
        new(level.Id, level.Slug, level.Name, level.Kind, level.GradeNumber, level.Order);

    public static SubjectDto ToDto(this Subject subject) =>
        new(subject.Id, subject.LevelId, subject.Slug, subject.Name, subject.Color, subject.Order);

    public static LearningOutcomeDto ToDto(this LearningOutcome outcome) =>
        new(outcome.Id, outcome.TopicId, outcome.Code, outcome.Description);
}
