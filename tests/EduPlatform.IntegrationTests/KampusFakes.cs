using System.Text.Json;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Kampus.Services;
using Shared.Authorization;

namespace EduPlatform.IntegrationTests;

/// <summary>Classrooms, grades and guardian links as ClassroomService and UserService would answer them.</summary>
internal sealed class FakeKampusDirectory : IKampusDirectory
{
    public Dictionary<Guid, int> Grades { get; } = new();
    public Dictionary<Guid, List<Guid>> StudentClassrooms { get; } = new();
    public Dictionary<Guid, Guid> ClassroomTeacher { get; } = new();
    public HashSet<(Guid Parent, Guid Student)> Guardians { get; } = new();

    public Task<int?> GetOwnGradeAsync(Caller student, CancellationToken cancellationToken = default) =>
        Task.FromResult(Grades.TryGetValue(student.UserId, out var g) ? g : (int?)null);

    public Task<IReadOnlyCollection<Guid>> GetOwnClassroomIdsAsync(Caller caller, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyCollection<Guid>>(caller.IsStudent
            ? StudentClassrooms.GetValueOrDefault(caller.UserId) ?? []
            : ClassroomTeacher.Where(kv => kv.Value == caller.UserId).Select(kv => kv.Key).ToList());

    public Task<bool> CanManageClassroomAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default) =>
        Task.FromResult(caller.IsPlatformAdmin || (ClassroomTeacher.TryGetValue(classroomId, out var t) && t == caller.UserId));

    public async Task<IReadOnlyList<RosterStudent>?> GetRosterAsync(Guid classroomId, Caller caller, CancellationToken cancellationToken = default) =>
        await CanManageClassroomAsync(classroomId, caller, cancellationToken)
            ? StudentClassrooms.Where(kv => kv.Value.Contains(classroomId)).Select(kv => new RosterStudent(kv.Key, "Öğrenci " + kv.Key.ToString()[..4])).ToList()
            : null;

    public Task<bool> CanViewStudentAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default) =>
        Task.FromResult(caller.CanActFor(studentId)
            || (caller.IsParent && Guardians.Contains((caller.UserId, studentId)))
            || (caller.IsInstructor && (StudentClassrooms.GetValueOrDefault(studentId) ?? []).Any(c => ClassroomTeacher.GetValueOrDefault(c) == caller.UserId)));

    public Task<IReadOnlyCollection<Guid>> GetStudentClassroomIdsAsync(Guid studentId, Caller caller, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyCollection<Guid>>(StudentClassrooms.GetValueOrDefault(studentId) ?? []);
}

internal static class KampusAnswers
{
    public static JsonElement Right(CatalogQuestion q) => q.Type == "match"
        ? JsonSerializer.SerializeToElement(Enumerable.Range(0, q.Pairs!.Value).ToDictionary(i => i.ToString(System.Globalization.CultureInfo.InvariantCulture), i => i))
        : JsonSerializer.SerializeToElement(q.Answer![0]);

    public static JsonElement Right(ExamQuestion q) => Right(new CatalogQuestion(q.Id, q.Type, q.Answer, q.Pairs, q.Skill, q.Options));

    public static JsonElement Wrong() => JsonSerializer.SerializeToElement("yanlis-cevap");

    /// <summary>A practice record as the frontend writes it.</summary>
    public static JsonElement Practice(int wrong, string step = "practice", params string[] picks) =>
        JsonSerializer.SerializeToElement(new { step, wrong, hints = wrong, picks });
}
