using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using UserService.Services.Promotion;

namespace UserService.Controllers;

/// <summary>Moving every student up a grade at the end of the school year. Runs on its own each August.</summary>
[ApiController]
[Route("api/users/admin/promotion")]
[Authorize(Roles = UserRoles.Administrators)]
public class PromotionController : ControllerBase
{
    private readonly IGradePromotionService _promotion;
    private readonly TimeProvider _clock;

    public PromotionController(IGradePromotionService promotion, TimeProvider clock)
    {
        _promotion = promotion;
        _clock = clock;
    }

    /// <summary>
    /// Runs this year's promotion now (or counts it with <c>dryRun=true</c>). A year already run is not repeated
    /// unless <c>force=true</c>.
    /// </summary>
    [HttpPost("run")]
    public async Task<ActionResult<ApiResponse<PromotionResult>>> Run(
        [FromQuery] bool dryRun = true,
        [FromQuery] bool force = false,
        [FromQuery] int? year = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _promotion.RunAsync(
            year ?? PromotionRules.IstanbulYear(_clock.GetUtcNow().UtcDateTime),
            dryRun,
            User.GetCaller().UserId,
            force,
            cancellationToken);

        var message = dryRun ? "Önizleme" : result.AlreadyRan ? "Bu yıl zaten çalıştırıldı" : "Sınıflar yükseltildi";
        return Ok(new ApiResponse<PromotionResult>(true, result, message));
    }
}
