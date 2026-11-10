using ContentService.Kampus;
using ContentService.Services;
using Shared.Models;
using Shouldly;

namespace EduPlatform.IntegrationTests;

/// <summary>Teachers only reach their own classrooms, parents only linked children; exams graded on the server.</summary>
[Collection("postgres")]
public class KampusTeachingTests : KampusTestBase
{
    private const string AssignedTopic = "k-eldeli-toplama";

    public KampusTeachingTests(PostgresFixture postgres) : base(postgres)
    {
    }

    [SkippableFact]
    public async Task A_teacher_assigns_a_topic_to_their_class_and_reads_who_struggled()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var (teacher, classroom) = Classroom();
        var other = NewCaller(UserRole.Instructor);
        var student = NewStudent(classroom: classroom);
        var classmate = NewStudent(classroom: classroom);

        var due = DateOnly.FromDateTime(Start.UtcDateTime).AddDays(3);
        (await s.Teaching.CreateAssignmentAsync(other, new CreateAssignmentRequest(classroom, AssignedTopic, due, null))).Status.ShouldBe(ContentResultStatus.Forbidden);
        (await s.Teaching.CreateAssignmentAsync(teacher, new CreateAssignmentRequest(classroom, "yok", due, null))).Status.ShouldBe(ContentResultStatus.NotFound);
        var assignment = (await s.Teaching.CreateAssignmentAsync(teacher, new CreateAssignmentRequest(classroom, AssignedTopic, due, "Toplama"))).Value!;

        (await s.Teaching.StudentAssignmentsAsync(student, student.UserId, done: false)).Value!.Single().Id.ShouldBe(assignment.Id);
        (await s.Teaching.TodoAsync(student)).ShouldContain(t => t.Kind == "odev" && t.Assignment!.Id == assignment.Id);

        var topic = Catalog.Topic(AssignedTopic)!;
        var answers = topic.Practice.Concat(topic.Check).ToDictionary(q => q.Id, q => KampusAnswers.Practice(0, q.Id.Contains("-c") ? "check" : "practice"));
        var hard = topic.Practice[0];
        var wrongPick = hard.Options!.First(o => o.V != hard.Answer![0]).V;
        answers[hard.Id] = KampusAnswers.Practice(2, "practice", wrongPick, wrongPick);

        var attempt = (await s.Learner.SaveAttemptAsync(student, new SaveAttemptRequest(AssignedTopic, answers))).Value!;
        attempt.AssignmentId.ShouldBe(assignment.Id);
        (await s.Teaching.StudentAssignmentsAsync(student, student.UserId, done: false)).Value!.ShouldBeEmpty();
        (await s.Teaching.StudentAssignmentsAsync(student, student.UserId, done: true)).Value!.Single().Id.ShouldBe(assignment.Id);

