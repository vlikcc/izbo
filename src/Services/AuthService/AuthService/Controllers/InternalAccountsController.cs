using AuthService.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Internal;
using Shared.Models;

namespace AuthService.Controllers;

/// <summary>
/// Service-to-service endpoints, reachable only from inside the docker network — the gateway defines no
/// route to /api/internal. This is how UserService's admin directory reaches the IsActive flag that
/// actually gates login; without it, disabling an account there had no effect on access.
/// </summary>
[ApiController]
[Route("api/internal")]
[InternalOnly]
public class InternalAccountsController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly INationalIdAuthService _nationalId;

    public InternalAccountsController(IAuthService authService, INationalIdAuthService nationalId)
    {
        _authService = authService;
        _nationalId = nationalId;
    }

    /// <summary>
    /// Gives an account its T.C. Kimlik No (school import or admin directory). The number is validated,
    /// stored encrypted and is never echoed back.
    /// </summary>
    [HttpPut("accounts/{id}/national-id")]
    public async Task<ActionResult<ApiResponse<bool>>> AssignNationalId(
        Guid id,
        [FromBody] AssignNationalIdRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        return await _nationalId.AssignAsync(id, request.NationalId, cancellationToken) switch
        {
            NationalIdAssignmentStatus.Updated => Ok(new ApiResponse<bool>(true, true, "National id assigned")),
            NationalIdAssignmentStatus.InvalidNumber => BadRequest(new ApiResponse<bool>(false, false, "Invalid national id")),
            NationalIdAssignmentStatus.UserNotFound => NotFound(new ApiResponse<bool>(false, false, "Account not found")),
            NationalIdAssignmentStatus.InUse => Conflict(new ApiResponse<bool>(false, false, "National id already in use")),
            _ => StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiResponse<bool>(false, false, "National id keys are not configured"))
        };
    }

    [HttpPost("accounts/{id}/active")]
    public async Task<ActionResult<ApiResponse<bool>>> SetAccountActive(
        Guid id,
        [FromBody] AccountActiveRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var updated = await _authService.SetAccountActiveAsync(id, request.IsActive, cancellationToken);

        if (!updated)
        {
            return NotFound(new ApiResponse<bool>(false, false, "Account not found"));
        }

        return Ok(new ApiResponse<bool>(true, true, "Account state updated"));
    }

    [HttpPut("accounts/{id}/identity")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateAccountIdentity(
        Guid id,
        [FromBody] AccountIdentityRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var updated = await _authService.UpdateAccountIdentityAsync(id, request, cancellationToken);

        if (!updated)
        {
            return NotFound(new ApiResponse<bool>(false, false, "Account not found"));
        }

        return Ok(new ApiResponse<bool>(true, true, "Account identity updated"));
    }

    [HttpPut("accounts/{id}/role")]
    public async Task<ActionResult<ApiResponse<bool>>> SetAccountRole(
        Guid id,
        [FromBody] AccountRoleRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role) || !Enum.IsDefined(role))
        {
            return BadRequest(new ApiResponse<bool>(false, false, "Unknown role"));
        }

        var updated = await _authService.SetAccountRoleAsync(id, role, cancellationToken);

        return updated
            ? Ok(new ApiResponse<bool>(true, true, "Account role updated"))
            : NotFound(new ApiResponse<bool>(false, false, "Account not found"));
    }

    [HttpPost("accounts/{id}/password")]
    public async Task<ActionResult<ApiResponse<bool>>> SetAccountPassword(
        Guid id,
        [FromBody] AccountPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var updated = await _authService.SetAccountPasswordAsync(id, request.Password, cancellationToken);

        return updated
            ? Ok(new ApiResponse<bool>(true, true, "Password updated"))
            : NotFound(new ApiResponse<bool>(false, false, "Account not found or password rejected"));
    }

    /// <summary>Opens a user-name student account on behalf of a parent. 409 when the name is taken.</summary>
    [HttpPost("accounts")]
    public async Task<ActionResult<CreatedAccountDto>> CreateChildAccount(
        [FromBody] CreateChildAccountRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        User? user;
        try
        {
            user = await _authService.CreateChildAccountAsync(request, cancellationToken);
        }
        catch (ArgumentException)
        {
            return BadRequest();
        }

        if (user is null)
        {
            return Conflict();
        }

        return Ok(new CreatedAccountDto(user.Id, user.Username!));
    }
}
