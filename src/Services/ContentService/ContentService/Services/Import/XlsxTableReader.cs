using System.IO.Compression;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace ContentService.Services.Import;

/// <summary>
/// Reads the first worksheet of an .xlsx file as a table of strings. Deliberately minimal — curriculum
/// sheets are plain text cells — so the service needs no spreadsheet dependency. Guards against zip
/// bombs by refusing parts that expand beyond a fixed size.
/// </summary>
public static class XlsxTableReader
{
    private const long MaxPartBytes = 64L * 1024 * 1024;

    /// <summary>Curriculum sheets use six columns; a cell far to the right is not data, only memory.</summary>
    private const int MaxColumns = 64;

    private static readonly XNamespace Main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace Relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";

    public static List<List<string>> Read(Stream stream, int maxRows)
    {
        ArgumentNullException.ThrowIfNull(stream);

        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

        var sharedStrings = ReadSharedStrings(archive);
        var sheetPath = FirstSheetPath(archive);
        var sheet = Load(archive, sheetPath)
            ?? throw new InvalidDataException("The workbook has no worksheet.");

        var rows = new List<List<string>>();
        var sheetData = sheet.Root?.Element(Main + "sheetData");
        if (sheetData is null)
        {
            return rows;
        }

        var nextRowNumber = 1;
        foreach (var rowElement in sheetData.Elements(Main + "row"))
        {
            // Rows absent from the XML are empty; keep numbering aligned with what Excel shows.
            if (int.TryParse((string?)rowElement.Attribute("r"), out var rowNumber))
            {
                while (nextRowNumber < rowNumber)
                {
                    rows.Add([]);
                    nextRowNumber++;
                }
            }

            var cells = new List<string>();
            var nextColumn = 0;
            foreach (var cell in rowElement.Elements(Main + "c"))
            {
                var column = ColumnIndex((string?)cell.Attribute("r")) ?? nextColumn;
                if (column >= MaxColumns)
                {
                    continue;
                }

                while (cells.Count <= column)
                {
                    cells.Add(string.Empty);
                }

                // Assigned by reference rather than appended: the file, not document order, says where a cell is.
                cells[column] = CellText(cell, sharedStrings);
                nextColumn = column + 1;
            }

            rows.Add(cells);
            nextRowNumber++;
            if (rows.Count > maxRows)
            {
                throw new InvalidDataException($"The file has more than {maxRows} rows.");
            }
        }

        return rows;
    }

    internal static int? ColumnIndex(string? cellReference)
    {
        if (string.IsNullOrEmpty(cellReference))
        {
            return null;
        }

        var index = 0;
        var letters = 0;
        foreach (var c in cellReference)
        {
            if (c is >= 'A' and <= 'Z')
            {
                index = (index * 26) + (c - 'A' + 1);
                letters++;
            }
            else
            {
                break;
            }
        }

        return letters is 0 or > 3 ? null : index - 1;
    }

    private static string CellText(XElement cell, List<string> sharedStrings)
    {
        var type = (string?)cell.Attribute("t");

        if (type == "inlineStr")
        {
            return ConcatText(cell.Element(Main + "is"));
        }

        var value = (string?)cell.Element(Main + "v") ?? string.Empty;

        if (type == "s")
        {
            return int.TryParse(value, out var index) && index >= 0 && index < sharedStrings.Count
                ? sharedStrings[index]
                : string.Empty;
        }

        return value;
    }

    private static List<string> ReadSharedStrings(ZipArchive archive)
    {
        var document = Load(archive, "xl/sharedStrings.xml");
        if (document?.Root is null)
        {
            return [];
        }

        return document.Root.Elements(Main + "si").Select(ConcatText).ToList();
    }

    /// <summary>Rich text splits a string across runs; the visible value is all of their t elements.</summary>
    private static string ConcatText(XElement? element)
    {
        if (element is null)
        {
            return string.Empty;
        }

        var builder = new StringBuilder();
        foreach (var t in element.Descendants(Main + "t"))
        {
            // Phonetic hints (rPh) are not part of the displayed text.
            if (t.Parent?.Name == Main + "rPh")
            {
                continue;
            }

            builder.Append(t.Value);
        }

        return builder.ToString();
    }

    private static string FirstSheetPath(ZipArchive archive)
    {
        const string fallback = "xl/worksheets/sheet1.xml";

        var workbook = Load(archive, "xl/workbook.xml");
        var firstSheet = workbook?.Root?.Element(Main + "sheets")?.Elements(Main + "sheet").FirstOrDefault();
        var relationshipId = (string?)firstSheet?.Attribute(Relationships + "id");
        if (relationshipId is null)
        {
            return fallback;
        }

        var rels = Load(archive, "xl/_rels/workbook.xml.rels");
        var target = rels?.Root?
            .Elements(PackageRelationships + "Relationship")
            .FirstOrDefault(r => (string?)r.Attribute("Id") == relationshipId)?
            .Attribute("Target")?.Value;

        if (string.IsNullOrEmpty(target))
        {
            return fallback;
        }

        return target.StartsWith('/') ? target.TrimStart('/') : "xl/" + target;
    }

    private static XDocument? Load(ZipArchive archive, string path)
    {
        var entry = archive.GetEntry(path);
        if (entry is null)
        {
            return null;
        }

        if (entry.Length > MaxPartBytes)
        {
            throw new InvalidDataException("The workbook is too large to import.");
        }

        using var entryStream = entry.Open();
        using var xml = XmlReader.Create(entryStream, new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            MaxCharactersInDocument = MaxPartBytes,
        });
        return XDocument.Load(xml);
    }
}
