using System.Text.Json;
using System.Text.Json.Serialization;

namespace ContentService.Kampus.Catalog;

// The server's copy of the YZ Kampüs content (topics, books, games, avatar items, assessment bank) with
// answer keys. Generated from the frontend by scripts/kampus/export-catalog.mjs; the frontend stays the
// source of truth until this content moves into the curriculum/question bank.

public sealed record CatalogOption(string V, string Label);

public sealed record CatalogQuestion(
    string Id,
    string Type,
    IReadOnlyList<string>? Answer,
    int? Pairs,
    string? Skill,
    IReadOnlyList<CatalogOption>? Options,
    int? Grade = null,
    string? Prompt = null,
    string? Input = null);

public sealed record CatalogTopic(
    string? Course,
    int? Grade,
    string? Subject,
    string Title,
    bool Meeting,
    IReadOnlyList<string> Stops,
    IReadOnlyList<CatalogQuestion> Exercises,
    IReadOnlyList<CatalogQuestion> TestPool,
    IReadOnlyList<CatalogQuestion> Practice,
    IReadOnlyList<CatalogQuestion> Check);

public sealed record CatalogCourse(int Grade, string Subject, IReadOnlyList<string> Topics);

public sealed record CatalogStopType(int Kp, bool Sheet);

public sealed record CatalogCupTask(string Id, IReadOnlyList<string> Stops, string Label, string Icon);

public sealed record CatalogNickNoun(string Name, string Emoji);

public sealed record CatalogCupTheme(string Id, string Name);

public sealed record CatalogCup(
    int Winners,
    int GroupSize,
    IReadOnlyList<CatalogCupTheme> Themes,
    IReadOnlyList<CatalogCupTask> TaskPool,
    IReadOnlyList<string> WeeklyTasks,
    IReadOnlyList<string> BonusTasks,
    IReadOnlyList<string> NickAdjectives,
    IReadOnlyList<CatalogNickNoun> NickNouns);

public sealed record CatalogBookQuestion(string Id, string Answer);

public sealed record CatalogBook(string Id, string Title, int Grade, IReadOnlyList<CatalogBookQuestion> Questions);

public sealed record CatalogGame(string Id, string Title, string Subject, int Rounds);

public sealed record CatalogAvatarItem(string Id, string Slot, string Name, int Price);

public sealed record CatalogAvatar(
    IReadOnlyDictionary<string, string> Default,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Base,
    IReadOnlyList<CatalogAvatarItem> Items);

public sealed record CatalogSkill(string Subject, string Name, string? Can, string? Study, string Course, string? TopicId);

public sealed record CatalogKpRules(
    int Anlatim, int Alistirma, int Minitest, int Ozet, int KitapBitir, int KitapSoru, int KitapMax, int Oyun, int Gunluk, int Bonus);

public sealed class KampusCatalogData
{
    public required IReadOnlyDictionary<string, IReadOnlyList<string>> Grades { get; init; }
    public required IReadOnlyDictionary<string, CatalogCourse> Courses { get; init; }
    public required IReadOnlyDictionary<string, CatalogTopic> Topics { get; init; }
    public required IReadOnlyDictionary<string, CatalogStopType> StopTypes { get; init; }
    public required int MinitestSize { get; init; }
    public required CatalogKpRules KpRules { get; init; }
    public required int StarDailyMax { get; init; }
    public required CatalogCup Cup { get; init; }
    public required IReadOnlyList<CatalogBook> Books { get; init; }
    public required IReadOnlyList<CatalogGame> Games { get; init; }
    public required CatalogAvatar Avatar { get; init; }
    public required IReadOnlyDictionary<string, CatalogSkill> AssessSkills { get; init; }
    public required IReadOnlyList<CatalogQuestion> AssessBank { get; init; }
}

