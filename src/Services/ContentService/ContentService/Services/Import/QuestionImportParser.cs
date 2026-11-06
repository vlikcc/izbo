using ContentService.Services.Questions;
using Shared.DTOs;
using Shared.Models;

namespace ContentService.Services.Import;

/// <summary>One question line: where it sits in the curriculum and the checked question itself.</summary>
public sealed record QuestionImportRow(
    int RowNumber,
    string Level,
    string Subject,
    string Unit,
    string Topic,
    string? OutcomeCode,
    BankQuestionType Type,
    NormalizedQuestion Question,
    QuestionDifficulty Difficulty);

public sealed record QuestionParseResult(List<QuestionImportRow> Rows, List<CurriculumImportError> Errors);

/// <summary>
/// Maps a spreadsheet to bank questions. Headers are matched loosely, in Turkish or English:
/// Seviye, Ders, Ünite, Konu, Kazanım Kodu, Soru, A–E, Doğru (Cevap), Zorluk, Açıklama/Çözüm and an
/// optional Tip. Without a Tip column a row with no options and a Doğru/Yanlış answer is a true/false
/// question; everything else is multiple choice. Row numbers are 1-based as shown in Excel.
/// </summary>
public static class QuestionImportParser
{
    public const int MaxRows = 5_000;

    private enum Column { Level, Subject, Unit, Topic, OutcomeCode, Stem, A, B, C, D, E, Correct, Difficulty, Explanation, Type }

    private static readonly Column[] OptionColumns = [Column.A, Column.B, Column.C, Column.D, Column.E];

    private static readonly Dictionary<string, Column> HeaderAliases = new(StringComparer.Ordinal)
    {
        ["seviye"] = Column.Level,
        ["sinif"] = Column.Level,
        ["level"] = Column.Level,
        ["grade"] = Column.Level,
        ["ders"] = Column.Subject,
        ["subject"] = Column.Subject,
        ["unite"] = Column.Unit,
        ["unit"] = Column.Unit,
        ["konu"] = Column.Topic,
        ["topic"] = Column.Topic,
        ["kazanim-kodu"] = Column.OutcomeCode,
        ["kazanim"] = Column.OutcomeCode,
        ["kod"] = Column.OutcomeCode,
        ["outcome-code"] = Column.OutcomeCode,
        ["outcome"] = Column.OutcomeCode,
        ["soru"] = Column.Stem,
        ["soru-metni"] = Column.Stem,
        ["question"] = Column.Stem,
        ["stem"] = Column.Stem,
        ["a"] = Column.A,
        ["sik-a"] = Column.A,
        ["secenek-a"] = Column.A,
        ["option-a"] = Column.A,
        ["b"] = Column.B,
        ["sik-b"] = Column.B,
        ["secenek-b"] = Column.B,
        ["option-b"] = Column.B,
        ["c"] = Column.C,
        ["sik-c"] = Column.C,
        ["secenek-c"] = Column.C,
        ["option-c"] = Column.C,
        ["d"] = Column.D,
        ["sik-d"] = Column.D,
        ["secenek-d"] = Column.D,
        ["option-d"] = Column.D,
        ["e"] = Column.E,
        ["sik-e"] = Column.E,
        ["secenek-e"] = Column.E,
        ["option-e"] = Column.E,
        ["dogru"] = Column.Correct,
        ["dogru-cevap"] = Column.Correct,
        ["dogru-sik"] = Column.Correct,
        ["cevap"] = Column.Correct,
        ["answer"] = Column.Correct,
        ["correct"] = Column.Correct,
        ["zorluk"] = Column.Difficulty,
        ["difficulty"] = Column.Difficulty,
        ["aciklama"] = Column.Explanation,
        ["cozum"] = Column.Explanation,
        ["explanation"] = Column.Explanation,
        ["solution"] = Column.Explanation,
        ["tip"] = Column.Type,
        ["soru-tipi"] = Column.Type,
        ["type"] = Column.Type,
    };

    private static readonly Column[] Required = [Column.Level, Column.Subject, Column.Unit, Column.Topic, Column.Stem, Column.Correct];

