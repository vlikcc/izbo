namespace ContentService.Services.Import;

/// <summary>Reads an uploaded .xlsx or .csv into rows of cells, for the curriculum and question imports.</summary>
public static class SpreadsheetTable
{
    /// <summary>The table, or a message saying why the file could not be read.</summary>
    public static (List<List<string>>? Table, string? Error) Read(Stream file, string? fileName, int maxRows)
    {
        ArgumentNullException.ThrowIfNull(file);

        try
        {
            var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
            if (extension == ".xlsx")
            {
                return (XlsxTableReader.Read(file, maxRows), null);
            }

            if (extension is ".csv" or ".txt")
            {
                using var reader = new StreamReader(file, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
                return (CsvTableReader.Read(reader, maxRows), null);
            }

            return (null, "Upload an .xlsx or .csv file.");
        }
        catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException)
        {
            return (null, "The file could not be read: " + ex.Message);
        }
    }
}
