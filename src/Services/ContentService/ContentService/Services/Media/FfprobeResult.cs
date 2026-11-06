using System.Globalization;
using System.Text.Json;

namespace ContentService.Services.Media;

/// <summary>The parts of <c>ffprobe -print_format json</c> output the transcoder needs.</summary>
public sealed record FfprobeResult(double? DurationSeconds, int? VideoHeight, bool HasVideo, bool HasAudio)
{
    public static FfprobeResult Parse(string json)
    {
        ArgumentNullException.ThrowIfNull(json);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        double? duration = null;
        if (root.TryGetProperty("format", out var format) &&
            format.TryGetProperty("duration", out var durationElement) &&
            double.TryParse(durationElement.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) &&
            parsed > 0)
        {
            duration = parsed;
        }

        int? height = null;
        var hasVideo = false;
        var hasAudio = false;

        if (root.TryGetProperty("streams", out var streams) && streams.ValueKind == JsonValueKind.Array)
        {
            foreach (var stream in streams.EnumerateArray())
            {
                var codecType = stream.TryGetProperty("codec_type", out var type) ? type.GetString() : null;

                if (codecType == "video" && !hasVideo && !IsAttachedPicture(stream))
                {
                    hasVideo = true;
                    if (stream.TryGetProperty("height", out var h) && h.TryGetInt32(out var value))
                    {
                        height = value;
                    }

                    if (duration is null &&
                        stream.TryGetProperty("duration", out var streamDuration) &&
                        double.TryParse(streamDuration.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) &&
                        d > 0)
                    {
                        duration = d;
                    }
                }
                else if (codecType == "audio")
                {
                    hasAudio = true;
                }
            }
        }

        return new FfprobeResult(duration, height, hasVideo, hasAudio);
    }

    /// <summary>Cover art embedded in an audio file shows up as a one-frame video stream.</summary>
    private static bool IsAttachedPicture(JsonElement stream) =>
        stream.TryGetProperty("disposition", out var disposition) &&
        disposition.TryGetProperty("attached_pic", out var attached) &&
        attached.TryGetInt32(out var flag) && flag == 1;
}
