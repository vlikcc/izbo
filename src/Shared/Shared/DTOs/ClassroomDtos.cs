namespace Shared.DTOs;

// Classroom DTOs
public record ClassroomDto(
    Guid Id, 
    string Name, 
    string Description, 
    Guid InstructorId, 
    string? InstructorName,
    string? CoverImageUrl, 
    int StudentCount,
    bool IsActive, 
    DateTime CreatedAt);

public record CreateClassroomRequest(string Name, string Description, string? CoverImageUrl);
public record UpdateClassroomRequest(string? Name, string? Description, string? CoverImageUrl);

// Enrollment DTOs
public record EnrollmentDto(Guid Id, Guid ClassroomId, Guid StudentId, string StudentName, DateTime EnrolledAt, bool IsActive);
public record EnrollStudentRequest(Guid StudentId);
public record BulkEnrollRequest(List<Guid> StudentIds);

// Session DTOs
public record ClassSessionDto(
    Guid Id, 
    Guid ClassroomId, 
    string Title, 
    string? Description, 
    DateTime ScheduledStartTime, 
    DateTime ScheduledEndTime, 
    string? MeetingUrl, 
    string? RecordingUrl, 
    string Status);

public record CreateSessionRequest(string Title, string? Description, DateTime ScheduledStartTime, DateTime ScheduledEndTime);
public record UpdateSessionRequest(string? Title, string? Description, DateTime? ScheduledStartTime, DateTime? ScheduledEndTime);
