using System.Globalization;
using System.Text.Json;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace ContentService.Kampus.Services;

/// <summary>Queries over teacher assignments shared by the learner and teaching services.</summary>
public static class KampusAssignments
{
    /// <summary>Assignments of the student's classrooms that no topic record after the assignment answers yet.</summary>
    public static async Task<List<KampusAssignment>> PendingAsync(
        KampusDbContext db, Guid studentId, IReadOnlyCollection<Guid> classrooms, CancellationToken cancellationToken)
    {
        if (classrooms.Count == 0)
        {
            return [];
        }

        var ids = classrooms.ToList();
        return await db.Assignments.AsNoTracking()
            .Where(a => ids.Contains(a.ClassroomId))
            .Where(a => !db.TopicAttempts.Any(t => t.StudentId == studentId && t.TopicId == a.TopicId && t.CompletedAt >= a.CreatedAt))
            .OrderBy(a => a.Due).ThenBy(a => a.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public static async Task<List<KampusAssignment>> DoneAsync(
        KampusDbContext db, Guid studentId, IReadOnlyCollection<Guid> classrooms, CancellationToken cancellationToken)
    {
        if (classrooms.Count == 0)
        {
            return [];
        }

        var ids = classrooms.ToList();
        return await db.Assignments.AsNoTracking()
            .Where(a => ids.Contains(a.ClassroomId))
            .Where(a => db.TopicAttempts.Any(t => t.StudentId == studentId && t.TopicId == a.TopicId && t.CompletedAt >= a.CreatedAt))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public static AssignmentDto ToDto(KampusAssignment a) => new(a.Id, a.TeacherId, a.ClassroomId, a.TopicId, a.Title, a.Due, a.CreatedAt);
}

/// <summary>
/// The adult side of YZ Kampüs: teachers assign topics and mixed skill checks to their own classrooms and
/// read results; administrators publish theme exams; parents read a linked child's summary. Students sit the
/// exams here, graded on the server, and never receive answer keys before finishing.
/// </summary>
public sealed class KampusTeachingService
{
    private const double MasteryThreshold = 0.75;
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    private readonly KampusDbContext _db;
    private readonly KampusCatalog _catalog;
    private readonly KampusClock _clock;
    private readonly IKampusDirectory _directory;

    public KampusTeachingService(KampusDbContext db, KampusCatalog catalog, KampusClock clock, IKampusDirectory directory)
    {
        _db = db;
        _catalog = catalog;
        _clock = clock;
        _directory = directory;
    }

    // ---- Ödevler ----

    public async Task<ContentResult<AssignmentDto>> CreateAssignmentAsync(Caller caller, CreateAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!caller.CanManageContent)
        {
            return ContentResult.Forbidden<AssignmentDto>("Bu işlem için öğretmen girişi gerekir.");
        }

        if (!await _directory.CanManageClassroomAsync(request.ClassroomId, caller, cancellationToken))
        {
            return ContentResult.Forbidden<AssignmentDto>("Bu sınıfa ödev veremezsiniz.");
        }

        if (_catalog.Topic(request.TopicId) is null)
        {
            return ContentResult.NotFound<AssignmentDto>("Konu bulunamadı.");
        }

        if (request.Title is { Length: > 200 })
        {
            return ContentResult.Invalid<AssignmentDto>("Başlık en fazla 200 karakter olabilir.");
        }

        var assignment = new KampusAssignment
        {
            Id = Guid.NewGuid(),
            TeacherId = caller.UserId,
            ClassroomId = request.ClassroomId,
            TopicId = request.TopicId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
            Due = request.Due,
            CreatedAt = _clock.UtcNow
        };
        _db.Assignments.Add(assignment);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(KampusAssignments.ToDto(assignment));
    }

    public async Task<IReadOnlyList<AssignmentDto>> TeacherAssignmentsAsync(Caller caller, CancellationToken cancellationToken = default) =>
        (await _db.Assignments.AsNoTracking().Where(a => a.TeacherId == caller.UserId).OrderByDescending(a => a.CreatedAt).ToListAsync(cancellationToken))
        .Select(KampusAssignments.ToDto).ToList();

    public async Task<ContentResult<AssignmentResultsDto>> AssignmentResultsAsync(Caller caller, Guid assignmentId, CancellationToken cancellationToken = default)
    {
        var a = await _db.Assignments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == assignmentId, cancellationToken);
        if (a is null)
        {
            return ContentResult.NotFound<AssignmentResultsDto>("Ödev bulunamadı.");
        }

        var roster = await _directory.GetRosterAsync(a.ClassroomId, caller, cancellationToken);
        if (roster is null)
        {
            return ContentResult.NotFound<AssignmentResultsDto>("Ödev bulunamadı.");
        }

        var ids = roster.Select(s => s.StudentId).ToList();
        var attempts = await _db.TopicAttempts.AsNoTracking()
            .Where(t => ids.Contains(t.StudentId) && t.TopicId == a.TopicId && t.CompletedAt >= a.CreatedAt)
            .OrderBy(t => t.CompletedAt)
            .ToListAsync(cancellationToken);
        var latest = attempts.GroupBy(t => t.StudentId).ToDictionary(g => g.Key, g => g.Last());

        var rows = roster.Select(s =>
        {
            if (!latest.TryGetValue(s.StudentId, out var t))
            {
                return new AssignmentStudentRowDto(s.StudentId, s.Name, false, null, null, null);
            }

            var values = t.Answers.Values.ToList();
            return new AssignmentStudentRowDto(s.StudentId, s.Name, true, t.CompletedAt,
                values.Count(v => Int(v, "wrong") > 0), values.Sum(v => Int(v, "hints")));
        }).ToList();

        var topic = _catalog.Topic(a.TopicId)!;
        var done = latest.Values.ToList();
        var questions = topic.Practice.Concat(topic.Check).Select(q =>
        {
            var picks = new Dictionary<string, int>();
            var struggled = 0;
            foreach (var t in done)
            {
                if (!t.Answers.TryGetValue(q.Id, out var v))
                {
                    continue;
                }

                if (Int(v, "wrong") > 0)
                {
                    struggled++;
                }

                if (v.TryGetProperty("picks", out var p) && p.ValueKind == JsonValueKind.Array)
                {
                    foreach (var pick in p.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!))
                    {
                        picks[pick] = picks.GetValueOrDefault(pick) + 1;
                    }
                }
            }

            var top = picks.OrderByDescending(kv => kv.Value).Select(kv => kv.Key).FirstOrDefault();
            var label = top is null ? null : q.Options?.FirstOrDefault(o => o.V == top)?.Label;
            return new AssignmentQuestionDto(q.Id, struggled, done.Count, label);
        }).OrderByDescending(x => x.Struggled).ToList();

        return ContentResult.Ok(new AssignmentResultsDto(KampusAssignments.ToDto(a), rows, questions, done.Count, roster.Count));
    }

