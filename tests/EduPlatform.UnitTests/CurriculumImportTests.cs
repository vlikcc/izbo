using System.IO.Compression;
using System.Text;
using ContentService.Data;
using ContentService.Services;
using ContentService.Services.Import;
using Shouldly;

namespace EduPlatform.UnitTests;

public class CurriculumImportParserTests
{
    private static string[][] Table(params string[][] rows) => rows;

    [Fact]
    public void Maps_turkish_headers_and_reads_rows()
    {
        var result = CurriculumImportParser.Parse(Table(
            ["Seviye", "Ders", "Ünite", "Konu", "Kazanım Kodu", "Açıklama"],
            ["5. Sınıf", "Matematik", "Doğal Sayılar", "Üslü İfadeler", "M.5.1.1.1", "Üslü ifadeleri tanır."],
            ["5. Sınıf", "Matematik", "Doğal Sayılar", "Bölme", "", ""]));

        result.Errors.ShouldBeEmpty();
        result.Rows.Count.ShouldBe(2);
        result.Rows[0].ShouldBe(new CurriculumImportRow(2, "5. Sınıf", "Matematik", "Doğal Sayılar", "Üslü İfadeler", "M.5.1.1.1", "Üslü ifadeleri tanır."));
        result.Rows[1].OutcomeCode.ShouldBeNull();
        result.Rows[1].RowNumber.ShouldBe(3);
    }

    [Fact]
    public void Accepts_english_headers_in_any_order()
    {
        var result = CurriculumImportParser.Parse(Table(
            ["Topic", "Unit", "Code", "Subject", "Description", "Level"],
            ["Fractions", "Numbers", "M.6.1", "Matematik", "Compares fractions", "6"]));

        result.Errors.ShouldBeEmpty();
        var row = result.Rows.ShouldHaveSingleItem();
        row.Level.ShouldBe("6");
        row.Topic.ShouldBe("Fractions");
        row.OutcomeCode.ShouldBe("M.6.1");
    }

    [Fact]
    public void Skips_blank_lines_and_trims_cells()
    {
        var result = CurriculumImportParser.Parse(Table(
            [],
            ["seviye", "ders", "unite", "konu"],
            ["", "", "", ""],
            ["  lgs ", " Türkçe ", " Sözcükte Anlam ", " Gerçek Anlam "]));

        result.Errors.ShouldBeEmpty();
        var row = result.Rows.ShouldHaveSingleItem();
        row.RowNumber.ShouldBe(4);
        row.Level.ShouldBe("lgs");
        row.Subject.ShouldBe("Türkçe");
    }

    [Fact]
    public void Reports_missing_required_columns()
    {
        var result = CurriculumImportParser.Parse(Table(["Seviye", "Ders", "Konu"], ["5", "Matematik", "Bölme"]));

        result.Rows.ShouldBeEmpty();
        result.Errors.ShouldHaveSingleItem().Message.ShouldContain("Ünite");
    }

    [Fact]
    public void Reports_incomplete_rows_with_their_spreadsheet_row_number()
    {
        var result = CurriculumImportParser.Parse(Table(
            ["Seviye", "Ders", "Ünite", "Konu", "Kazanım Kodu", "Açıklama"],
            ["5", "Matematik", "", "Bölme", "", ""],
            ["5", "Matematik", "Sayılar", "Bölme", "M.5.1", ""]));

        result.Rows.ShouldBeEmpty();
        result.Errors.Select(e => e.Row).ShouldBe([2, 3]);
        result.Errors[0].Message.ShouldContain("Ünite is required");
        result.Errors[1].Message.ShouldContain("Açıklama is empty");
    }

    [Fact]
    public void Empty_file_is_an_error()
    {
        CurriculumImportParser.Parse(Table()).Errors.ShouldHaveSingleItem();
    }
}

public class CurriculumTableReaderTests
{
    [Fact]
    public void Csv_detects_semicolons_and_honours_quotes()
    {
        const string csv = "Seviye;Ders;Ünite;Konu;Kazanım Kodu;Açıklama\r\n" +
                           "5;Matematik;\"Sayılar; Kesirler\";Bölme;M.5.1;\"Tırnaklı \"\"metin\"\"\nikinci satır\"\r\n";

        var rows = CsvTableReader.Read(new StringReader(csv), 100);

        rows.Count.ShouldBe(2);
        rows[1][2].ShouldBe("Sayılar; Kesirler");
        rows[1][5].ShouldBe("Tırnaklı \"metin\"\nikinci satır");
    }

    [Fact]
    public void Csv_with_commas_parses()
    {
        var rows = CsvTableReader.Read(new StringReader("a,b,c\n1,2,3"), 100);
        rows.Count.ShouldBe(2);
        rows[1].ShouldBe(["1", "2", "3"]);
    }

