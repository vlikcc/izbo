using System.Globalization;

namespace ContentService.Services.Media;

/// <summary>One rung of the HLS ladder.</summary>
public sealed record HlsRendition(string Name, int Height, int VideoKbps, int AudioKbps);

/// <summary>
/// Builds ffmpeg/ffprobe argument lists. Kept free of I/O so the exact command line is unit-tested;
/// arguments are passed through <see cref="System.Diagnostics.ProcessStartInfo.ArgumentList"/>, never a
/// shell, so file names cannot inject options.
/// </summary>
public static class FfmpegArguments
{
    public const int SegmentSeconds = 6;
    public const string MasterPlaylist = "master.m3u8";

    public static readonly IReadOnlyList<HlsRendition> Ladder =
    [
        new("360p", 360, 800, 96),
        new("720p", 720, 2800, 128),
    ];

    /// <summary>
    /// 360p is always produced so every video plays on a slow connection; higher rungs only when the
    /// source has the pixels for them, since upscaling costs bandwidth and adds nothing.
    /// </summary>
    public static IReadOnlyList<HlsRendition> SelectRenditions(int? sourceHeight)
    {
        var selected = Ladder
            .Where((rendition, index) => index == 0 || sourceHeight is null || sourceHeight.Value >= rendition.Height)
            .ToList();
        return selected;
    }

    public static IReadOnlyList<string> Probe(string input)
    {
        ArgumentException.ThrowIfNullOrEmpty(input);

        return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input];
    }

    public static IReadOnlyList<string> Hls(
        string input,
        string outputDirectory,
        IReadOnlyList<HlsRendition> renditions,
        bool hasAudio)
    {
        ArgumentException.ThrowIfNullOrEmpty(input);
        ArgumentException.ThrowIfNullOrEmpty(outputDirectory);
        ArgumentNullException.ThrowIfNull(renditions);
        if (renditions.Count == 0)
        {
            throw new ArgumentException("At least one rendition is required.", nameof(renditions));
        }

        var args = new List<string> { "-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i", input };

        // One decode, split into a scaled stream per rung. -2 keeps the width even, which libx264 needs.
        var filter = renditions.Count == 1
            ? $"[0:v]scale=-2:{renditions[0].Height}[v0out]"
            : $"[0:v]split={renditions.Count}{string.Concat(renditions.Select((_, i) => $"[v{i}]"))};"
              + string.Join(';', renditions.Select((r, i) => $"[v{i}]scale=-2:{r.Height}[v{i}out]"));
        args.Add("-filter_complex");
        args.Add(filter);

        for (var i = 0; i < renditions.Count; i++)
        {
            var r = renditions[i];
            var index = i.ToString(CultureInfo.InvariantCulture);
            args.AddRange(["-map", $"[v{index}out]"]);
            args.AddRange([$"-c:v:{index}", "libx264"]);
            args.AddRange([$"-b:v:{index}", Kbps(r.VideoKbps)]);
            args.AddRange([$"-maxrate:v:{index}", Kbps(r.VideoKbps * 107 / 100)]);
            args.AddRange([$"-bufsize:v:{index}", Kbps(r.VideoKbps * 3 / 2)]);

            if (hasAudio)
            {
                args.AddRange(["-map", "0:a:0"]);
                args.AddRange([$"-c:a:{index}", "aac"]);
                args.AddRange([$"-b:a:{index}", Kbps(r.AudioKbps)]);
            }
        }

        if (hasAudio)
        {
            args.AddRange(["-ac", "2"]);
        }

        var segment = SegmentSeconds.ToString(CultureInfo.InvariantCulture);
        args.AddRange([
            "-preset", "veryfast",
            "-profile:v", "main",
            "-pix_fmt", "yuv420p",
            // Keyframes on segment boundaries so every rung cuts at the same instants and the player can
            // switch quality mid-stream without a glitch.
            "-sc_threshold", "0",
            "-force_key_frames", $"expr:gte(t,n_forced*{segment})",
            "-f", "hls",
            "-hls_time", segment,
            "-hls_playlist_type", "vod",
            "-hls_flags", "independent_segments",
            "-hls_segment_type", "mpegts",
            "-hls_segment_filename", Path.Combine(outputDirectory, "%v_%03d.ts"),
            "-master_pl_name", MasterPlaylist,
            "-var_stream_map", string.Join(' ', renditions.Select((r, i) => hasAudio
                ? $"v:{i},a:{i},name:{r.Name}"
                : $"v:{i},name:{r.Name}")),
            Path.Combine(outputDirectory, "%v.m3u8"),
        ]);

        return args;
    }

    public static IReadOnlyList<string> Thumbnail(string input, string output, double atSeconds)
    {
        ArgumentException.ThrowIfNullOrEmpty(input);
        ArgumentException.ThrowIfNullOrEmpty(output);

        var at = Math.Max(0, atSeconds).ToString("0.###", CultureInfo.InvariantCulture);
        return
        [
            "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
            "-ss", at,
            "-i", input,
            "-frames:v", "1",
            "-vf", "scale=640:-2",
            "-q:v", "3",
            output,
        ];
    }

    /// <summary>A frame a few seconds in is more representative than the (often black) first one.</summary>
    public static double ThumbnailTime(double? durationSeconds) =>
        durationSeconds is > 0 ? Math.Min(5, durationSeconds.Value / 3) : 0;

    private static string Kbps(int value) => value.ToString(CultureInfo.InvariantCulture) + "k";
}
