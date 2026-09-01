using AuthService.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Internal;

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

    public InternalAccountsController(IAuthService authService)
    {
        _authService = authService;
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
}
