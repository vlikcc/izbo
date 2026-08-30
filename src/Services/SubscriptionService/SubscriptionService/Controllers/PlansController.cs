using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using SubscriptionService.Services;

namespace SubscriptionService.Controllers;

/// <summary>Public plan catalog — no auth required, used by the pricing page.</summary>
[ApiController]
[Route("api/[controller]")]
public class PlansController : ControllerBase
{
    private readonly ISubscriptionManagementService _subscriptionService;

    public PlansController(ISubscriptionManagementService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlanDto>>>> GetPlans()
    {
        var plans = await _subscriptionService.GetPlansAsync();
        return Ok(new ApiResponse<List<PlanDto>>(true, plans));
    }
}
