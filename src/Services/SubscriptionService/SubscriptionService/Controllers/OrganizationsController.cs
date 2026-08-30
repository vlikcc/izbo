using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using SubscriptionService.Services;
using System.Security.Claims;

namespace SubscriptionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizationsController : ControllerBase
{
    private readonly IOrganizationService _organizationService;

    public OrganizationsController(IOrganizationService organizationService)
    {
        _organizationService = organizationService;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    [Authorize(Roles = "Instructor,Admin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<OrganizationDto>>> Create([FromBody] CreateOrganizationRequest request)
    {
        var result = await _organizationService.CreateAsync(UserId, request);
        return Ok(new ApiResponse<OrganizationDto>(true, result, "Kurum oluşturuldu, 14 günlük deneme başladı"));
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<OrganizationDto>>> GetMyOrganization()
    {
        var result = await _organizationService.GetMyOrganizationAsync(UserId);
        if (result == null)
            return NotFound(new ApiResponse<OrganizationDto>(false, null, "Bir kuruma üye değilsiniz"));

        return Ok(new ApiResponse<OrganizationDto>(true, result));
    }

    [HttpPost("{id}/members")]
    public async Task<ActionResult<ApiResponse<OrganizationMemberDto>>> AddMember(Guid id, [FromBody] AddOrganizationMemberRequest request)
    {
        try
        {
            var result = await _organizationService.AddMemberAsync(id, UserId, request);
            return Ok(new ApiResponse<OrganizationMemberDto>(true, result, "Üye eklendi"));
        }
        catch (OrganizationNotFoundException ex)
        {
            return NotFound(new ApiResponse<OrganizationMemberDto>(false, null, ex.Message));
        }
        catch (NotOrganizationAdminException)
        {
            return Forbid();
        }
        catch (SeatLimitExceededException ex)
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new ApiResponse<OrganizationMemberDto>(
                false, null, ex.Message, new List<string> { "SEAT_LIMIT_EXCEEDED" }));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<OrganizationMemberDto>(false, null, ex.Message));
        }
    }

    [HttpDelete("{id}/members/{userId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveMember(Guid id, Guid userId)
    {
        try
        {
            await _organizationService.RemoveMemberAsync(id, UserId, userId);
            return Ok(new ApiResponse<bool>(true, true, "Üye çıkarıldı"));
        }
        catch (OrganizationNotFoundException ex)
        {
            return NotFound(new ApiResponse<bool>(false, false, ex.Message));
        }
        catch (NotOrganizationAdminException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<bool>(false, false, ex.Message));
        }
    }
}
