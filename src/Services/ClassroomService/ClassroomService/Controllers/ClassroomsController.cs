using ClassroomService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using System.Security.Claims;

namespace ClassroomService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ClassroomsController : ControllerBase
{
    private readonly IClassroomManagementService _classroomService;
    private readonly ISessionService _sessionService;
    private readonly ILogger<ClassroomsController> _logger;

    public ClassroomsController(
        IClassroomManagementService classroomService,
        ISessionService sessionService,
        ILogger<ClassroomsController> logger)
    {
        _classroomService = classroomService;
        _sessionService = sessionService;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpPost]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> CreateClassroom([FromBody] CreateClassroomRequest request)
    {
        var result = await _classroomService.CreateClassroomAsync(request, Caller.UserId);

        if (result == null)
            return BadRequest(new ApiResponse<ClassroomDto>(false, null, "Failed to create classroom"));

        return Ok(new ApiResponse<ClassroomDto>(true, result, "Classroom created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<ClassroomDto>>>> GetClassrooms(
        [FromQuery] Guid? instructorId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false,
        CancellationToken cancellationToken = default)
    {
        var result = await _classroomService.GetClassroomsAsync(
            instructorId,
            new PagedRequest(page, pageSize, sortBy, sortDescending),
            cancellationToken);
        return Ok(new ApiResponse<PagedResponse<ClassroomDto>>(true, result));
    }

    [HttpGet("my-classrooms")]
    public async Task<ActionResult<ApiResponse<PagedResponse<ClassroomDto>>>> GetMyClassrooms(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false,
        CancellationToken cancellationToken = default)
    {
        var caller = Caller;
        var paging = new PagedRequest(page, pageSize, sortBy, sortDescending);

        var result = caller.CanManageContent
            ? await _classroomService.GetClassroomsAsync(caller.UserId, paging, cancellationToken)
            : await _classroomService.GetStudentClassroomsAsync(caller.UserId, paging, cancellationToken);

        return Ok(new ApiResponse<PagedResponse<ClassroomDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> GetClassroom(Guid id)
    {
        var result = await _classroomService.GetClassroomAsync(id, Caller);

        if (result == null)
            return NotFound(new ApiResponse<ClassroomDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassroomDto>(true, result));
    }

    /// <summary>
    /// Reports the caller's relationship to a classroom. Homework, exam and file services call this to
    /// authorize classroom-scoped content they cannot evaluate against their own database.
    /// </summary>
    [HttpGet("{id}/my-access")]
    public async Task<ActionResult<ApiResponse<ClassroomAccess>>> GetMyAccess(Guid id)
    {
        var access = await _classroomService.GetAccessAsync(id, Caller);

        if (access == null)
            return NotFound(new ApiResponse<ClassroomAccess>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassroomAccess>(true, access));
    }

    /// <summary>
    /// Lists the classrooms the caller teaches or is enrolled in, so services holding classroom-scoped
    /// content can scope their own list queries without duplicating the enrollment tables.
    /// </summary>
    [HttpGet("my-classroom-ids")]
    public async Task<ActionResult<ApiResponse<List<Guid>>>> GetMyClassroomIds()
    {
        var result = await _classroomService.GetAccessibleClassroomIdsAsync(Caller);
        return Ok(new ApiResponse<List<Guid>>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> UpdateClassroom(Guid id, [FromBody] UpdateClassroomRequest request)
    {
        var result = await _classroomService.UpdateClassroomAsync(id, request, Caller);

        if (result == null)
            return NotFound(new ApiResponse<ClassroomDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassroomDto>(true, result, "Classroom updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteClassroom(Guid id)
    {
        var result = await _classroomService.DeleteClassroomAsync(id, Caller);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Classroom not found"));

        return Ok(new ApiResponse<bool>(true, true, "Classroom deleted successfully"));
    }

    // Enrollment endpoints
    [HttpPost("{id}/enroll")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> EnrollStudent(Guid id, [FromBody] EnrollStudentRequest request)
    {
        var result = await _classroomService.EnrollStudentAsync(id, request.StudentId, Caller);

        if (!result)
            return Conflict(new ApiResponse<bool>(false, false, "Student already enrolled or classroom not found"));

        return Ok(new ApiResponse<bool>(true, true, "Student enrolled successfully"));
    }

    [HttpPost("{id}/enroll-bulk")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> EnrollStudentsBulk(Guid id, [FromBody] BulkEnrollRequest request)
    {
        var result = await _classroomService.EnrollStudentsBulkAsync(id, request.StudentIds, Caller);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Classroom not found"));

        return Ok(new ApiResponse<bool>(true, true, "Students enrolled successfully"));
    }

    [HttpDelete("{id}/enroll/{studentId}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> UnenrollStudent(Guid id, Guid studentId)
    {
        var result = await _classroomService.UnenrollStudentAsync(id, studentId, Caller);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Enrollment not found"));

        return Ok(new ApiResponse<bool>(true, true, "Student unenrolled successfully"));
    }

    [HttpGet("{id}/enrollments")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<List<EnrollmentDto>>>> GetEnrollments(Guid id)
    {
        var result = await _classroomService.GetEnrollmentsAsync(id, Caller);

        if (result == null)
            return NotFound(new ApiResponse<List<EnrollmentDto>>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<List<EnrollmentDto>>(true, result));
    }

    // Session endpoints
    [HttpPost("{id}/sessions")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ClassSessionDto>>> CreateSession(Guid id, [FromBody] CreateSessionRequest request)
    {
        var result = await _sessionService.CreateSessionAsync(id, request, Caller);

        if (result == null)
            return NotFound(new ApiResponse<ClassSessionDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassSessionDto>(true, result, "Session created successfully"));
    }

    [HttpGet("{id}/sessions")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetSessions(Guid id)
    {
        var result = await _sessionService.GetClassroomSessionsAsync(id, Caller);

        if (result == null)
            return NotFound(new ApiResponse<List<ClassSessionDto>>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/upcoming")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetUpcomingSessions()
    {
        var result = await _sessionService.GetUpcomingSessionsAsync(Caller.UserId);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/live")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetLiveSessions()
    {
        var result = await _sessionService.GetLiveSessionsAsync(Caller);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    /// <summary>
    /// Reports the caller's relationship to the classroom that owns a session. LiveSessionService calls
    /// this before letting a connection join the session's signalling group.
    /// </summary>
    [HttpGet("sessions/{sessionId}/my-access")]
    public async Task<ActionResult<ApiResponse<ClassroomAccess>>> GetMySessionAccess(Guid sessionId)
    {
        var access = await _sessionService.GetSessionAccessAsync(sessionId, Caller);

        if (access == null)
            return NotFound(new ApiResponse<ClassroomAccess>(false, null, "Session not found"));

        return Ok(new ApiResponse<ClassroomAccess>(true, access));
    }

    [HttpPost("sessions/{sessionId}/start")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> StartSession(Guid sessionId)
    {
        var result = await _sessionService.StartSessionAsync(sessionId, Caller);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot start session"));

        return Ok(new ApiResponse<bool>(true, true, "Session started"));
    }

    [HttpPost("sessions/{sessionId}/end")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> EndSession(Guid sessionId)
    {
        var result = await _sessionService.EndSessionAsync(sessionId, Caller);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot end session"));

        return Ok(new ApiResponse<bool>(true, true, "Session ended"));
    }

    [HttpGet("sessions/{sessionId}/token")]
    public async Task<ActionResult<ApiResponse<string>>> GetSessionToken(Guid sessionId)
    {
        var firstName = User.FindFirstValue("firstName");
        var lastName = User.FindFirstValue("lastName");
        var userName = string.Join(' ', new[] { firstName, lastName }.Where(n => !string.IsNullOrWhiteSpace(n)));
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

        var token = await _sessionService.GetJitsiTokenAsync(
            sessionId,
            Caller,
            string.IsNullOrWhiteSpace(userName) ? "User" : userName,
            email);

        if (token == null)
            return NotFound(new ApiResponse<string>(false, null, "Session not available"));

        return Ok(new ApiResponse<string>(true, token));
    }
}
