using ContentService.Services.Storage;
using Microsoft.Extensions.Options;

namespace ContentService.Services.Media;

/// <summary>
/// Turns queued source videos into a 360p/720p HLS ladder with 6-second segments and a thumbnail, writes
/// them under <c>content/{itemId}/hls/</c>, and records the duration from ffprobe. One job at a time per
/// instance; run more instances (or disable this on API-only ones) to scale.
/// </summary>
public sealed class VideoTranscodeWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IContentStorage _storage;
    private readonly TranscodeOptions _options;
    private readonly ILogger<VideoTranscodeWorker> _logger;

    public VideoTranscodeWorker(
        IServiceScopeFactory scopeFactory,
        IContentStorage storage,
        IOptions<ContentOptions> options,
        ILogger<VideoTranscodeWorker> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _scopeFactory = scopeFactory;
        _storage = storage;
        _options = options.Value.Transcode;
        _logger = logger;
    }

    private TimeSpan Timeout => TimeSpan.FromMinutes(Math.Max(1, _options.TimeoutMinutes));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Video transcoding is disabled on this instance");
            return;
        }

        var pollInterval = TimeSpan.FromSeconds(Math.Max(1, _options.PollIntervalSeconds));
        var nextReclaim = DateTime.MinValue;

        // Let migrations finish before the first query.
        await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var queue = scope.ServiceProvider.GetRequiredService<TranscodeJobStore>();

                if (DateTime.UtcNow >= nextReclaim)
                {
                    var reclaimed = await queue.ReclaimStaleAsync(Timeout + TimeSpan.FromMinutes(10), _options.MaxAttempts, stoppingToken);
                    if (reclaimed > 0)
                    {
                        _logger.LogWarning("Recovered {Count} abandoned transcode jobs", reclaimed);
                    }

                    nextReclaim = DateTime.UtcNow.AddMinutes(5);
                }

                var job = await queue.ClaimNextAsync(stoppingToken);
                if (job is null)
                {
                    await Task.Delay(pollInterval, stoppingToken);
                    continue;
                }

                await ProcessAsync(queue, job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Transcode loop failed; retrying after the poll interval");
                await Task.Delay(pollInterval, stoppingToken);
            }
        }
    }

    private async Task ProcessAsync(TranscodeJobStore queue, TranscodeJob job, CancellationToken cancellationToken)
    {
        var root = string.IsNullOrWhiteSpace(_options.WorkDirectory) ? Path.GetTempPath() : _options.WorkDirectory;
        var workDirectory = Path.Combine(root, "content-transcode", job.ItemId.ToString("N"));
        var outputDirectory = Path.Combine(workDirectory, "hls");

        _logger.LogInformation("Transcoding content item {ItemId}", job.ItemId);

        try
        {
            if (Directory.Exists(workDirectory))
            {
                Directory.Delete(workDirectory, recursive: true);
            }

            Directory.CreateDirectory(outputDirectory);

            var source = Path.Combine(workDirectory, "source" + Path.GetExtension(job.StorageKey));
            await using (var file = File.Create(source))
            {
                await _storage.CopyToAsync(job.StorageKey, file, cancellationToken: cancellationToken);
            }

            var probe = await ProbeAsync(source, cancellationToken);
            if (!probe.HasVideo)
            {
                await queue.FailAsync(job, "The uploaded file has no video stream.", cancellationToken);
                return;
            }

            var renditions = FfmpegArguments.SelectRenditions(probe.VideoHeight);
            var hls = await ProcessRunner.RunAsync(
                _options.FfmpegPath,
                FfmpegArguments.Hls(source, outputDirectory, renditions, probe.HasAudio),
                Timeout,
                cancellationToken);
            if (hls.ExitCode != 0)
            {
                _logger.LogError("ffmpeg failed for {ItemId} with exit code {ExitCode}: {Error}", job.ItemId, hls.ExitCode, hls.ErrorTail);
                await queue.FailAsync(job, $"ffmpeg exited with code {hls.ExitCode}: {hls.ErrorTail}", cancellationToken);
                return;
            }

            var thumbnailPath = Path.Combine(workDirectory, "thumbnail.jpg");
            var thumbnail = await ProcessRunner.RunAsync(
                _options.FfmpegPath,
                FfmpegArguments.Thumbnail(source, thumbnailPath, FfmpegArguments.ThumbnailTime(probe.DurationSeconds)),
                TimeSpan.FromMinutes(5),
                cancellationToken);

            var hlsPrefix = ContentStorageKeys.HlsPrefix(job.ItemId);
            await _storage.DeletePrefixAsync(hlsPrefix, cancellationToken);

            foreach (var path in Directory.EnumerateFiles(outputDirectory))
            {
                var name = Path.GetFileName(path);
                if (!HlsFileName.IsValid(name))
                {
                    continue;
                }

                await using var stream = File.OpenRead(path);
                await _storage.PutAsync(hlsPrefix + name, stream, stream.Length, HlsFileName.ContentTypeFor(name), cancellationToken);
            }

            string? thumbnailKey = null;
            if (thumbnail.ExitCode == 0 && File.Exists(thumbnailPath))
            {
                thumbnailKey = ContentStorageKeys.Thumbnail(job.ItemId);
                await using var stream = File.OpenRead(thumbnailPath);
                await _storage.PutAsync(thumbnailKey, stream, stream.Length, "image/jpeg", cancellationToken);
            }
            else
            {
                _logger.LogWarning("Thumbnail extraction failed for {ItemId}: {Error}", job.ItemId, thumbnail.ErrorTail);
            }

            var duration = probe.DurationSeconds is { } seconds ? (int?)Math.Round(seconds) : null;
            var recorded = await queue.CompleteAsync(job, duration, hlsPrefix, thumbnailKey, cancellationToken);

            if (recorded)
            {
                _logger.LogInformation(
                    "Content item {ItemId} transcoded: {Renditions} renditions, {Duration}s",
                    job.ItemId, renditions.Count, duration);
            }
            else
            {
                _logger.LogInformation("Content item {ItemId} changed while transcoding; result discarded", job.ItemId);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down: the claim is reclaimed as stale and retried by the next instance to start.
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transcoding content item {ItemId} failed", job.ItemId);
            await queue.FailAsync(job, ex.Message, CancellationToken.None);
        }
        finally
        {
            TryDelete(workDirectory);
        }
    }

    private async Task<FfprobeResult> ProbeAsync(string source, CancellationToken cancellationToken)
    {
        var outcome = await ProcessRunner.RunAsync(
            _options.FfprobePath, FfmpegArguments.Probe(source), TimeSpan.FromMinutes(2), cancellationToken);
        if (outcome.ExitCode != 0)
        {
            throw new InvalidOperationException($"ffprobe could not read the file: {outcome.ErrorTail}");
        }

        return FfprobeResult.Parse(outcome.StandardOutput);
    }

    private void TryDelete(string directory)
    {
        try
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "Could not remove transcode scratch directory {Directory}", directory);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Could not remove transcode scratch directory {Directory}", directory);
        }
    }
}