/// <summary>Loaded once from the embedded <c>kampus-catalog.json</c>.</summary>
public sealed class KampusCatalog
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Skip
    };

    public KampusCatalog(KampusCatalogData data)
    {
        Data = data ?? throw new ArgumentNullException(nameof(data));
    }

    public KampusCatalogData Data { get; }

    public static KampusCatalog LoadEmbedded()
    {
        var assembly = typeof(KampusCatalog).Assembly;
        var name = assembly.GetManifestResourceNames().Single(n => n.EndsWith("kampus-catalog.json", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(name)!;
        var data = JsonSerializer.Deserialize<KampusCatalogData>(stream, Json)
                   ?? throw new InvalidOperationException("kampus-catalog.json is empty.");
        return new KampusCatalog(data);
    }

    public CatalogTopic? Topic(string? id) => id is not null && Data.Topics.TryGetValue(id, out var t) ? t : null;

    public CatalogBook? Book(string? id) => Data.Books.FirstOrDefault(b => b.Id == id);

    public CatalogGame? Game(string? id) => Data.Games.FirstOrDefault(g => g.Id == id);

    public CatalogAvatarItem? AvatarItem(string? id) => Data.Avatar.Items.FirstOrDefault(i => i.Id == id);

    public IReadOnlyList<string> CourseTopics(string courseId) =>
        Data.Courses.TryGetValue(courseId, out var c) ? c.Topics : [];

    /// <summary>The four satellites of a topic; a pilot meeting has none.</summary>
    public IReadOnlyList<string> TopicStops(string topicId) => Topic(topicId)?.Stops ?? [];

    public int StopKp(string stopId) => Data.StopTypes.TryGetValue(stopId, out var s) ? s.Kp : 0;

    public bool IsStop(string stopId) => Data.StopTypes.ContainsKey(stopId);
}

/// <summary>
/// Server-side answer checking, mirroring the frontend's <c>isRight</c>: <c>tf</c> compares the string
/// "true"/"false", <c>write</c> compares after removing whitespace and lower-casing (Turkish), <c>match</c>
/// expects every left item mapped to its own index, <c>choice</c> compares the option value.
/// </summary>
public static class KampusGrader
{
    public static bool IsRight(CatalogQuestion question, JsonElement? given)
    {
        ArgumentNullException.ThrowIfNull(question);
        if (given is not { } g || g.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return false;
        }

        switch (question.Type)
        {
            case "match":
                if (g.ValueKind != JsonValueKind.Object || question.Pairs is not { } pairs)
                {
                    return false;
                }

                for (var i = 0; i < pairs; i++)
                {
                    if (!g.TryGetProperty(i.ToString(System.Globalization.CultureInfo.InvariantCulture), out var v)
                        || !TryInt(v, out var mapped) || mapped != i)
                    {
                        return false;
                    }
                }

                return true;

            case "write":
                var text = Normalize(AsString(g));
                return (question.Answer ?? []).Any(a => Normalize(a) == text);

            case "tf":
                return question.Answer is { Count: > 0 } tfKeys && tfKeys[0] is { } tf
                       && string.Equals(AsString(g), tf, StringComparison.OrdinalIgnoreCase);

            default:
                return question.Answer is { Count: > 0 } keys && AsString(g) == keys[0];
        }
    }

    internal static string Normalize(string? value)
    {
        var s = new string((value ?? string.Empty).Where(c => !char.IsWhiteSpace(c)).ToArray())
            .Replace('＜', '<').Replace('‹', '<').Replace('＞', '>').Replace('›', '>');
        return s.ToLower(System.Globalization.CultureInfo.GetCultureInfo("tr-TR"));
    }

    private static string? AsString(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => e.GetString(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Number => e.GetRawText(),
        _ => null
    };

    private static bool TryInt(JsonElement e, out int value)
    {
        value = 0;
        return e.ValueKind switch
        {
            JsonValueKind.Number => e.TryGetInt32(out value),
            JsonValueKind.String => int.TryParse(e.GetString(), out value),
            _ => false
        };
    }
}
