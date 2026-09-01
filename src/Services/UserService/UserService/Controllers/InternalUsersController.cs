using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Internal;
using UserService.Services;

namespace UserService.Controllers;

/// <summary>
/// Service-to-service endpoints, reachable only from inside the docker network — the gateway defines no
/// route to /api/internal. Registration happens with nobody signed in, so these authenticate with the
/// shared internal key rather than a Bearer token.
/// </summary>
[ApiController]
[Route("api/internal")]
[InternalOnly]
public class InternalUsersController : ControllerBase
{
    private readonly IUserManagementService _userService;

    public InternalUsersController(IUserManagementService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// Creates or refreshes the profile mirroring an AuthService account. Idempotent so AuthService can
    /// call it on every login to backfill accounts that predate this sync.
    /// </summary>
    [HttpPost("users")]
    public async Task<ActionResult<ApiResponse<bool>>> UpsertProfile(
        [FromBody] AccountProfileSync profile,
        CancellationToken cancellationToken)
    {
        var result = await _userService.UpsertProfileAsync(profile, cancellationToken);
        return Ok(new ApiResponse<bool>(true, result, "Profile synchronised"));
    }
}
