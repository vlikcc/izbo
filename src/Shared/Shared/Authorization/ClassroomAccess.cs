namespace Shared.Authorization;

/// <summary>
/// A caller's relationship to a classroom. Homework, exam and file authorization all reduce to this,
/// but only ClassroomService owns the enrollment tables, so the other services resolve it over HTTP.
/// </summary>
public sealed record ClassroomAccess(bool IsInstructor, bool IsEnrolled)
{
    public static readonly ClassroomAccess None = new(false, false);

    /// <summary>Instructor of the classroom or an enrolled student.</summary>
    public bool CanView => IsInstructor || IsEnrolled;
}
