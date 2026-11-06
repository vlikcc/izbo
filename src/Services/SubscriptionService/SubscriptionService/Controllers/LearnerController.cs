using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using SubscriptionService.Services.Learner;

namespace SubscriptionService.Controllers;

/// <summary>
/// Student packages: the public catalogue, a student's current package, trials and bank-transfer orders.
/// A parent acts for a linked child, a student for themself, an administrator for anyone; everyone else
/// gets 404 so student ids cannot be probed.
/// </summary>
[ApiController]
[Route("api/learner")]
[Authorize]
public class LearnerController : ControllerBase
{
    private readonly ILearnerPackageService _packages;
    private readonly IGuardianAccessClient _guardianAccess;

    public LearnerController(ILearnerPackageService packages, IGuardianAccessClient guardianAccess)
    {
        _packages = packages;
        _guardianAccess = guardianAccess;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("packages")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<LearnerPackageDto>>>> Packages(CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "public, max-age=300";
        return Ok(new ApiResponse<List<LearnerPackageDto>>(true, await _packages.GetCatalogAsync(includeInactive: false, cancellationToken)));
    }

    [HttpGet("access/me")]
    public async Task<ActionResult<ApiResponse<LearnerAccessDto>>> MyAccess(CancellationToken cancellationToken) =>
        Ok(new ApiResponse<LearnerAccessDto>(true, await _packages.GetAccessAsync(Caller.UserId, cancellationToken)));

    [HttpGet("access/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<LearnerAccessDto>>> Access(Guid studentId, CancellationToken cancellationToken)
    {
        if (!await CanActForAsync(studentId, cancellationToken))
        {
            return NotFound(new ApiResponse<LearnerAccessDto>(false, null, "Student not found"));
        }

        return Ok(new ApiResponse<LearnerAccessDto>(true, await _packages.GetAccessAsync(studentId, cancellationToken)));
    }

    [HttpGet("passes/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<List<LearnerPassDto>>>> Passes(Guid studentId, CancellationToken cancellationToken)
    {
        if (!await CanActForAsync(studentId, cancellationToken))
        {
            return NotFound(new ApiResponse<List<LearnerPassDto>>(false, null, "Student not found"));
        }

        return Ok(new ApiResponse<List<LearnerPassDto>>(true, await _packages.GetPassesAsync(studentId, cancellationToken)));
    }

    [HttpPost("trial")]
    public async Task<ActionResult<ApiResponse<LearnerAccessDto>>> StartTrial([FromBody] StartLearnerTrialRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!await CanActForAsync(request.StudentId, cancellationToken))
        {
            return NotFound(new ApiResponse<LearnerAccessDto>(false, null, "Student not found"));
        }

        return (await _packages.StartTrialAsync(request.StudentId, Caller.UserId, cancellationToken)).ToActionResult(this, "Deneme başladı");
    }

    [HttpPost("orders")]
    public async Task<ActionResult<ApiResponse<LearnerOrderDto>>> CreateOrder([FromBody] CreateLearnerOrderRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!await CanActForAsync(request.StudentId, cancellationToken))
        {
            return NotFound(new ApiResponse<LearnerOrderDto>(false, null, "Student not found"));
        }

        var payer = new PaymentBuyer(
            Caller.UserId,
            User.FindFirst("given_name")?.Value,
            User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value,
            HttpContext.Connection.RemoteIpAddress?.ToString());
        return (await _packages.CreateOrderAsync(request, payer, cancellationToken)).ToActionResult(this, "Sipariş oluşturuldu");
    }

    [HttpPost("orders/{id:guid}/paid-notice")]
    public async Task<ActionResult<ApiResponse<LearnerOrderDto>>> PaidNotice(Guid id, [FromBody] LearnerPaidNoticeRequest request, CancellationToken cancellationToken) =>
        (await _packages.NotifyPaidAsync(id, Caller.UserId, request?.Note, cancellationToken)).ToActionResult(this, "Ödeme bildirimi alındı");

    [HttpPost("orders/{id:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<LearnerOrderDto>>> Cancel(Guid id, CancellationToken cancellationToken) =>
        (await _packages.CancelOrderAsync(id, Caller.UserId, cancellationToken)).ToActionResult(this, "Sipariş iptal edildi");

    [HttpGet("orders/mine")]
    public async Task<ActionResult<ApiResponse<List<LearnerOrderDto>>>> MyOrders(CancellationToken cancellationToken) =>
        Ok(new ApiResponse<List<LearnerOrderDto>>(true, await _packages.GetOrdersByPayerAsync(Caller.UserId, cancellationToken)));

    [HttpGet("orders/student/{studentId:guid}")]
    public async Task<ActionResult<ApiResponse<List<LearnerOrderDto>>>> StudentOrders(Guid studentId, CancellationToken cancellationToken)
    {
        if (!await CanActForAsync(studentId, cancellationToken))
        {
            return NotFound(new ApiResponse<List<LearnerOrderDto>>(false, null, "Student not found"));
        }

        return Ok(new ApiResponse<List<LearnerOrderDto>>(true, await _packages.GetOrdersForStudentAsync(studentId, cancellationToken)));
    }

    /// <summary>The student themself, a linked parent, or an administrator. Teachers do not buy packages for students.</summary>
    private async Task<bool> CanActForAsync(Guid studentId, CancellationToken cancellationToken)
    {
        var caller = Caller;
        if (caller.UserId == studentId && !caller.IsStudent && !caller.IsPlatformAdmin)
        {
            return false;
        }

        return studentId != Guid.Empty && await _guardianAccess.CanViewStudentAsync(studentId, caller, cancellationToken);
    }
}

/// <summary>Student package administration: bank-transfer approvals, manual grants, the catalogue.</summary>
[ApiController]
[Route("api/learner/admin")]
[Authorize(Roles = UserRoles.Administrators)]
public class LearnerAdminController : ControllerBase
{
    private readonly ILearnerPackageService _packages;

    public LearnerAdminController(ILearnerPackageService packages) => _packages = packages;

    private Caller Caller => User.GetCaller();

    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<PagedResponse<LearnerOrderDto>>>> Orders(
        [FromQuery] Shared.Models.LearnerOrderStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) =>
        Ok(new ApiResponse<PagedResponse<LearnerOrderDto>>(true,
            await _packages.AdminListOrdersAsync(status, new PagedRequest(page, pageSize), cancellationToken)));

    [HttpPost("orders/{id:guid}/approve")]
    public async Task<ActionResult<ApiResponse<LearnerOrderDto>>> Approve(Guid id, CancellationToken cancellationToken) =>
        (await _packages.ApproveAsync(id, Caller.UserId, cancellationToken)).ToActionResult(this, "Ödeme onaylandı, paket tanımlandı");

    [HttpPost("orders/{id:guid}/reject")]
    public async Task<ActionResult<ApiResponse<LearnerOrderDto>>> Reject(Guid id, [FromBody] RejectLearnerOrderRequest request, CancellationToken cancellationToken) =>
        (await _packages.RejectAsync(id, Caller.UserId, request?.Reason ?? string.Empty, cancellationToken)).ToActionResult(this, "Sipariş reddedildi");

    [HttpPost("passes")]
    public async Task<ActionResult<ApiResponse<LearnerPassDto>>> Grant([FromBody] GrantLearnerPassRequest request, CancellationToken cancellationToken) =>
        (await _packages.GrantAsync(request, Caller.UserId, cancellationToken)).ToActionResult(this, "Paket tanımlandı");

    [HttpGet("packages")]
    public async Task<ActionResult<ApiResponse<List<LearnerPackageDto>>>> Packages(CancellationToken cancellationToken) =>
        Ok(new ApiResponse<List<LearnerPackageDto>>(true, await _packages.GetCatalogAsync(includeInactive: true, cancellationToken)));

    [HttpPut("packages/{code}")]
    public async Task<ActionResult<ApiResponse<LearnerPackageDto>>> UpdatePackage(string code, [FromBody] UpdateLearnerPackageRequest request, CancellationToken cancellationToken) =>
        (await _packages.UpdatePackageAsync(code, request, cancellationToken)).ToActionResult(this, "Paket güncellendi");

    [HttpPut("packages/{code}/prices")]
    public async Task<ActionResult<ApiResponse<LearnerPackageDto>>> SetPrices(string code, [FromBody] SetLearnerPricesRequest request, CancellationToken cancellationToken) =>
        (await _packages.SetPricesAsync(code, request, cancellationToken)).ToActionResult(this, "Fiyatlar güncellendi");
}

internal static class LearnerResultExtensions
{
    public static ActionResult<ApiResponse<T>> ToActionResult<T>(this LearnerResult<T> result, ControllerBase controller, string? successMessage = null)
    {
        var body = new ApiResponse<T>(result.IsOk, result.Value, result.IsOk ? successMessage : result.Error);
        return result.Status switch
        {
            LearnerResultStatus.Ok => controller.Ok(body),
            LearnerResultStatus.NotFound => controller.NotFound(body),
            LearnerResultStatus.Conflict => controller.Conflict(body),
            _ => controller.BadRequest(body)
        };
    }
}
