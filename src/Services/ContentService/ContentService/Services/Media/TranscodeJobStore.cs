using ContentService.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Models;

namespace ContentService.Services.Media;

/// <summary>A claimed transcode job: the item and the exact source object it was claimed for.</summary>
public sealed record TranscodeJob(Guid ItemId, string StorageKey);

/// <summary>
/// The transcode queue is the <c>content_items</c> table itself: <c>processing_status = 'Queued'</c> rows
/// are waiting. Claims use <c>FOR UPDATE SKIP LOCKED</c>, so any number of worker instances can poll the
/// same table without two of them taking the same video.
/// </summary>
public sealed class TranscodeJobStore
{
    private const string ClaimSql = """
        UPDATE content_items
           SET processing_status = 'Processing',
               processing_started_at = now(),
               processing_attempts = processing_attempts + 1,
               processing_error = NULL
         WHERE id = (
               SELECT id FROM content_items
                WHERE processing_status = 'Queued' AND storage_key IS NOT NULL
                ORDER BY updated_at
                LIMIT 1
                FOR UPDATE SKIP LOCKED)
        RETURNING id, storage_key
        """;

    private readonly ContentDbContext _db;

    public TranscodeJobStore(ContentDbContext db) => _db = db;

    public async Task<TranscodeJob?> ClaimNextAsync(CancellationToken cancellationToken = default)
    {
        var connection = _db.Database.GetDbConnection();
        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = ClaimSql;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            return new TranscodeJob(reader.GetGuid(0), reader.GetString(1));
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
        }
    }

    /// <summary>
    /// Records a finished transcode. Conditional on the claim still being current: if the owner uploaded a
    /// replacement while ffmpeg ran, the row was re-queued with a new source and this result is stale.
    /// </summary>
    public async Task<bool> CompleteAsync(
        TranscodeJob job,
        int? durationSeconds,
        string hlsPrefix,
        string? thumbnailKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(job);

        var now = DateTime.UtcNow;
        var updated = await _db.ContentItems
            .Where(i => i.Id == job.ItemId
                && i.ProcessingStatus == ContentProcessingStatus.Processing
                && i.StorageKey == job.StorageKey)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.ProcessingStatus, ContentProcessingStatus.Ready)
                .SetProperty(i => i.ProcessingError, (string?)null)
                .SetProperty(i => i.DurationSeconds, durationSeconds)
                .SetProperty(i => i.HlsPrefix, hlsPrefix)
                .SetProperty(i => i.ThumbnailKey, thumbnailKey)
                .SetProperty(i => i.UpdatedAt, now), cancellationToken);
        return updated == 1;
    }

    public async Task FailAsync(TranscodeJob job, string error, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(job);
        ArgumentNullException.ThrowIfNull(error);

        var message = error.Length > 2000 ? error[..2000] : error;
        var now = DateTime.UtcNow;
        await _db.ContentItems
            .Where(i => i.Id == job.ItemId
                && i.ProcessingStatus == ContentProcessingStatus.Processing
                && i.StorageKey == job.StorageKey)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.ProcessingStatus, ContentProcessingStatus.Failed)
                .SetProperty(i => i.ProcessingError, message)
                .SetProperty(i => i.UpdatedAt, now), cancellationToken);
    }

    /// <summary>
    /// Returns claims abandoned by a worker that died mid-job to the queue, or fails them once they have
    /// used up their attempts, so a crash never leaves a video "Processing" forever.
    /// </summary>
    public async Task<int> ReclaimStaleAsync(TimeSpan staleAfter, int maxAttempts, CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow - staleAfter;
        var now = DateTime.UtcNow;

        var requeued = await _db.ContentItems
            .Where(i => i.ProcessingStatus == ContentProcessingStatus.Processing
                && i.ProcessingStartedAt < cutoff
                && i.ProcessingAttempts < maxAttempts)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.ProcessingStatus, ContentProcessingStatus.Queued)
                .SetProperty(i => i.UpdatedAt, now), cancellationToken);

        var failed = await _db.ContentItems
            .Where(i => i.ProcessingStatus == ContentProcessingStatus.Processing
                && i.ProcessingStartedAt < cutoff
                && i.ProcessingAttempts >= maxAttempts)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.ProcessingStatus, ContentProcessingStatus.Failed)
                .SetProperty(i => i.ProcessingError, "Transcoding did not finish; the worker was interrupted.")
                .SetProperty(i => i.UpdatedAt, now), cancellationToken);

        return requeued + failed;
    }
}
