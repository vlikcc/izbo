namespace ContentService.Kampus;

/// <summary>
/// Days and weeks as the children live them: in Türkiye (UTC+3, no DST since 2016). The daily ⭐ limit
/// resets at local midnight, the Yıldız Kupası week starts Monday 00:00 local time.
/// </summary>
public sealed class KampusClock
{
    /// <summary>The first cup week (9 Kasım 2026); themes and weekly tasks rotate from it.</summary>
    public static readonly DateOnly FirstCupWeek = new(2026, 11, 9);

    private static readonly TimeZoneInfo Istanbul = FindIstanbul();
    private readonly TimeProvider _time;

    public KampusClock(TimeProvider time)
    {
        _time = time ?? throw new ArgumentNullException(nameof(time));
    }

    public DateTime UtcNow => _time.GetUtcNow().UtcDateTime;

    public DateOnly Today => DayOf(UtcNow);

    public DateOnly ThisWeek => WeekOf(UtcNow);

    public static DateOnly DayOf(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Istanbul));

    /// <summary>The Monday of the local week containing <paramref name="utc"/>.</summary>
    public static DateOnly WeekOf(DateTime utc)
    {
        var day = DayOf(utc);
        return day.AddDays(-(((int)day.DayOfWeek + 6) % 7));
    }

    /// <summary>UTC instant of local midnight at the start of <paramref name="day"/>.</summary>
    public static DateTime StartOf(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Istanbul);

    /// <summary>Whole weeks between the first cup week and <paramref name="week"/> (may be negative).</summary>
    public static int WeekIndex(DateOnly week) => (int)Math.Round((week.DayNumber - FirstCupWeek.DayNumber) / 7.0);

    private static TimeZoneInfo FindIstanbul()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("Europe/Istanbul", TimeSpan.FromHours(3), "Istanbul", "Istanbul");
        }
    }
}
