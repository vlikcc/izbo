using System.Security.Cryptography;
using Shared.Models;

namespace SubscriptionService.Services.Learner;

/// <summary>Pure rules for student packages: term lengths, the summer window, order codes.</summary>
public static class LearnerRules
{
    private static readonly TimeZoneInfo Istanbul = FindIstanbul();

    // No 0/O or 1/I: the code is read off a phone and typed into a banking app.
    private const string ReferenceAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    /// <summary>A transfer-description code such as <c>YZK-8F3K2</c>.</summary>
    public static string NewReference()
    {
        Span<char> chars = stackalloc char[5];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = ReferenceAlphabet[RandomNumberGenerator.GetInt32(ReferenceAlphabet.Length)];
        }

        return "YZK-" + new string(chars);
    }

    /// <summary>When a pass bought now for <paramref name="term"/> ends, counting from <paramref name="startsAt"/>.</summary>
    public static DateTime EndsAt(LearnerTerm term, int durationDays, DateTime startsAt, DateTime now, int summerEndsMonth, int summerEndsDay)
    {
        if (term != LearnerTerm.Summer)
        {
            return startsAt.AddDays(durationDays);
        }

        // Summer ends on a fixed date: this year's if it is still ahead, otherwise next year's.
        var local = TimeZoneInfo.ConvertTimeFromUtc(now, Istanbul);
        var year = local.Year;
        var end = SummerEnd(year, summerEndsMonth, summerEndsDay);
        if (end <= now)
        {
            end = SummerEnd(year + 1, summerEndsMonth, summerEndsDay);
        }

        return end > startsAt ? end : startsAt.AddDays(durationDays > 0 ? durationDays : 1);
    }

    /// <summary>Whether the summer package is on sale on <paramref name="now"/> (by the Istanbul calendar month).</summary>
    public static bool IsSummerSaleOpen(DateTime now, int fromMonth, int toMonth)
    {
        var month = TimeZoneInfo.ConvertTimeFromUtc(now, Istanbul).Month;
        return month >= fromMonth && month <= toMonth;
    }

    private static DateTime SummerEnd(int year, int month, int day)
    {
        var local = new DateTime(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)), 23, 59, 59, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(local, Istanbul);
    }

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
