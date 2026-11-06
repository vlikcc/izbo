using Shared.DTOs;

namespace ContentService.Services.Import;

/// <summary>One curriculum line: where it sits in the hierarchy and, optionally, the outcome it adds.</summary>
public sealed record CurriculumImportRow(
    int RowNumber,
    string Level,
    string Subject,
    string Unit,
    string Topic,
    string? OutcomeCode,
    string? OutcomeDescription);

public sealed record CurriculumParseResult(List<CurriculumImportRow> Rows, List<CurriculumImportError> Errors);

/// <summary>
/// Maps a spreadsheet (header row + data rows) to curriculum rows. Headers are matched loosely, in Turkish
/// or English: Seviye/Sınıf/Level, Ders/Subject, Ünite/Unit, Konu/Topic, Kazanım Kodu/Code,
/// Açıklama/Kazanım/Description. Row numbers are 1-based as shown in Excel.
/// </summary>
public static class CurriculumImportParser
{
    public const int MaxRows = 20_000;

    private enum Column { Level, Subject, Unit, Topic, OutcomeCode, OutcomeDescription }

    private static readonly Dictionary<string, Column> HeaderAliases = new(StringComparer.Ordinal)
    {
        ["seviye"] = Column.Level,
        ["sinif"] = Column.Level,
        ["sinif-seviyesi"] = Column.Level,
        ["level"] = Column.Level,
        ["grade"] = Column.Level,
        ["ders"] = Column.Subject,
        ["ders-adi"] = Column.Subject,
        ["subject"] = Column.Subject,
        ["unite"] = Column.Unit,
        ["unite-adi"] = Column.Unit,
        ["unit"] = Column.Unit,
        ["konu"] = Column.Topic,
        ["konu-adi"] = Column.Topic,
        ["topic"] = Column.Topic,
        ["kazanim-kodu"] = Column.OutcomeCode,
        ["kod"] = Column.OutcomeCode,
        ["code"] = Column.OutcomeCode,
        ["outcome-code"] = Column.OutcomeCode,
        ["aciklama"] = Column.OutcomeDescription,
        ["kazanim"] = Column.OutcomeDescription,
        ["kazanim-aciklamasi"] = Column.OutcomeDescription,
        ["description"] = Column.OutcomeDescription,
        ["outcome"] = Column.OutcomeDescription,
    };

    public static CurriculumParseResult Parse(IReadOnlyList<IReadOnlyList<string>> table)
    {
        ArgumentNullException.ThrowIfNull(table);

        var rows = new List<CurriculumImportRow>();
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
            return new CurriculumParseResult(rows, errors);
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

        var missing = new[] { Column.Level, Column.Subject, Column.Unit, Column.Topic }
            .Where(c => !columns.ContainsKey(c))
            .ToList();
        if (missing.Count > 0)
        {
            errors.Add(new CurriculumImportError(
                headerIndex + 1,
                "Missing required column(s): " + string.Join(", ", missing.Select(HeaderLabel)) +
                ". Expected headers: Seviye, Ders, Ünite, Konu, Kazanım Kodu, Açıklama."));
            return new CurriculumParseResult(rows, errors);
        }

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

            var level = Cell(Column.Level);
            var subject = Cell(Column.Subject);
            var unit = Cell(Column.Unit);
            var topic = Cell(Column.Topic);
            var code = Cell(Column.OutcomeCode);
            var description = Cell(Column.OutcomeDescription);

            var rowErrors = new List<string>();
            Require(level, "Seviye", rowErrors);
            Require(subject, "Ders", rowErrors);
            Require(unit, "Ünite", rowErrors);
            Require(topic, "Konu", rowErrors);
            MaxLength(subject, 200, "Ders", rowErrors);
            MaxLength(unit, 200, "Ünite", rowErrors);
            MaxLength(topic, 200, "Konu", rowErrors);
            MaxLength(code, 64, "Kazanım Kodu", rowErrors);
            MaxLength(description, 2000, "Açıklama", rowErrors);

            if (code.Length > 0 && description.Length == 0)
            {
                rowErrors.Add("Kazanım Kodu is set but Açıklama is empty");
            }
            else if (code.Length == 0 && description.Length > 0)
            {
                rowErrors.Add("Açıklama is set but Kazanım Kodu is empty");
            }

            if (rowErrors.Count > 0)
            {
                errors.Add(new CurriculumImportError(rowNumber, string.Join("; ", rowErrors)));
                continue;
            }

            rows.Add(new CurriculumImportRow(
                rowNumber,
                level,
                subject,
                unit,
                topic,
                code.Length > 0 ? code : null,
                description.Length > 0 ? description : null));
        }

        return new CurriculumParseResult(rows, errors);
    }

    private static bool IsBlank(IReadOnlyList<string> cells) => cells.All(string.IsNullOrWhiteSpace);

    private static void Require(string value, string label, List<string> errors)
    {
        if (value.Length == 0)
        {
            errors.Add($"{label} is required");
        }
    }

    private static void MaxLength(string value, int max, string label, List<string> errors)
    {
        if (value.Length > max)
        {
            errors.Add($"{label} is longer than {max} characters");
        }
    }

    private static string HeaderLabel(Column column) => column switch
    {
        Column.Level => "Seviye",
        Column.Subject => "Ders",
        Column.Unit => "Ünite",
        Column.Topic => "Konu",
        Column.OutcomeCode => "Kazanım Kodu",
        _ => "Açıklama",
    };
}
