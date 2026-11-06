using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Questions;

/// <summary>The checked, normalised content of a question: options keyed A, B, C… and an upper-case key.</summary>
public sealed record NormalizedQuestion(
    string Stem,
    List<BankQuestionOption> Options,
    string CorrectKey,
    string Explanation);

/// <summary>Shape rules for bank questions, shared by the editor endpoints and the spreadsheet import.</summary>
public static class BankQuestionRules
{
    public const int MinChoiceOptions = 2;
    public const int MaxChoiceOptions = 5;
    public const int MaxStemLength = 8000;
    public const int MaxOptionLength = 1000;
    public const int MaxExplanationLength = 8000;

    public const string TrueKey = "A";
    public const string FalseKey = "B";

    private static readonly string[] Keys = ["A", "B", "C", "D", "E"];

    public static IReadOnlyList<BankQuestionOption> TrueFalseOptions { get; } =
    [
        new(TrueKey, "Doğru"),
        new(FalseKey, "Yanlış"),
    ];

    /// <summary>The checked question, or the reason it was refused.</summary>
    public static (NormalizedQuestion? Question, string? Error) Normalize(
        BankQuestionType type,
        string? stem,
        bool hasStemImage,
        IReadOnlyList<QuestionOptionInput>? options,
        string? correctKey,
        string? explanation)
    {
        var cleanStem = (stem ?? string.Empty).Trim();
        if (cleanStem.Length == 0 && !hasStemImage)
        {
            return Fail("The question needs text or an image");
        }

        if (cleanStem.Length > MaxStemLength)
        {
            return Fail($"The question text is longer than {MaxStemLength} characters");
        }

        var cleanExplanation = (explanation ?? string.Empty).Trim();
        if (cleanExplanation.Length > MaxExplanationLength)
        {
            return Fail($"The explanation is longer than {MaxExplanationLength} characters");
        }

        var key = (correctKey ?? string.Empty).Trim().ToUpperInvariant();

        if (type == BankQuestionType.TrueFalse)
        {
            return key is TrueKey or FalseKey
                ? (new NormalizedQuestion(cleanStem, TrueFalseOptions.ToList(), key, cleanExplanation), null)
                : Fail("A true/false answer must be A (Doğru) or B (Yanlış)");
        }

        if (type != BankQuestionType.MultipleChoice)
        {
            return Fail("Unknown question type");
        }

        var inputs = options ?? [];
        if (inputs.Count is < MinChoiceOptions or > MaxChoiceOptions)
        {
            return Fail($"A multiple-choice question needs {MinChoiceOptions} to {MaxChoiceOptions} options");
        }

        var normalized = new List<BankQuestionOption>(inputs.Count);
        for (var i = 0; i < inputs.Count; i++)
        {
            var text = (inputs[i]?.Text ?? string.Empty).Trim();
            if (text.Length == 0 && inputs[i]?.AssetId is null)
            {
                return Fail($"Option {Keys[i]} needs text or an image");
            }

            if (text.Length > MaxOptionLength)
            {
                return Fail($"Option {Keys[i]} is longer than {MaxOptionLength} characters");
            }

            normalized.Add(new BankQuestionOption(Keys[i], text, inputs[i]?.AssetId));
        }

        if (!normalized.Any(o => o.Key == key))
        {
            return Fail($"The correct answer must be one of {string.Join(", ", normalized.Select(o => o.Key))}");
        }

        return (new NormalizedQuestion(cleanStem, normalized, key, cleanExplanation), null);
    }

    /// <summary>Every image a question references, for the existence check.</summary>
    public static IEnumerable<Guid> AssetIds(Guid? stemAssetId, IEnumerable<BankQuestionOption> options)
    {
        if (stemAssetId is { } stem)
        {
            yield return stem;
        }

        foreach (var option in options)
        {
            if (option.AssetId is { } id)
            {
                yield return id;
            }
        }
    }

    /// <summary>Whitespace-insensitive form of a stem, used to recognise the same question on re-import.</summary>
    public static string StemKey(string stem) =>
        string.Join(' ', stem.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static (NormalizedQuestion?, string?) Fail(string error) => (null, error);
}

/// <summary>Images accepted for questions. The first bytes must agree with the extension.</summary>
public static class QuestionImageRules
{
    public const long MaxBytes = 2 * 1024 * 1024;
    public const int SniffLength = 12;

    public static (bool IsValid, string? Error, string Extension, string ContentType) Check(string? fileName, ReadOnlySpan<byte> head)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        switch (extension)
        {
            case ".png" when head.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }):
                return (true, null, ".png", "image/png");
            case ".jpg" or ".jpeg" when head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF:
                return (true, null, ".jpg", "image/jpeg");
            case ".webp" when head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head.Slice(8, 4).SequenceEqual("WEBP"u8):
                return (true, null, ".webp", "image/webp");
            case ".png" or ".jpg" or ".jpeg" or ".webp":
                return (false, "The file's contents do not match its extension", string.Empty, string.Empty);
            default:
                return (false, "Images must be PNG, JPEG or WebP files", string.Empty, string.Empty);
        }
    }
}
