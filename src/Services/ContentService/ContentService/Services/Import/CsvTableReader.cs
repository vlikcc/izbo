using System.Text;

namespace ContentService.Services.Import;

/// <summary>
/// RFC 4180 CSV with the delimiter detected from the header line — Excel in a Turkish locale saves with
/// semicolons, everything else with commas.
/// </summary>
public static class CsvTableReader
{
    public static List<List<string>> Read(TextReader reader, int maxRows)
    {
        ArgumentNullException.ThrowIfNull(reader);

        var text = reader.ReadToEnd();
        var delimiter = DetectDelimiter(text);
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];

            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    field.Append(c);
                }

                continue;
            }

            if (c == '"' && field.Length == 0)
            {
                inQuotes = true;
            }
            else if (c == delimiter)
            {
                row.Add(field.ToString());
                field.Clear();
            }
            else if (c is '\r' or '\n')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                {
                    i++;
                }

                row.Add(field.ToString());
                field.Clear();
                rows.Add(row);
                row = [];
                if (rows.Count > maxRows)
                {
                    throw new InvalidDataException($"The file has more than {maxRows} rows.");
                }
            }
            else
            {
                field.Append(c);
            }
        }

        if (field.Length > 0 || row.Count > 0)
        {
            row.Add(field.ToString());
            rows.Add(row);
        }

        return rows;
    }

    private static char DetectDelimiter(string text)
    {
        var end = text.IndexOfAny(['\r', '\n']);
        var header = end < 0 ? text : text[..end];

        var semicolons = header.Count(c => c == ';');
        var commas = header.Count(c => c == ',');
        var tabs = header.Count(c => c == '\t');

        if (tabs > semicolons && tabs > commas)
        {
            return '\t';
        }

        return semicolons > commas ? ';' : ',';
    }
}
