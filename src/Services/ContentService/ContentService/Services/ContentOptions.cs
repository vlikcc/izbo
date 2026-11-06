namespace ContentService.Services;

/// <summary>Bound from the <c>Content</c> configuration section.</summary>
public sealed class ContentOptions
{
    public const string SectionName = "Content";

    /// <summary>Largest accepted upload, in megabytes.</summary>
    public int MaxUploadMb { get; set; } = 2048;

    public TranscodeOptions Transcode { get; set; } = new();

    public long MaxUploadBytes => (long)Math.Max(1, MaxUploadMb) * 1024 * 1024;
}

public sealed class TranscodeOptions
{
    /// <summary>Turn off on instances that should only serve the API; another instance must then transcode.</summary>
    public bool Enabled { get; set; } = true;

    public string FfmpegPath { get; set; } = "ffmpeg";
    public string FfprobePath { get; set; } = "ffprobe";
    public int PollIntervalSeconds { get; set; } = 5;

    /// <summary>A single ffmpeg run is killed after this long.</summary>
    public int TimeoutMinutes { get; set; } = 240;

    /// <summary>Claims a crashed worker left behind are retried this many times before failing.</summary>
    public int MaxAttempts { get; set; } = 3;

    /// <summary>Scratch space for the source download and the HLS output. Defaults to the system temp dir.</summary>
    public string? WorkDirectory { get; set; }
}