    public static QuestionParseResult Parse(IReadOnlyList<IReadOnlyList<string>> table)
    {
        ArgumentNullException.ThrowIfNull(table);

        var rows = new List<QuestionImportRow>();
        var errors = new List<CurriculumImportError>();

        var headerIndex = -1;
        for (var i = 0; i < table.Count; i++)
        {
            if (!IsBlank(table[i]))
            {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex < 0)
        {
            errors.Add(new CurriculumImportError(1, "The file is empty."));
            return new QuestionParseResult(rows, errors);
        }

        var columns = new Dictionary<Column, int>();
        var header = table[headerIndex];
        for (var c = 0; c < header.Count; c++)
        {
            var key = Slug.From(header[c] ?? string.Empty);
            if (HeaderAliases.TryGetValue(key, out var column) && !columns.ContainsKey(column))
            {
                columns[column] = c;
            }
        }

        var missing = Required.Where(c => !columns.ContainsKey(c)).ToList();
        if (missing.Count > 0)
        {
            errors.Add(new CurriculumImportError(
                headerIndex + 1,
                "Missing required column(s): " + string.Join(", ", missing.Select(HeaderLabel)) +
                ". Expected headers: Seviye, Ders, Ünite, Konu, Kazanım Kodu, Soru, A, B, C, D, E, Doğru, Zorluk, Açıklama."));
            return new QuestionParseResult(rows, errors);
        }

        var seen = new Dictionary<string, int>(StringComparer.Ordinal);

        for (var i = headerIndex + 1; i < table.Count; i++)
        {
            var cells = table[i];
            if (IsBlank(cells))
            {
                continue;
            }

            var rowNumber = i + 1;
            string Cell(Column column) =>
                columns.TryGetValue(column, out var index) && index < cells.Count
                    ? (cells[index] ?? string.Empty).Trim()
                    : string.Empty;

            var rowErrors = new List<string>();
            var level = Cell(Column.Level);
            var subject = Cell(Column.Subject);
            var unit = Cell(Column.Unit);
            var topic = Cell(Column.Topic);
            var code = Cell(Column.OutcomeCode);
            Require(level, "Seviye", rowErrors);
            Require(subject, "Ders", rowErrors);
            Require(unit, "Ünite", rowErrors);
            Require(topic, "Konu", rowErrors);

            var optionTexts = OptionColumns.Select(Cell).ToList();
            var lastFilled = optionTexts.FindLastIndex(t => t.Length > 0);
            var options = optionTexts.Take(lastFilled + 1).ToList();
            if (options.Any(t => t.Length == 0))
            {
                rowErrors.Add("Options must be filled from A onwards without gaps");
            }

            var correct = Cell(Column.Correct);
            var type = ResolveType(Cell(Column.Type), options.Count, correct, rowErrors);
            var difficulty = ResolveDifficulty(Cell(Column.Difficulty), rowErrors);

            NormalizedQuestion? question = null;
            if (type is { } questionType && rowErrors.Count == 0)
            {
                var key = questionType == BankQuestionType.TrueFalse ? TrueFalseKey(correct) : correct;
                var (normalized, error) = BankQuestionRules.Normalize(
                    questionType,
                    Cell(Column.Stem),
                    hasStemImage: false,
                    options.Select(t => new QuestionOptionInput(t)).ToList(),
                    key,
                    Cell(Column.Explanation));
                if (error is not null)
                {
                    rowErrors.Add(error);
                }

                question = normalized;
            }

            if (question is not null)
            {
                var duplicateKey = $"{Slug.From(level)}|{Slug.From(subject)}|{Slug.From(unit)}|{Slug.From(topic)}|{BankQuestionRules.StemKey(question.Stem)}";
                if (seen.TryGetValue(duplicateKey, out var firstRow))
                {
                    rowErrors.Add($"Same question as row {firstRow}");
                }
                else
                {
                    seen[duplicateKey] = rowNumber;
                }
            }

            if (rowErrors.Count > 0 || question is null || type is null)
            {
                errors.Add(new CurriculumImportError(rowNumber, string.Join("; ", rowErrors.DefaultIfEmpty("Invalid row"))));
                continue;
            }

            rows.Add(new QuestionImportRow(
                rowNumber,
                level,
                subject,
                unit,
                topic,
                code.Length > 0 ? code : null,
                type.Value,
                question,
                difficulty));
        }

        return new QuestionParseResult(rows, errors);
    }

    private static BankQuestionType? ResolveType(string typeCell, int optionCount, string correct, List<string> errors)
    {
        if (typeCell.Length > 0)
        {
            switch (Slug.From(typeCell))
            {
                case "coktan-secmeli" or "cs" or "test" or "multiple-choice" or "mc":
                    return BankQuestionType.MultipleChoice;
                case "dogru-yanlis" or "dy" or "true-false" or "tf":
                    return BankQuestionType.TrueFalse;
                default:
                    errors.Add($"Unknown question type '{typeCell}' (use Çoktan seçmeli or Doğru-Yanlış)");
                    return null;
            }
        }

        if (correct.Length == 0)
        {
            errors.Add("Doğru is required");
            return null;
        }

        return optionCount == 0 && TrueFalseKey(correct) is not null
            ? BankQuestionType.TrueFalse
            : BankQuestionType.MultipleChoice;
    }

    private static string? TrueFalseKey(string correct) => Slug.From(correct) switch
    {
        "dogru" or "d" or "true" or "t" or "a" => BankQuestionRules.TrueKey,
        "yanlis" or "y" or "false" or "f" or "b" => BankQuestionRules.FalseKey,
        _ => null
    };

    private static QuestionDifficulty ResolveDifficulty(string value, List<string> errors)
    {
        if (value.Length == 0)
        {
            return QuestionDifficulty.Medium;
        }

        switch (Slug.From(value))
        {
            case "kolay" or "easy" or "1":
                return QuestionDifficulty.Easy;
            case "orta" or "medium" or "2":
                return QuestionDifficulty.Medium;
            case "zor" or "hard" or "3":
                return QuestionDifficulty.Hard;
            default:
                errors.Add($"Unknown difficulty '{value}' (use Kolay, Orta or Zor)");
                return QuestionDifficulty.Medium;
        }
    }

    private static bool IsBlank(IReadOnlyList<string> cells) => cells.All(string.IsNullOrWhiteSpace);

    private static void Require(string value, string label, List<string> errors)
    {
        if (value.Length == 0)
        {
            errors.Add($"{label} is required");
        }
    }

    private static string HeaderLabel(Column column) => column switch
    {
        Column.Level => "Seviye",
        Column.Subject => "Ders",
        Column.Unit => "Ünite",
        Column.Topic => "Konu",
        Column.Stem => "Soru",
        Column.Correct => "Doğru",
        _ => column.ToString(),
    };
}
