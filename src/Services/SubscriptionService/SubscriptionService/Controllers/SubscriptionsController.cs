using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using SubscriptionService.Services;
using System.Security.Claims;

namespace SubscriptionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionManagementService _subscriptionService;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(ISubscriptionManagementService subscriptionService, ILogger<SubscriptionsController> logger)
    {
        _subscriptionService = subscriptionService;
        _logger = logger;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto>>> GetMySubscription()
    {
        var result = await _subscriptionService.GetMySubscriptionAsync(UserId);
        return Ok(new ApiResponse<SubscriptionDto>(true, result));
    }

    [HttpPost("me/trial")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto>>> StartTrial()
    {
        try
        {
            var result = await _subscriptionService.StartTrialAsync(UserId);
            return Ok(new ApiResponse<SubscriptionDto>(true, result, "Deneme süreniz başladı"));
        }
        catch (TrialAlreadyUsedException ex)
        {
            return BadRequest(new ApiResponse<SubscriptionDto>(false, null, ex.Message));
        }
    }

    [HttpPost("me/checkout")]
    public async Task<ActionResult<ApiResponse<CheckoutResultDto>>> Checkout([FromBody] CheckoutRequest request)
    {
        try
        {
            var result = await _subscriptionService.CreateCheckoutAsync(UserId, request);
            return Ok(new ApiResponse<CheckoutResultDto>(true, result));
        }
        catch (PlanNotFoundException ex)
        {
            return NotFound(new ApiResponse<CheckoutResultDto>(false, null, ex.Message));
        }
    }

    [HttpPost("me/cancel")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto>>> Cancel()
    {
        var result = await _subscriptionService.CancelAsync(UserId);
        return Ok(new ApiResponse<SubscriptionDto>(true, result, "Aboneliğiniz dönem sonunda sona erecek"));
    }
}
