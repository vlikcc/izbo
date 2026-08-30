using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using SubscriptionService.Services;
using System.Security.Claims;

namespace SubscriptionService.Controllers;

/// <summary>Service-to-service endpoints. Not exposed through the API gateway — reachable only from
/// inside the docker network. Auth still applies: the caller forwards the original user's Bearer
/// token as-is (see Shared/Subscription/EntitlementClient), so the subscriber is always resolved
/// from that token's own claims, never from a value the calling service could spoof.</summary>
[ApiController]
[Route("api/internal")]
[Authorize]
public class InternalController : ControllerBase
{
    private readonly ISubscriptionManagementService _subscriptionService;

    public InternalController(ISubscriptionManagementService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("entitlements")]
    public async Task<ActionResult<ApiResponse<EntitlementsDto>>> GetEntitlements()
    {
        var result = await _subscriptionService.GetEntitlementsAsync(UserId);
        return Ok(new ApiResponse<EntitlementsDto>(true, result));
    }

    [HttpPost("usage/consume")]
    public async Task<ActionResult<ApiResponse<ConsumeUsageResultDto>>> ConsumeUsage([FromBody] ConsumeUsageRequest request)
    {
        var result = await _subscriptionService.ConsumeUsageAsync(UserId, request);
        return Ok(new ApiResponse<ConsumeUsageResultDto>(true, result));
    }

    [HttpPost("usage/release")]
    public async Task<ActionResult<ApiResponse<bool>>> ReleaseUsage([FromBody] ConsumeUsageRequest request)
    {
        await _subscriptionService.ReleaseUsageAsync(UserId, request);
        return Ok(new ApiResponse<bool>(true, true));
    }
}
