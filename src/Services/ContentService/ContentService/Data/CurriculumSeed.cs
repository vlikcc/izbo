using System.Security.Cryptography;
using System.Text;
using ContentService.Services;
using Shared.Models;

namespace ContentService.Data;

/// <summary>
/// Levels (1–12. sınıf, LGS, YKS TYT/AYT/YDT) and the MEB subject list of each. Units, topics and
/// outcomes are not seeded — administrators import them from a spreadsheet.
///
/// Ids are derived from the slugs so the seed is stable across migrations: regenerating a migration must
/// never re-key a row that content already points at.
/// </summary>
public static class CurriculumSeed
{
    private static readonly string[] PrimaryEarly = ["Türkçe", "Matematik", "Hayat Bilgisi"];

    private static readonly Dictionary<string, string> Colors = new(StringComparer.Ordinal)
    {
        ["Türkçe"] = "#dc2626",
        ["Türk Dili ve Edebiyatı"] = "#dc2626",
        ["Matematik"] = "#2563eb",
        ["Geometri"] = "#1d4ed8",
        ["Hayat Bilgisi"] = "#16a34a",
        ["Fen Bilimleri"] = "#16a34a",
        ["Fizik"] = "#7c3aed",
        ["Kimya"] = "#0891b2",
        ["Biyoloji"] = "#15803d",
        ["Sosyal Bilgiler"] = "#ea580c",
        ["T.C. İnkılap Tarihi ve Atatürkçülük"] = "#b91c1c",
        ["Tarih"] = "#b45309",
        ["Coğrafya"] = "#0d9488",
        ["Felsefe"] = "#6d28d9",
        ["Felsefe Grubu"] = "#6d28d9",
        ["İngilizce"] = "#db2777",
        ["Din Kültürü ve Ahlak Bilgisi"] = "#0f766e",
        ["İnsan Hakları, Yurttaşlık ve Demokrasi"] = "#4f46e5",
    };

    public static Guid IdFor(string key)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("eduplatform-content:" + key));
        return new Guid(hash.AsSpan(0, 16));
    }

    /// <summary>MEB subject names per level slug, in display order.</summary>
    public static IReadOnlyDictionary<string, string[]> SubjectNamesByLevel { get; } = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["1-sinif"] = PrimaryEarly,
        ["2-sinif"] = [.. PrimaryEarly, "İngilizce"],
        ["3-sinif"] = [.. PrimaryEarly, "Fen Bilimleri", "İngilizce"],
        ["4-sinif"] = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi", "İnsan Hakları, Yurttaşlık ve Demokrasi"],
        ["5-sinif"] = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["6-sinif"] = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["7-sinif"] = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["8-sinif"] = ["Türkçe", "Matematik", "Fen Bilimleri", "T.C. İnkılap Tarihi ve Atatürkçülük", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["9-sinif"] = ["Türk Dili ve Edebiyatı", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["10-sinif"] = ["Türk Dili ve Edebiyatı", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["11-sinif"] = ["Türk Dili ve Edebiyatı", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["12-sinif"] = ["Türk Dili ve Edebiyatı", "Matematik", "Fizik", "Kimya", "Biyoloji", "T.C. İnkılap Tarihi ve Atatürkçülük", "Coğrafya", "Felsefe", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
        ["lgs"] = ["Türkçe", "Matematik", "Fen Bilimleri", "T.C. İnkılap Tarihi ve Atatürkçülük", "Din Kültürü ve Ahlak Bilgisi", "İngilizce"],
        ["yks-tyt"] = ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
        ["yks-ayt"] = ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Türk Dili ve Edebiyatı", "Tarih", "Coğrafya", "Felsefe Grubu"],
        ["yks-ydt"] = ["İngilizce"],
    };

    // Declared after SubjectNamesByLevel on purpose: static initializers run in textual order.
    public static IReadOnlyList<Level> Levels { get; } = BuildLevels();

    public static IReadOnlyList<Subject> Subjects { get; } = BuildSubjects();

    private static List<Level> BuildLevels()
    {
        var levels = new List<Level>();

        for (var grade = 1; grade <= 12; grade++)
        {
            var slug = $"{grade}-sinif";
            levels.Add(new Level
            {
                Id = IdFor("level:" + slug),
                Slug = slug,
                Name = $"{grade}. Sınıf",
                Kind = LevelKind.Grade,
                GradeNumber = grade,
                Order = grade
            });
        }

        (string Slug, string Name)[] exams =
        [
            ("lgs", "LGS"),
            ("yks-tyt", "YKS - TYT"),
            ("yks-ayt", "YKS - AYT"),
            ("yks-ydt", "YKS - YDT"),
        ];

        for (var i = 0; i < exams.Length; i++)
        {
            levels.Add(new Level
            {
                Id = IdFor("level:" + exams[i].Slug),
                Slug = exams[i].Slug,
                Name = exams[i].Name,
                Kind = LevelKind.ExamPrep,
                GradeNumber = null,
                Order = 100 + i
            });
        }

        return levels;
    }

    private static List<Subject> BuildSubjects()
    {
        var subjects = new List<Subject>();

        foreach (var level in BuildLevels())
        {
            var names = SubjectNamesByLevel[level.Slug];
            for (var i = 0; i < names.Length; i++)
            {
                var slug = Slug.From(names[i]);
                subjects.Add(new Subject
                {
                    Id = IdFor($"subject:{level.Slug}:{slug}"),
                    LevelId = level.Id,
                    Slug = slug,
                    Name = names[i],
                    Color = Colors.GetValueOrDefault(names[i], "#2563eb"),
                    Order = i + 1
                });
            }
        }

        return subjects;
    }
}