        (await s.Teaching.AssignmentResultsAsync(other, assignment.Id)).Status.ShouldBe(ContentResultStatus.NotFound);
        var results = (await s.Teaching.AssignmentResultsAsync(teacher, assignment.Id)).Value!;
        results.Total.ShouldBe(2);
        results.DoneCount.ShouldBe(1);
        results.Rows.Single(r => r.StudentId == student.UserId).WrongQs.ShouldBe(1);
        results.Rows.Single(r => r.StudentId == classmate.UserId).Done.ShouldBeFalse();
        var top = results.Questions[0];
        top.QuestionId.ShouldBe(hard.Id);
        top.Struggled.ShouldBe(1);
        top.TopWrong.ShouldBe(hard.Options!.Single(o => o.V == wrongPick).Label);
    }

    [SkippableFact]
    public async Task Parents_see_only_linked_children_and_teachers_only_their_students()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var (teacher, classroom) = Classroom();
        var student = NewStudent(classroom: classroom);
        var parent = NewCaller(UserRole.Parent);
        var stranger = NewCaller(UserRole.Parent);
        var otherTeacher = NewCaller(UserRole.Instructor);
        var otherStudent = NewStudent();
        Directory.Guardians.Add((parent.UserId, student.UserId));

        await s.Learner.SaveStopAsync(student, Topic, "anlatim", null);

        (await s.Teaching.ChildSummaryAsync(parent, student.UserId)).IsOk.ShouldBeTrue();
        (await s.Teaching.ChildSummaryAsync(teacher, student.UserId)).IsOk.ShouldBeTrue();
        (await s.Teaching.ChildSummaryAsync(student, student.UserId)).IsOk.ShouldBeTrue();
        (await s.Teaching.ChildSummaryAsync(stranger, student.UserId)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await s.Teaching.ChildSummaryAsync(otherTeacher, student.UserId)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await s.Teaching.ChildSummaryAsync(otherStudent, student.UserId)).Status.ShouldBe(ContentResultStatus.NotFound);
        (await s.Teaching.StudentAssignmentsAsync(stranger, student.UserId, done: false)).Status.ShouldBe(ContentResultStatus.NotFound);
    }

    [SkippableFact]
    public async Task The_parent_summary_lists_the_weeks_topics_and_the_skills_to_repeat()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var student = NewStudent();
        var parent = NewCaller(UserRole.Parent);
        Directory.Guardians.Add((parent.UserId, student.UserId));

        var topic = Catalog.Topic(AssignedTopic)!;
        var check = topic.Check.First(q => q.Skill is not null);
        await s.Learner.SaveAttemptAsync(student, new SaveAttemptRequest(AssignedTopic, new() { [check.Id] = KampusAnswers.Practice(1, "check") }));

        var summary = (await s.Teaching.ChildSummaryAsync(parent, student.UserId)).Value!;
        summary.Completed.Single().TopicId.ShouldBe(AssignedTopic);
        summary.Repeat.ShouldContain(r => r.Skill == check.Skill && r.TopicId == AssignedTopic);
        summary.Light.ShouldBe(1);

        Time.Advance(TimeSpan.FromDays(8));
        var later = (await s.Teaching.ChildSummaryAsync(parent, student.UserId)).Value!;
        later.Completed.ShouldBeEmpty("only this week's work is listed");
        later.Repeat.ShouldNotBeEmpty("skills to repeat are not forgotten after a week");
    }

    [SkippableFact]
    public async Task A_process_check_draws_the_same_bank_questions_for_the_class_and_reports_per_skill()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var (teacher, classroom) = Classroom();
        var strong = NewStudent(classroom: classroom);
        var weak = NewStudent(classroom: classroom);
        var outsider = NewStudent();
        var today = DateOnly.FromDateTime(Start.UtcDateTime);

        CreateProcessCheckRequest Request(Guid cls, List<string> skills, int per = 2) => new(cls, 3, skills, per, today, today.AddDays(4), null);
        (await s.Teaching.CreateProcessCheckAsync(NewCaller(UserRole.Instructor), Request(classroom, ["karsilastirma"]), null)).Status.ShouldBe(ContentResultStatus.Forbidden);
        (await s.Teaching.CreateProcessCheckAsync(teacher, Request(classroom, []), null)).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Teaching.CreateProcessCheckAsync(teacher, Request(classroom, ["uydurma"]), null)).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Teaching.CreateProcessCheckAsync(teacher, Request(classroom, ["karsilastirma"], per: 9), null)).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Teaching.CreateProcessCheckAsync(teacher, new(classroom, 3, ["karsilastirma"], 2, today, today.AddDays(-1), null), null)).Status.ShouldBe(ContentResultStatus.Invalid);

        var exam = (await s.Teaching.CreateProcessCheckAsync(teacher, Request(classroom, ["karsilastirma", "okuma"]), "Ayşe Yılmaz")).Value!;
        exam.QuestionCount.ShouldBe(4);
        exam.AssignedBy.ShouldBe("Ayşe Yılmaz");

        (await s.Teaching.StudentExamsAsync(outsider)).ShouldBeEmpty();
        (await s.Teaching.ExamForStudentAsync(outsider, exam.Id)).Status.ShouldBe(ContentResultStatus.NotFound);

        var play = (await s.Teaching.ExamForStudentAsync(strong, exam.Id)).Value!;
        play.Status.ShouldBe("acik");
        play.Questions.Count.ShouldBe(4);
        System.Text.Json.JsonSerializer.Serialize(play).ShouldNotContain("\"answer\"", Case.Insensitive, "answer keys never reach the student before the end");

        var stored = (await db.Exams.FindAsync(exam.Id))!.Questions;
        foreach (var q in stored)
        {
            await s.Teaching.AnswerExamAsync(strong, exam.Id, q.Id, KampusAnswers.Right(q));
            await s.Teaching.AnswerExamAsync(weak, exam.Id, q.Id, q.Skill == "okuma" ? KampusAnswers.Wrong() : KampusAnswers.Right(q));
        }

        (await s.Teaching.AnswerExamAsync(strong, exam.Id, stored[0].Id, KampusAnswers.Wrong())).Status.ShouldBe(ContentResultStatus.Invalid, "a finished exam is closed");

        var report = (await s.Teaching.ExamReportAsync(weak, weak.UserId, exam.Id)).Value!;
        report.Right.ShouldBe(2);
        report.Strong.ShouldBe(["karsilastirma"]);
        report.Weak.ShouldBe(["okuma"]);
        report.Msg.ShouldBe("Sayıları karşılaştırabiliyorsun. Okuduğunu anlamayı bir kez daha çalışalım.");
        (await s.Teaching.ExamReportAsync(outsider, weak.UserId, exam.Id)).Status.ShouldBe(ContentResultStatus.NotFound);

        (await s.Teaching.ProcessCheckResultsAsync(NewCaller(UserRole.Instructor), exam.Id)).Status.ShouldBe(ContentResultStatus.NotFound);
        var results = (await s.Teaching.ProcessCheckResultsAsync(teacher, exam.Id)).Value!;
        results.DoneCount.ShouldBe(2);
        var reading = results.Skills.Single(k => k.Skill == "okuma");
        reading.Mastered.ShouldBe([strong.UserId]);
        reading.Repeat.ShouldBe([weak.UserId]);
        (await s.Teaching.ProcessChecksOfAsync(teacher)).Single().Id.ShouldBe(exam.Id);
    }

    [SkippableFact]
    public async Task A_theme_exam_is_published_by_an_administrator_for_a_grade_and_opens_on_its_day()
    {
        Skip.If(!Available, "Docker is not available for Testcontainers.");

        await using var db = await FreshDbAsync();
        var s = Services(db);
        var third = NewStudent();
        var first = NewStudent(grade: 1);
        var today = DateOnly.FromDateTime(Start.UtcDateTime);
        var questions = new List<ContentService.Kampus.Data.ExamQuestion>
        {
            new("t1", "karsilastirma", "choice", "Hangisi en büyük?", null, [new("489", "489"), new("948", "948")], ["948"], null)
        };
        var request = new CreateThemeExamRequest(3, "Sayılar ve Nicelikler (1)", "matematik", 1, "Sayılar ve Nicelikler (1)", today.AddDays(2), today.AddDays(9), ["karsilastirma"], questions, null);

        (await s.Teaching.CreateThemeExamAsync(NewCaller(UserRole.Instructor), request)).Status.ShouldBe(ContentResultStatus.Forbidden);
        var exam = (await s.Teaching.CreateThemeExamAsync(NewCaller(UserRole.Admin), request)).Value!;

        (await s.Teaching.StudentExamsAsync(first)).ShouldBeEmpty();
        var listed = (await s.Teaching.StudentExamsAsync(third)).Single();
        listed.Status.ShouldBe("yakinda");
        (await s.Teaching.ExamForStudentAsync(third, exam.Id)).Value!.Questions.ShouldBeEmpty("questions stay hidden until it opens");
        (await s.Teaching.AnswerExamAsync(third, exam.Id, "t1", KampusAnswers.Right(questions[0]))).Status.ShouldBe(ContentResultStatus.Invalid);
        (await s.Teaching.TodoAsync(third)).ShouldContain(t => t.Kind == "sinav" && t.Date == today.AddDays(2));

        Time.Advance(TimeSpan.FromDays(2));
        (await s.Teaching.AnswerExamAsync(third, exam.Id, "t1", KampusAnswers.Right(questions[0]))).Value!.State.Done.ShouldBeTrue();
        (await s.Teaching.StudentExamsAsync(third)).Single().Status.ShouldBe("sonuc");
    }

    private (Shared.Authorization.Caller Teacher, Guid Classroom) Classroom()
    {
        var teacher = NewCaller(UserRole.Instructor);
        var classroom = Guid.NewGuid();
        Directory.ClassroomTeacher[classroom] = teacher.UserId;
        return (teacher, classroom);
    }
}
