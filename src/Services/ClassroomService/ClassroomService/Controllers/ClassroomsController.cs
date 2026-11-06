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
    private readonly IGuardianAccessClient _guardianAccess;
    private readonly ILogger<ClassroomsController> _logger;

    public ClassroomsController(
        IClassroomManagementService classroomService,
        ISessionService sessionService,
        IGuardianAccessClient guardianAccess,
        ILogger<ClassroomsController> logger)
    {
        _classroomService = classroomService;
        _sessionService = sessionService;
        _guardianAccess = guardianAccess;
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

    [HttpPost("join")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> JoinByCode([FromBody] JoinClassroomRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var result = await _classroomService.JoinByCodeAsync(request.Code, Caller);

        return result.Outcome switch
        {
            JoinClassroomOutcome.Joined => Ok(new ApiResponse<ClassroomDto>(true, result.Classroom, "Sınıfa katıldınız")),
            JoinClassroomOutcome.AlreadyEnrolled => Ok(new ApiResponse<ClassroomDto>(true, result.Classroom, "Bu sınıfa zaten kayıtlısınız")),
            JoinClassroomOutcome.Full => Conflict(new ApiResponse<ClassroomDto>(false, null, "Sınıf dolu. Öğretmeninize haber verin.")),
            JoinClassroomOutcome.NotAllowed => StatusCode(StatusCodes.Status403Forbidden,
                new ApiResponse<ClassroomDto>(false, null, "Bu sınıfa öğrenci olarak katılamazsınız")),
            _ => NotFound(new ApiResponse<ClassroomDto>(false, null, "Bu koda ait bir sınıf bulunamadı"))
        };
    }

    [HttpPost("{id}/invite-code/regenerate")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<InviteCodeDto>>> RegenerateInviteCode(Guid id)
    {
        var code = await _classroomService.RegenerateInviteCodeAsync(id, Caller);
        return code is null
            ? NotFound(new ApiResponse<InviteCodeDto>(false, null, "Classroom not found"))
            : Ok(new ApiResponse<InviteCodeDto>(true, new InviteCodeDto(code), "Yeni katılım kodu oluşturuldu"));
    }

    /// <summary>A student's classrooms, for the student themself, a linked parent, or an admin.</summary>
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<ApiResponse<PagedResponse<ClassroomDto>>>> GetStudentClassrooms(
        Guid studentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller))
        {
            return NotFound(new ApiResponse<PagedResponse<ClassroomDto>>(false, null, "Student not found"));
        }

        var result = await _classroomService.GetStudentClassroomsAsync(studentId, new PagedRequest(page, pageSize));
        return Ok(new ApiResponse<PagedResponse<ClassroomDto>>(true, result));
    }

    /// <summary>Ids of a student's classrooms; other services use it to scope a parent's view.</summary>
    [HttpGet("student/{studentId}/ids")]
    public async Task<ActionResult<ApiResponse<List<Guid>>>> GetStudentClassroomIds(Guid studentId)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller))
        {
            return NotFound(new ApiResponse<List<Guid>>(false, null, "Student not found"));
        }

        var ids = await _classroomService.GetAccessibleClassroomIdsAsync(new Caller(studentId, Shared.Models.UserRole.Student));
        return Ok(new ApiResponse<List<Guid>>(true, ids));
    }

    [HttpGet("student/{studentId}/sessions/upcoming")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetStudentUpcomingSessions(Guid studentId)
    {
        if (!await _guardianAccess.CanViewStudentAsync(studentId, Caller))
        {
            return NotFound(new ApiResponse<List<ClassSessionDto>>(false, null, "Student not found"));
        }

        // Read-only, and only after the guardianship check: the student's own view of their schedule.
        var result = await _sessionService.GetUpcomingSessionsAsync(new Caller(studentId, Shared.Models.UserRole.Student));
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
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

    [HttpPost("sessions")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<ClassSessionDto>>> CreateGlobalSession([FromBody] CreateSessionRequest request)
    {
        var result = await _sessionService.CreateSessionAsync(null, request, Caller);

        if (result == null)
            return BadRequest(new ApiResponse<ClassSessionDto>(false, null, "Could not create global session"));

        return Ok(new ApiResponse<ClassSessionDto>(true, result, "Global session created successfully"));
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
        var result = await _sessionService.GetUpcomingSessionsAsync(Caller);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/live")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetLiveSessions()
    {
        var result = await _sessionService.GetLiveSessionsAsync(Caller);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/{sessionId}")]
    public async Task<ActionResult<ApiResponse<ClassSessionDto>>> GetSession(Guid sessionId)
    {
        var result = await _sessionService.GetSessionAsync(sessionId, Caller);

        if (result == null)
            return NotFound(new ApiResponse<ClassSessionDto>(false, null, "Session not found"));

        return Ok(new ApiResponse<ClassSessionDto>(true, result));
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
