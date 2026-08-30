using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using Shared.Models;
using SubscriptionService.Services;

namespace SubscriptionService.Controllers;

// Note: role check is "Admin,SuperAdmin" everywhere here — UserService's equivalent controller only
// checks "Admin" and locks out the seeded SuperAdmin account; that inconsistency is not repeated here.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class AdminController : ControllerBase
{
    private readonly ISubscriptionManagementService _subscriptionService;

    public AdminController(ISubscriptionManagementService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    [HttpGet("subscriptions")]
    public async Task<ActionResult<ApiResponse<List<AdminSubscriptionDto>>>> ListSubscriptions()
    {
        var result = await _subscriptionService.AdminListSubscriptionsAsync();
        return Ok(new ApiResponse<List<AdminSubscriptionDto>>(true, result));
    }

    [HttpPut("subscriptions/{type}/{subscriberId}")]
    public async Task<ActionResult<ApiResponse<AdminSubscriptionDto>>> AssignPlan(
        SubscriberType type, Guid subscriberId, [FromBody] AdminAssignPlanRequest request)
    {
        try
        {
            var result = await _subscriptionService.AdminAssignPlanAsync(type, subscriberId, request);
            return Ok(new ApiResponse<AdminSubscriptionDto>(true, result, "Plan güncellendi"));
        }
        catch (PlanNotFoundException ex)
        {
            return NotFound(new ApiResponse<AdminSubscriptionDto>(false, null, ex.Message));
        }
    }

    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<List<AdminOrderDto>>>> ListOrders()
    {
        var result = await _subscriptionService.AdminListOrdersAsync();
        return Ok(new ApiResponse<List<AdminOrderDto>>(true, result));
    }

    [HttpPost("orders/{orderId}/mark-paid")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkOrderPaid(Guid orderId)
    {
        var result = await _subscriptionService.AdminMarkOrderPaidAsync(orderId);
        if (!result)
            return NotFound(new ApiResponse<bool>(false, false, "Sipariş bulunamadı"));

        return Ok(new ApiResponse<bool>(true, true, "Sipariş ödendi olarak işaretlendi"));
    }
}
