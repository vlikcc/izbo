using ClassroomService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;

namespace ClassroomService.Controllers;

[ApiController]
[Route("api/classrooms/{classroomId:guid}")]
[Authorize]
public class ClassroomCommunityController : ControllerBase
{
    private readonly IClassroomCommunityService _community;

    public ClassroomCommunityController(IClassroomCommunityService community)
    {
        _community = community;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("announcements")]
    public async Task<ActionResult<ApiResponse<List<AnnouncementDto>>>> ListAnnouncements(Guid classroomId, CancellationToken cancellationToken)
    {
        var result = await _community.ListAnnouncementsAsync(classroomId, Caller, cancellationToken);
        if (result is null)
        {
            return NotFound(new ApiResponse<List<AnnouncementDto>>(false, null, "Classroom not found"));
        }

        return Ok(new ApiResponse<List<AnnouncementDto>>(true, result));
    }

    [HttpPost("announcements")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<AnnouncementDto>>> CreateAnnouncement(
        Guid classroomId,
        [FromBody] CreateAnnouncementRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _community.CreateAnnouncementAsync(classroomId, request, Caller, cancellationToken);
        if (result is null)
        {
            return Forbid();
        }

        return Ok(new ApiResponse<AnnouncementDto>(true, result, "Announcement published"));
    }

    [HttpDelete("announcements/{announcementId:guid}")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAnnouncement(
        Guid classroomId,
        Guid announcementId,
        CancellationToken cancellationToken)
    {
        var ok = await _community.DeleteAnnouncementAsync(classroomId, announcementId, Caller, cancellationToken);
        if (!ok)
        {
            return NotFound(new ApiResponse<bool>(false, false, "Announcement not found"));
        }

        return Ok(new ApiResponse<bool>(true, true, "Announcement deleted"));
    }

    [HttpGet("comments")]
    public async Task<ActionResult<ApiResponse<List<ClassroomCommentDto>>>> ListComments(
        Guid classroomId,
        [FromQuery] string targetType,
        [FromQuery] Guid targetId,
        CancellationToken cancellationToken)
    {
        var result = await _community.ListCommentsAsync(classroomId, targetType, targetId, Caller, cancellationToken);
        if (result is null)
        {
            return NotFound(new ApiResponse<List<ClassroomCommentDto>>(false, null, "Classroom not found"));
        }

        return Ok(new ApiResponse<List<ClassroomCommentDto>>(true, result));
    }

    [HttpPost("comments")]
    public async Task<ActionResult<ApiResponse<ClassroomCommentDto>>> AddComment(
        Guid classroomId,
        [FromBody] CreateCommentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _community.AddCommentAsync(classroomId, request, Caller, cancellationToken);
        if (result is null)
        {
            return Forbid();
        }

        return Ok(new ApiResponse<ClassroomCommentDto>(true, result));
    }
}

[ApiController]
[Route("api/classrooms/sessions/{sessionId:guid}/attendance")]
[Authorize(Roles = UserRoles.ContentManagers)]
public class AttendanceController : ControllerBase
{
    private readonly IClassroomCommunityService _community;

    public AttendanceController(IClassroomCommunityService community)
    {
        _community = community;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<AttendanceRecordDto>>>> Get(Guid sessionId, CancellationToken cancellationToken)
    {
        var result = await _community.ListAttendanceAsync(sessionId, User.GetCaller(), cancellationToken);
        if (result is null)
        {
            return NotFound(new ApiResponse<List<AttendanceRecordDto>>(false, null, "Attendance not available"));
        }

        return Ok(new ApiResponse<List<AttendanceRecordDto>>(true, result));
    }
}