    public async Task<ContentResult<IReadOnlyList<AssignmentDto>>> StudentAssignmentsAsync(
        Caller caller, Guid studentId, bool done, CancellationToken cancellationToken = default)
    {
        if (!await _directory.CanViewStudentAsync(studentId, caller, cancellationToken))
        {
            return ContentResult.NotFound<IReadOnlyList<AssignmentDto>>("Öğrenci bulunamadı.");
        }

        var classrooms = await _directory.GetStudentClassroomIdsAsync(studentId, caller, cancellationToken);
        var list = done
            ? await KampusAssignments.DoneAsync(_db, studentId, classrooms, cancellationToken)
            : await KampusAssignments.PendingAsync(_db, studentId, classrooms, cancellationToken);
        return ContentResult.Ok<IReadOnlyList<AssignmentDto>>(list.Select(KampusAssignments.ToDto).ToList());
    }

    // ---- Değerlendirmeler ----

    public async Task<IReadOnlyList<ExamListItemDto>> StudentExamsAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        var exams = await VisibleExamsAsync(caller, cancellationToken);
        var ids = exams.Select(e => e.Id).ToList();
        var results = await _db.ExamResults.AsNoTracking().Where(r => r.StudentId == caller.UserId && ids.Contains(r.ExamId)).ToListAsync(cancellationToken);
        return exams
            .Select(e => new ExamListItemDto(ToDto(e), Status(e, results.FirstOrDefault(r => r.ExamId == e.Id))))
            .OrderBy(x => x.Exam.OpensAt)
            .ToList();
    }

    public async Task<ContentResult<ExamPlayDto>> ExamForStudentAsync(Caller caller, Guid examId, CancellationToken cancellationToken = default)
    {
        var exam = (await VisibleExamsAsync(caller, cancellationToken)).FirstOrDefault(e => e.Id == examId);
        if (exam is null)
        {
            return ContentResult.NotFound<ExamPlayDto>("Değerlendirme bulunamadı.");
        }

        var result = await _db.ExamResults.AsNoTracking().FirstOrDefaultAsync(r => r.StudentId == caller.UserId && r.ExamId == examId, cancellationToken);
        var status = Status(exam, result);
        var questions = status == "yakinda"
            ? []
            : exam.Questions.Select(q => new ExamQuestionDto(q.Id, q.Skill, q.Type, q.Prompt, q.Input, q.Options, q.Pairs)).ToList();
        return ContentResult.Ok(new ExamPlayDto(ToDto(exam), questions, result is null ? null : ToDto(result), status));
    }

    /// <summary>
    /// Records one answer, graded here. No per-question feedback is given before the end, and an answered
    /// question cannot be changed.
    /// </summary>
    public async Task<ContentResult<ExamAnswerResultDto>> AnswerExamAsync(
        Caller caller, Guid examId, string questionId, JsonElement? given, CancellationToken cancellationToken = default)
    {
        if (!caller.IsStudent)
        {
            return ContentResult.Forbidden<ExamAnswerResultDto>("Yalnızca öğrenciler.");
        }

        var exam = (await VisibleExamsAsync(caller, cancellationToken)).FirstOrDefault(e => e.Id == examId);
        if (exam is null)
        {
            return ContentResult.NotFound<ExamAnswerResultDto>("Değerlendirme bulunamadı.");
        }

        var result = await _db.ExamResults.FirstOrDefaultAsync(r => r.StudentId == caller.UserId && r.ExamId == examId, cancellationToken);
        var status = Status(exam, result);
        if (status is "yakinda" or "sonuc")
        {
            return ContentResult.Invalid<ExamAnswerResultDto>(status == "sonuc" ? "Bu değerlendirmeyi bitirdin." : "Bu değerlendirme henüz açılmadı.");
        }

        var question = exam.Questions.FirstOrDefault(q => q.Id == questionId);
        if (question is null)
        {
            return ContentResult.Invalid<ExamAnswerResultDto>("Soru bu değerlendirmede yok.");
        }

        if (result is null)
        {
            result = new KampusExamResult { StudentId = caller.UserId, ExamId = examId };
            _db.ExamResults.Add(result);
        }

        if (!result.Answers.TryGetValue(questionId, out var existing))
        {
            var ok = KampusGrader.IsRight(new CatalogQuestion(question.Id, question.Type, question.Answer, question.Pairs, question.Skill, question.Options), given);
            existing = new ExamAnswer(given, ok);
            result.Answers = new Dictionary<string, ExamAnswer>(result.Answers) { [questionId] = existing };
            result.Idx = result.Answers.Count;
            result.UpdatedAt = _clock.UtcNow;
            if (exam.Questions.All(q => result.Answers.ContainsKey(q.Id)))
            {
                result.Done = true;
                result.SubmittedAt = _clock.UtcNow;
            }

            await _db.SaveChangesAsync(cancellationToken);
        }

        return ContentResult.Ok(new ExamAnswerResultDto(existing.Ok, ToDto(result)));
    }

    public async Task<ContentResult<ExamReportDto>> ExamReportAsync(Caller caller, Guid studentId, Guid examId, CancellationToken cancellationToken = default)
    {
        if (!await _directory.CanViewStudentAsync(studentId, caller, cancellationToken))
        {
            return ContentResult.NotFound<ExamReportDto>("Sonuç bulunamadı.");
        }

        var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(e => e.Id == examId, cancellationToken);
        var result = await _db.ExamResults.AsNoTracking().FirstOrDefaultAsync(r => r.StudentId == studentId && r.ExamId == examId, cancellationToken);
        if (exam is null || result is null || !result.Done)
        {
            return ContentResult.NotFound<ExamReportDto>("Sonuç bulunamadı.");
        }

        return ContentResult.Ok(Report(exam, result));
    }

    public async Task<ContentResult<ExamDto>> CreateProcessCheckAsync(
        Caller caller, CreateProcessCheckRequest request, string? teacherName, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!caller.CanManageContent)
        {
            return ContentResult.Forbidden<ExamDto>("Bu işlem için öğretmen girişi gerekir.");
        }

        if (!await _directory.CanManageClassroomAsync(request.ClassroomId, caller, cancellationToken))
        {
            return ContentResult.Forbidden<ExamDto>("Bu sınıfa değerlendirme atayamazsınız.");
        }

        var skills = (request.Skills ?? []).Distinct().ToList();
        if (skills.Count == 0)
        {
            return ContentResult.Invalid<ExamDto>("En az bir beceri seçin.");
        }

        if (skills.Any(s => !_catalog.Data.AssessSkills.ContainsKey(s)))
        {
            return ContentResult.Invalid<ExamDto>("Bilinmeyen beceri.");
        }

        if (request.PerSkill is < 1 or > 4)
        {
            return ContentResult.Invalid<ExamDto>("Her beceriden 1–4 soru seçilebilir.");
        }

        if (request.ClosesAt < request.OpensAt)
        {
            return ContentResult.Invalid<ExamDto>("Son gün, açılış gününden önce olamaz.");
        }

        var questions = skills
            .SelectMany(sk => Shuffle(_catalog.Data.AssessBank.Where(q => q.Grade == request.Grade && q.Skill == sk)).Take(request.PerSkill))
            .ToList();
        if (questions.Count == 0)
        {
            return ContentResult.Invalid<ExamDto>("Seçilen beceriler için soru bulunamadı.");
        }

        var exam = new KampusExam
        {
            Id = Guid.NewGuid(),
            Kind = "surec",
            Subject = "karma",
            Title = string.IsNullOrWhiteSpace(request.Title) ? "Karma kontrol" : request.Title.Trim(),
            Grade = request.Grade,
            ClassroomIds = [request.ClassroomId],
            TeacherId = caller.UserId,
            AssignedBy = string.IsNullOrWhiteSpace(teacherName) ? null : teacherName.Trim(),
            OpensAt = request.OpensAt,
            ClosesAt = request.ClosesAt,
            Skills = skills,
            // Everyone in the class gets the same questions, in a mixed order, so results compare.
            Questions = Shuffle(questions).Select(q => new ExamQuestion(q.Id, q.Skill!, q.Type, q.Prompt, q.Input, q.Options, q.Answer, q.Pairs)).ToList(),
            CreatedAt = _clock.UtcNow
        };
        if (exam.Title.Length > 200)
        {
            return ContentResult.Invalid<ExamDto>("Başlık en fazla 200 karakter olabilir.");
        }

        _db.Exams.Add(exam);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(exam));
    }

    public async Task<ContentResult<ExamDto>> CreateThemeExamAsync(Caller caller, CreateThemeExamRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!caller.IsPlatformAdmin)
        {
            return ContentResult.Forbidden<ExamDto>("Tema değerlendirmelerini yöneticiler yayımlar.");
        }

        if (request.Grade is < 1 or > 12 || string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 || request.ClosesAt < request.OpensAt)
        {
            return ContentResult.Invalid<ExamDto>("Sınıf, başlık ve tarihler geçerli olmalı.");
        }

        var questions = request.Questions ?? [];
        if (questions.Select(q => q.Id).Distinct().Count() != questions.Count
            || questions.Any(q => string.IsNullOrWhiteSpace(q.Id) || (q.Type == "match" ? q.Pairs is not > 0 : q.Answer is not { Count: > 0 })))
        {
            return ContentResult.Invalid<ExamDto>("Her sorunun benzersiz bir kimliği ve cevap anahtarı olmalı.");
        }

        var exam = new KampusExam
        {
            Id = Guid.NewGuid(),
            Kind = "tema",
            Title = request.Title.Trim(),
            Subject = request.Subject,
            ThemeNo = request.ThemeNo,
            ThemeTitle = request.ThemeTitle,
            Grade = request.Grade,
            ClassroomIds = request.ClassroomIds ?? [],
            OpensAt = request.OpensAt,
            ClosesAt = request.ClosesAt,
            Skills = request.Skills ?? [],
            Questions = questions,
            CreatedAt = _clock.UtcNow
        };
        _db.Exams.Add(exam);
        await _db.SaveChangesAsync(cancellationToken);
        return ContentResult.Ok(ToDto(exam));
    }

    public async Task<IReadOnlyList<ExamDto>> ProcessChecksOfAsync(Caller caller, CancellationToken cancellationToken = default) =>
        (await _db.Exams.AsNoTracking().Where(e => e.Kind == "surec" && e.TeacherId == caller.UserId).OrderByDescending(e => e.CreatedAt).ToListAsync(cancellationToken))
        .Select(ToDto).ToList();

    public async Task<ContentResult<ProcessCheckResultsDto>> ProcessCheckResultsAsync(Caller caller, Guid examId, CancellationToken cancellationToken = default)
    {
        var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(e => e.Id == examId && e.Kind == "surec", cancellationToken);
        if (exam is null || (exam.TeacherId != caller.UserId && !caller.IsPlatformAdmin))
        {
            return ContentResult.NotFound<ProcessCheckResultsDto>("Değerlendirme bulunamadı.");
        }

        var students = new List<RosterStudent>();
        foreach (var classroomId in exam.ClassroomIds)
        {
            students.AddRange(await _directory.GetRosterAsync(classroomId, caller, cancellationToken) ?? []);
        }

        students = students.DistinctBy(s => s.StudentId).ToList();
        var ids = students.Select(s => s.StudentId).ToList();
        var results = await _db.ExamResults.AsNoTracking().Where(r => r.ExamId == examId && ids.Contains(r.StudentId)).ToListAsync(cancellationToken);

        var rows = students.Select(s =>
        {
            var r = results.FirstOrDefault(x => x.StudentId == s.StudentId);
            var status = Status(exam, r);
            return new ProcessCheckRowDto(s.StudentId, s.Name, status, status == "sonuc" ? Report(exam, r!) : null);
        }).ToList();
        var doneRows = rows.Where(r => r.Report is not null).ToList();

        var skills = exam.Skills.Select(k =>
        {
            var per = doneRows.Select(r => (r.StudentId, X: r.Report!.Skills.FirstOrDefault(z => z.Skill == k))).Where(z => z.X is not null).ToList();
            return new ProcessCheckSkillDto(k, SkillInfo(k).Name,
                per.Where(z => (double)z.X!.Right / z.X.Total >= MasteryThreshold).Select(z => z.StudentId).ToList(),
                per.Where(z => (double)z.X!.Right / z.X.Total < MasteryThreshold).Select(z => z.StudentId).ToList());
        }).ToList();

        return ContentResult.Ok(new ProcessCheckResultsDto(ToDto(exam), rows, doneRows.Count, students.Count, skills));
    }

    // ---- Yapılacaklar, veli özeti, sıradaki konu ----

    public async Task<IReadOnlyList<TodoItemDto>> TodoAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        var classrooms = await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken);
        var pending = await KampusAssignments.PendingAsync(_db, caller.UserId, classrooms, cancellationToken);
        var soon = _clock.Today.AddDays(14);
        var exams = await StudentExamsAsync(caller, cancellationToken);

        return pending.Select(a => new TodoItemDto("odev", a.Due, KampusAssignments.ToDto(a), null, null))
            .Concat(exams
                .Where(x => x.Status is "acik" or "devam" || (x.Status == "yakinda" && x.Exam.OpensAt <= soon))
                .Select(x => new TodoItemDto("sinav", x.Status == "yakinda" ? x.Exam.OpensAt : x.Exam.ClosesAt, null, x.Exam, x.Status)))
            .OrderBy(x => x.Date)
            .ToList();
    }

    /// <summary>
    /// For a parent (or the student, or their teacher): what was finished this week, which skills to repeat
    /// (wrong in the check step, or wrong twice), open assignments, and a 0–5 activity light.
    /// </summary>
    public async Task<ContentResult<ChildSummaryDto>> ChildSummaryAsync(Caller caller, Guid studentId, CancellationToken cancellationToken = default)
    {
        if (!await _directory.CanViewStudentAsync(studentId, caller, cancellationToken))
        {
            return ContentResult.NotFound<ChildSummaryDto>("Öğrenci bulunamadı.");
        }

        var attempts = await _db.TopicAttempts.AsNoTracking().Where(a => a.StudentId == studentId).ToListAsync(cancellationToken);
        var weekAgo = _clock.UtcNow.AddDays(-7);
        var weekly = attempts.Where(a => a.CompletedAt > weekAgo).OrderByDescending(a => a.CompletedAt).ToList();
        var completed = weekly.Select(a => new CompletedTopicDto(a.TopicId, _catalog.Topic(a.TopicId)?.Title ?? a.TopicId, a.CompletedAt)).ToList();

        var repeat = new Dictionary<string, RepeatSkillDto>();
        foreach (var a in attempts)
        {
            if (_catalog.Topic(a.TopicId) is not { } topic)
            {
                continue;
            }

            foreach (var q in topic.Practice.Concat(topic.Check).Concat(topic.Exercises).Concat(topic.TestPool))
            {
                if (q.Skill is null || !a.Answers.TryGetValue(q.Id, out var v))
                {
                    continue;
                }

                var step = v.TryGetProperty("step", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;
                var wrong = Int(v, "wrong");
                if ((step == "check" && wrong > 0) || wrong >= 2)
                {
                    repeat[q.Skill] = new RepeatSkillDto(q.Skill, a.TopicId);
                }
            }
        }

        var classrooms = await _directory.GetStudentClassroomIdsAsync(studentId, caller, cancellationToken);
        var pending = await KampusAssignments.PendingAsync(_db, studentId, classrooms, cancellationToken);
        return ContentResult.Ok(new ChildSummaryDto(completed, repeat.Values.ToList(), pending.Select(KampusAssignments.ToDto).ToList(), Math.Min(5, weekly.Count)));
    }

    /// <summary>"Devam et": the earliest open assignment, else the first unfinished topic of the student's grade.</summary>
    public async Task<string?> NextTopicAsync(Caller caller, CancellationToken cancellationToken = default)
    {
        var classrooms = await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken);
        var pending = await KampusAssignments.PendingAsync(_db, caller.UserId, classrooms, cancellationToken);
        if (pending.Count > 0)
        {
            return pending[0].TopicId;
        }

        var grade = await _directory.GetOwnGradeAsync(caller, cancellationToken);
        if (grade is null || !_catalog.Data.Grades.TryGetValue(grade.Value.ToString(CultureInfo.InvariantCulture), out var subjects))
        {
            return null;
        }

        var done = (await _db.TopicAttempts.Where(a => a.StudentId == caller.UserId).Select(a => a.TopicId).Distinct().ToListAsync(cancellationToken)).ToHashSet();
        return subjects.SelectMany(s => _catalog.CourseTopics($"{grade}-{s}")).FirstOrDefault(id => !done.Contains(id));
    }

    // ---- Yardımcılar ----

    private async Task<List<KampusExam>> VisibleExamsAsync(Caller caller, CancellationToken cancellationToken)
    {
        if (!caller.IsStudent)
        {
            return [];
        }

        var classrooms = (await _directory.GetOwnClassroomIdsAsync(caller, cancellationToken)).ToList();
        var grade = await _directory.GetOwnGradeAsync(caller, cancellationToken);
        var candidates = await _db.Exams.AsNoTracking()
            .Where(e => (e.Kind == "tema" && e.Grade == grade) || e.Kind == "surec")
            .ToListAsync(cancellationToken);

        return candidates.Where(e => e.Kind == "tema"
                ? e.ClassroomIds.Count == 0 || e.ClassroomIds.Any(classrooms.Contains)
                : e.ClassroomIds.Any(classrooms.Contains))
            .ToList();
    }

    /// <summary>sonuc (finished) · yakinda (not open yet, or no questions) · devam (started) · acik.</summary>
    private string Status(KampusExam exam, KampusExamResult? result)
    {
        if (result is { Done: true })
        {
            return "sonuc";
        }

        if (exam.OpensAt > _clock.Today || exam.Questions.Count == 0)
        {
            return "yakinda";
        }

        return result is { Idx: > 0 } ? "devam" : "acik";
    }

    private ExamReportDto Report(KampusExam exam, KampusExamResult result)
    {
        var skills = exam.Questions
            .GroupBy(q => q.Skill)
            .Select(g =>
            {
                var info = SkillInfo(g.Key);
                return new SkillResultDto(g.Key, info.Name, info.Can, info.Study, info.TopicId, info.Course,
                    g.Count(q => result.Answers.TryGetValue(q.Id, out var a) && a.Ok), g.Count());
            })
            .ToList();
        var strong = skills.Where(x => (double)x.Right / x.Total >= MasteryThreshold).ToList();
        var weak = skills.Where(x => (double)x.Right / x.Total < MasteryThreshold).ToList();

        var msg = strong.Count > 0
            ? string.Join(", ", strong.Select((x, i) => i > 0 ? LowerFirst(x.Can ?? x.Name) : x.Can ?? x.Name)) + ". "
            : string.Empty;
        msg += weak.Count > 0
            ? UpperFirst(string.Join(" ve ", weak.Select(x => x.Study ?? x.Name))) + " bir kez daha çalışalım."
            : "Harika, böyle devam!";

        var review = exam.Questions.Select(q =>
        {
            result.Answers.TryGetValue(q.Id, out var a);
            return new ReviewQuestionDto(q.Id, q.Skill, q.Prompt, a?.Given, a?.Ok == true, q.Answer);
        }).ToList();

        return new ExamReportDto(exam.Id, skills, strong.Select(x => x.Skill).ToList(), weak.Select(x => x.Skill).ToList(), msg,
            review.Count(r => r.Ok), exam.Questions.Count, review);
    }

    private CatalogSkill SkillInfo(string key) =>
        _catalog.Data.AssessSkills.TryGetValue(key, out var s) ? s : new CatalogSkill(string.Empty, key, null, null, string.Empty, null);

    private static int Int(JsonElement v, string name) =>
        v.ValueKind == JsonValueKind.Object && v.TryGetProperty(name, out var p) && p.TryGetInt32(out var n) ? n : 0;

    private static string LowerFirst(string s) => s.Length == 0 ? s : char.ToLower(s[0], Turkish) + s[1..];

    private static string UpperFirst(string s) => s.Length == 0 ? s : char.ToUpper(s[0], Turkish) + s[1..];

    private static List<T> Shuffle<T>(IEnumerable<T> items)
    {
        var list = items.ToList();
        Random.Shared.Shuffle(System.Runtime.InteropServices.CollectionsMarshal.AsSpan(list));
        return list;
    }

    private static ExamDto ToDto(KampusExam e) => new(
        e.Id, e.Kind, e.Title, e.Subject, e.ThemeNo, e.ThemeTitle, e.Grade, e.ClassroomIds, e.AssignedBy, e.OpensAt, e.ClosesAt, e.Skills, e.Questions.Count, e.CreatedAt);

    private static ExamStateDto ToDto(KampusExamResult r) => new(
        r.Idx, r.Done, r.Answers.ToDictionary(kv => kv.Key, kv => new ExamAnswerDto(kv.Value.Given, kv.Value.Ok)), r.SubmittedAt);
}
