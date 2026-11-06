using System.Globalization;

namespace ContentService.Services.Media;

public enum ByteRangeKind
{
    /// <summary>No usable Range header: serve the whole object with 200.</summary>
    Full,

    /// <summary>Serve <see cref="ByteRange.Start"/>..<see cref="ByteRange.End"/> with 206.</summary>
    Partial,

    /// <summary>Answer 416 Range Not Satisfiable.</summary>
    Unsatisfiable
}

/// <summary>
/// A single-range <c>Range: bytes=…</c> request against an object of known length. Multi-range requests
/// are answered with the full body, which RFC 9110 permits and PDF viewers handle.
/// </summary>
public readonly record struct ByteRange(ByteRangeKind Kind, long Start, long End)
{
    public long Length => End - Start + 1;

    public static ByteRange Parse(string? header, long totalLength)
    {
        if (string.IsNullOrWhiteSpace(header) || totalLength <= 0)
        {
            return new ByteRange(ByteRangeKind.Full, 0, Math.Max(0, totalLength - 1));
        }

        var value = header.Trim();
        if (!value.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
        {
            return Full(totalLength);
        }

        var spec = value["bytes=".Length..].Trim();
        if (spec.Contains(',', StringComparison.Ordinal))
        {
            return Full(totalLength);
        }

        var dash = spec.IndexOf('-', StringComparison.Ordinal);
        if (dash < 0)
        {
            return Full(totalLength);
        }

        var startText = spec[..dash].Trim();
        var endText = spec[(dash + 1)..].Trim();

        if (startText.Length == 0)
        {
            // Suffix form: the last N bytes.
            if (!TryParseNonNegative(endText, out var suffix) || suffix == 0)
            {
                return Unsatisfiable(totalLength);
            }

            var count = Math.Min(suffix, totalLength);
            return new ByteRange(ByteRangeKind.Partial, totalLength - count, totalLength - 1);
        }

        if (!TryParseNonNegative(startText, out var start))
        {
            return Full(totalLength);
        }

        if (start >= totalLength)
        {
            return Unsatisfiable(totalLength);
        }

        long end;
        if (endText.Length == 0)
        {
            end = totalLength - 1;
        }
        else if (!TryParseNonNegative(endText, out end) || end < start)
        {
            return Full(totalLength);
        }

        return new ByteRange(ByteRangeKind.Partial, start, Math.Min(end, totalLength - 1));
    }

    private static ByteRange Full(long totalLength) => new(ByteRangeKind.Full, 0, totalLength - 1);

    private static ByteRange Unsatisfiable(long totalLength) => new(ByteRangeKind.Unsatisfiable, 0, totalLength - 1);

    private static bool TryParseNonNegative(string text, out long value) =>
        long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out value);
}
