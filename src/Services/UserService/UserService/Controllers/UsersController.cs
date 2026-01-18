using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Models;
using System.Security.Claims;
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

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetCurrentUser()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _userService.GetUserAsync(userId);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetUser(Guid id)
    {
        var result = await _userService.GetUserAsync(id);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result));
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<PagedResponse<UserDto>>>> GetUsers(
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        UserRole? userRole = null;
        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, out var r))
            userRole = r;

        var result = await _userService.GetUsersAsync(userRole, new PagedRequest(page, pageSize));
        return Ok(new ApiResponse<PagedResponse<UserDto>>(true, result));
    }

    [HttpPut("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateCurrentUser([FromBody] UpdateUserRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _userService.UpdateUserAsync(userId, request);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result, "Profile updated successfully"));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var result = await _userService.UpdateUserAsync(id, request);

        if (result == null)
            return NotFound(new ApiResponse<UserDto>(false, null, "User not found"));

        return Ok(new ApiResponse<UserDto>(true, result, "User updated successfully"));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateUserRole(Guid id, [FromBody] UpdateRoleRequest request)
    {
        var result = await _userService.UpdateUserRoleAsync(id, request);

        if (!result)
            return BadRequest(new ApiResponse<bool>(false, false, "Failed to update role"));

        return Ok(new ApiResponse<bool>(true, true, "Role updated successfully"));
    }

    [HttpPost("{id}/deactivate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeactivateUser(Guid id)
    {
        var result = await _userService.DeactivateUserAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "User not found"));

        return Ok(new ApiResponse<bool>(true, true, "User deactivated"));
    }

    [HttpPost("{id}/activate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ActivateUser(Guid id)
    {
        var result = await _userService.ActivateUserAsync(id);

        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "User not found"));

        return Ok(new ApiResponse<bool>(true, true, "User activated"));
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> SearchUsers([FromQuery] string q, [FromQuery] int limit = 20)
    {
        var result = await _userService.SearchUsersAsync(q, limit);
        return Ok(new ApiResponse<List<UserDto>>(true, result));
    }

    [HttpGet("stats")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Dictionary<UserRole, int>>>> GetStats()
    {
        var result = await _userService.GetUserStatsAsync();
        return Ok(new ApiResponse<Dictionary<UserRole, int>>(true, result));
    }
}
