using ClassroomService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    [HttpPost]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> CreateClassroom([FromBody] CreateClassroomRequest request)
    {
        var instructorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _classroomService.CreateClassroomAsync(request, instructorId);

        if (result == null)
            return BadRequest(new ApiResponse<ClassroomDto>(false, null, "Failed to create classroom"));

        return Ok(new ApiResponse<ClassroomDto>(true, result, "Classroom created successfully"));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<ClassroomDto>>>> GetClassrooms(
        [FromQuery] Guid? instructorId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _classroomService.GetClassroomsAsync(instructorId, new PagedRequest(page, pageSize));
        return Ok(new ApiResponse<PagedResponse<ClassroomDto>>(true, result));
    }

    [HttpGet("my-classrooms")]
    public async Task<ActionResult<ApiResponse<PagedResponse<ClassroomDto>>>> GetMyClassrooms(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role = User.FindFirstValue(ClaimTypes.Role);

        PagedResponse<ClassroomDto> result;
        if (role == "Instructor" || role == "Admin" || role == "SuperAdmin")
        {
            result = await _classroomService.GetClassroomsAsync(userId, new PagedRequest(page, pageSize));
        }
        else
        {
            result = await _classroomService.GetStudentClassroomsAsync(userId, new PagedRequest(page, pageSize));
        }

        return Ok(new ApiResponse<PagedResponse<ClassroomDto>>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> GetClassroom(Guid id)
    {
        var result = await _classroomService.GetClassroomAsync(id);

        if (result == null)
            return NotFound(new ApiResponse<ClassroomDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassroomDto>(true, result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<ClassroomDto>>> UpdateClassroom(Guid id, [FromBody] UpdateClassroomRequest request)
    {
        var result = await _classroomService.UpdateClassroomAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<ClassroomDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassroomDto>(true, result, "Classroom updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteClassroom(Guid id)
    {
        var result = await _classroomService.DeleteClassroomAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Classroom not found"));

        return Ok(new ApiResponse<bool>(true, true, "Classroom deleted successfully"));
    }

    // Enrollment endpoints
    [HttpPost("{id}/enroll")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> EnrollStudent(Guid id, [FromBody] EnrollStudentRequest request)
    {
        var result = await _classroomService.EnrollStudentAsync(id, request.StudentId);

        if (!result)
            return Conflict(new ApiResponse<bool>(false, false, "Student already enrolled or classroom not found"));

        return Ok(new ApiResponse<bool>(true, true, "Student enrolled successfully"));
    }

    [HttpPost("{id}/enroll-bulk")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> EnrollStudentsBulk(Guid id, [FromBody] BulkEnrollRequest request)
    {
        var result = await _classroomService.EnrollStudentsBulkAsync(id, request.StudentIds);
        return Ok(new ApiResponse<bool>(true, result, "Students enrolled successfully"));
    }

    [HttpDelete("{id}/enroll/{studentId}")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> UnenrollStudent(Guid id, Guid studentId)
    {
        var result = await _classroomService.UnenrollStudentAsync(id, studentId);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Enrollment not found"));

        return Ok(new ApiResponse<bool>(true, true, "Student unenrolled successfully"));
    }

    [HttpGet("{id}/enrollments")]
    public async Task<ActionResult<ApiResponse<List<EnrollmentDto>>>> GetEnrollments(Guid id)
    {
        var result = await _classroomService.GetEnrollmentsAsync(id);
        return Ok(new ApiResponse<List<EnrollmentDto>>(true, result));
    }

    // Session endpoints
    [HttpPost("{id}/sessions")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<ClassSessionDto>>> CreateSession(Guid id, [FromBody] CreateSessionRequest request)
    {
        var result = await _sessionService.CreateSessionAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<ClassSessionDto>(false, null, "Classroom not found"));

        return Ok(new ApiResponse<ClassSessionDto>(true, result, "Session created successfully"));
    }

    [HttpGet("{id}/sessions")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetSessions(Guid id)
    {
        var result = await _sessionService.GetClassroomSessionsAsync(id);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/upcoming")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetUpcomingSessions()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _sessionService.GetUpcomingSessionsAsync(userId);
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpGet("sessions/live")]
    public async Task<ActionResult<ApiResponse<List<ClassSessionDto>>>> GetLiveSessions()
    {
        var result = await _sessionService.GetLiveSessionsAsync();
        return Ok(new ApiResponse<List<ClassSessionDto>>(true, result));
    }

    [HttpPost("sessions/{sessionId}/start")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> StartSession(Guid sessionId)
    {
        var result = await _sessionService.StartSessionAsync(sessionId);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot start session"));

        return Ok(new ApiResponse<bool>(true, true, "Session started"));
    }

    [HttpPost("sessions/{sessionId}/end")]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<bool>>> EndSession(Guid sessionId)
    {
        var result = await _sessionService.EndSessionAsync(sessionId);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Cannot end session"));

        return Ok(new ApiResponse<bool>(true, true, "Session ended"));
    }
}
