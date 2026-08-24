using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using Shared.Models;
using UserService.Services;

namespace UserService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserManagementService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserManagementService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var result = await _userService.GetUserAsync(Caller.UserId, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result));
    }

    /// <summary>
    /// The public profile of any user. Previously this endpoint returned the full record, so every
    /// authenticated user could read anyone's e-mail address and phone number by guessing an id.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PublicUserDto>>> GetUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.GetPublicUserAsync(id, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<PublicUserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<PublicUserDto>(true, result));
    }

    /// <summary>The full record, including contact details. Administrators only; use "me" for yourself.</summary>
    [HttpGet("{id}/details")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetUserDetails(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.GetUserAsync(id, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result));
    }

    [HttpGet]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<PagedResponse<UserDto>>>> GetUsers(
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        UserRole? userRole = null;
        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, ignoreCase: true, out var r))
            userRole = r;

        var result = await _userService.GetUsersAsync(userRole, new PagedRequest(page, pageSize), cancellationToken);
        return Ok(new ApiResponse<PagedResponse<UserDto>>(true, result));
    }

    [HttpPut("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateCurrentUser([FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserAsync(Caller.UserId, request, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result, "Profile updated successfully"));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserAsync(id, request, cancellationToken);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result, "User updated successfully"));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateUserRole(Guid id, [FromBody] UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserRoleAsync(id, request, Caller, cancellationToken);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Failed to update role"));

        return Ok(new ApiResponse<bool>(true, true, "Role updated successfully"));
    }

    [HttpPost("{id}/deactivate")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<bool>>> DeactivateUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.SetUserActiveAsync(id, isActive: false, Caller, cancellationToken);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "User could not be deactivated"));

        return Ok(new ApiResponse<bool>(true, true, "User deactivated"));
    }

    [HttpPost("{id}/activate")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<bool>>> ActivateUser(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.SetUserActiveAsync(id, isActive: true, Caller, cancellationToken);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "User could not be activated"));

        return Ok(new ApiResponse<bool>(true, true, "User activated"));
    }

    /// <summary>
    /// Used by instructors to find students to enrol. Restricted to content managers so students cannot
    /// enumerate the user directory.
    /// </summary>
    [HttpGet("search")]
    [Authorize(Roles = UserRoles.ContentManagers)]
    public async Task<ActionResult<ApiResponse<List<PublicUserDto>>>> SearchUsers(
        [FromQuery] string q,
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _userService.SearchUsersAsync(q, limit, cancellationToken);
        return Ok(new ApiResponse<List<PublicUserDto>>(true, result));
    }

    [HttpGet("stats")]
    [Authorize(Roles = UserRoles.Administrators)]
    public async Task<ActionResult<ApiResponse<Dictionary<UserRole, int>>>> GetStats(CancellationToken cancellationToken)
    {
        var result = await _userService.GetUserStatsAsync(cancellationToken);
        return Ok(new ApiResponse<Dictionary<UserRole, int>>(true, result));
    }

    [HttpGet("me/export")]
    public async Task<IActionResult> ExportMe(CancellationToken cancellationToken)
    {
        var result = await _userService.ExportUserAsync(Caller.UserId, cancellationToken);
        if (result is null)
        {
            return NotFound();
        }

        return File(
            System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(result),
            "application/json",
            "eduplatform-verilerim.json");
    }

    [HttpDelete("me")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteMe(CancellationToken cancellationToken)
    {
        var ok = await _userService.DeleteOwnAccountAsync(Caller.UserId, cancellationToken);
        return Ok(new ApiResponse<bool>(ok, ok, ok ? "Hesap silindi" : "Hesap silinemedi"));
    }
}