    [Fact]
    public void Csv_refuses_too_many_rows()
    {
        var csv = string.Concat(Enumerable.Repeat("a,b\n", 20));
        Should.Throw<InvalidDataException>(() => CsvTableReader.Read(new StringReader(csv), 5));
    }

    [Fact]
    public void Xlsx_reads_shared_inline_and_numeric_cells_by_column()
    {
        using var xlsx = BuildWorkbook(
            sharedStrings: ["Seviye", "Ders", "Ünite", "Konu", "Matematik", "Sayılar"],
            sheetRows:
            """
            <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
            <row r="3"><c r="A3"><v>5</v></c><c r="B3" t="s"><v>4</v></c><c r="D3" t="inlineStr"><is><t>Bölme</t></is></c><c r="C3" t="s"><v>5</v></c></row>
            """);

        var rows = XlsxTableReader.Read(xlsx, 100);

        rows.Count.ShouldBe(3);
        rows[1].ShouldBeEmpty();
        rows[2][0].ShouldBe("5");
        rows[2][1].ShouldBe("Matematik");
        rows[2][3].ShouldBe("Bölme");

        var parsed = CurriculumImportParser.Parse(rows);
        parsed.Errors.ShouldBeEmpty();
        parsed.Rows.ShouldHaveSingleItem().RowNumber.ShouldBe(3);
    }

    [Theory]
    [InlineData("A1", 0)]
    [InlineData("Z9", 25)]
    [InlineData("AA10", 26)]
    [InlineData("1A", null)]
    public void Xlsx_column_references(string reference, int? expected)
    {
        XlsxTableReader.ColumnIndex(reference).ShouldBe(expected);
    }

    private static MemoryStream BuildWorkbook(string[] sharedStrings, string sheetRows)
    {
        const string ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(zip, "xl/workbook.xml",
                $"""<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Müfredat" sheetId="1" r:id="rId1"/></sheets></workbook>""");
            Write(zip, "xl/_rels/workbook.xml.rels",
                """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/data.xml"/></Relationships>""");
            Write(zip, "xl/sharedStrings.xml",
                $"""<sst xmlns="{ns}">{string.Concat(sharedStrings.Select(s => $"<si><t>{s}</t></si>"))}</sst>""");
            Write(zip, "xl/worksheets/data.xml", $"""<worksheet xmlns="{ns}"><sheetData>{sheetRows}</sheetData></worksheet>""");
        }

        stream.Position = 0;
        return stream;
    }

    private static void Write(ZipArchive zip, string path, string content)
    {
        using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }
}

public class CurriculumNamingTests
{
    [Theory]
    [InlineData("Fen Bilimleri", "fen-bilimleri")]
    [InlineData("Üslü İfadeler ve Işık", "uslu-ifadeler-ve-isik")]
    [InlineData("T.C. İnkılap Tarihi ve Atatürkçülük", "t-c-inkilap-tarihi-ve-ataturkculuk")]
    [InlineData("  ÇĞÖŞÜ  ", "cgosu")]
    [InlineData("!!!", "x")]
    public void Slugs_are_ascii_and_culture_free(string name, string expected)
    {
        Slug.From(name).ShouldBe(expected);
    }

    [Theory]
    [InlineData("5-sinif", "5-sinif")]
    [InlineData("5. Sınıf", "5-sinif")]
    [InlineData("12", "12-sinif")]
    [InlineData("LGS", "lgs")]
    [InlineData("YKS - TYT", "yks-tyt")]
    [InlineData("AYT", "yks-ayt")]
    public void Levels_resolve_from_slugs_names_and_short_forms(string value, string expectedSlug)
    {
        CurriculumService.ResolveLevel(value, CurriculumSeed.Levels)!.Slug.ShouldBe(expectedSlug);
    }

    [Fact]
    public void Unknown_levels_do_not_resolve()
    {
        CurriculumService.ResolveLevel("13. Sınıf", CurriculumSeed.Levels).ShouldBeNull();
    }

    [Fact]
    public void Seed_covers_every_level_with_stable_unique_ids()
    {
        CurriculumSeed.Levels.Count.ShouldBe(16);
        CurriculumSeed.Levels.Select(l => l.Id).Distinct().Count().ShouldBe(16);
        CurriculumSeed.Subjects.Select(s => s.Id).Distinct().Count().ShouldBe(CurriculumSeed.Subjects.Count);
        CurriculumSeed.Subjects.GroupBy(s => (s.LevelId, s.Slug)).ShouldAllBe(g => g.Count() == 1);
        CurriculumSeed.IdFor("level:5-sinif").ShouldBe(CurriculumSeed.Levels.Single(l => l.Slug == "5-sinif").Id);
    }
}
