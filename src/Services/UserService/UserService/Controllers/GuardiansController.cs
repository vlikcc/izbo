using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Authorization;
using Shared.DTOs;
using UserService.Services;

namespace UserService.Controllers;

/// <summary>Parent (veli) ↔ student links: opening child accounts, link codes, and the guardianship check.</summary>
[ApiController]
[Route("api/users")]
[Authorize]
public class GuardiansController : ControllerBase
{
    private readonly IGuardianService _guardians;

    public GuardiansController(IGuardianService guardians)
    {
        _guardians = guardians;
    }

    private Caller Caller => User.GetCaller();

    [HttpGet("me/children")]
    [Authorize(Roles = UserRoles.Parent)]
    public async Task<ActionResult<ApiResponse<List<ChildDto>>>> GetChildren(CancellationToken cancellationToken)
    {
        var children = await _guardians.GetChildrenAsync(Caller.UserId, cancellationToken);
        return Ok(new ApiResponse<List<ChildDto>>(true, children));
    }

    [HttpPost("me/children")]
    [Authorize(Roles = UserRoles.Parent)]
    public async Task<ActionResult<ApiResponse<ChildDto>>> CreateChild(
        [FromBody] CreateChildRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _guardians.CreateChildAsync(Caller.UserId, request, cancellationToken);

        return result.Outcome switch
        {
            CreateChildOutcome.Created =>
                Ok(new ApiResponse<ChildDto>(true, result.Child, "Çocuk hesabı oluşturuldu")),
            CreateChildOutcome.UsernameTaken =>
                Conflict(new ApiResponse<ChildDto>(false, null, "Bu kullanıcı adı alınmış, lütfen başka bir ad seçin")),
            CreateChildOutcome.TooManyChildren =>
                BadRequest(new ApiResponse<ChildDto>(false, null, $"En fazla {GuardianService.MaxChildrenPerParent} çocuk hesabı bağlanabilir")),
            _ => StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiResponse<ChildDto>(false, null, "Kimlik servisine ulaşılamadı; hesap oluşturulmadı. Lütfen tekrar deneyin."))
        };
    }

    [HttpPost("me/children/link")]
    [Authorize(Roles = UserRoles.Parent)]
    public async Task<ActionResult<ApiResponse<ChildDto>>> LinkChild(
        [FromBody] LinkChildRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var result = await _guardians.LinkChildAsync(Caller.UserId, request.Code, cancellationToken);

        return result.Outcome switch
        {
            LinkChildOutcome.Linked => Ok(new ApiResponse<ChildDto>(true, result.Child, "Öğrenci hesabınıza bağlandı")),
            LinkChildOutcome.AlreadyLinked => Ok(new ApiResponse<ChildDto>(true, result.Child, "Bu öğrenci zaten bağlı")),
            LinkChildOutcome.TooManyChildren =>
                BadRequest(new ApiResponse<ChildDto>(false, null, $"En fazla {GuardianService.MaxChildrenPerParent} çocuk hesabı bağlanabilir")),
            _ => NotFound(new ApiResponse<ChildDto>(false, null, "Kod geçersiz veya süresi dolmuş"))
        };
    }

    [HttpPost("me/children/{id}/password")]
    [Authorize(Roles = UserRoles.Parent)]
    public async Task<ActionResult<ApiResponse<bool>>> ResetChildPassword(
        Guid id,
        [FromBody] ResetChildPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var outcome = await _guardians.ResetChildPasswordAsync(Caller.UserId, id, request.Password, cancellationToken);

        return outcome switch
        {
            ResetChildPasswordOutcome.Updated => Ok(new ApiResponse<bool>(true, true, "Şifre güncellendi")),
            ResetChildPasswordOutcome.NotAllowed => StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<bool>(
                false, false, "Yalnızca sizin açtığınız kullanıcı adlı hesapların şifresini sıfırlayabilirsiniz")),
            _ => StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiResponse<bool>(
                false, false, "Kimlik servisine ulaşılamadı; şifre değiştirilmedi. Lütfen tekrar deneyin."))
        };
    }

    [HttpDelete("me/children/{id}")]
    [Authorize(Roles = UserRoles.Parent)]
    public async Task<ActionResult<ApiResponse<bool>>> UnlinkChild(Guid id, CancellationToken cancellationToken)
    {
        var removed = await _guardians.UnlinkChildAsync(Caller.UserId, id, cancellationToken);
        return removed
            ? Ok(new ApiResponse<bool>(true, true, "Bağlantı kaldırıldı"))
            : NotFound(new ApiResponse<bool>(false, false, "Bağlı öğrenci bulunamadı"));
    }

    /// <summary>A student issues a one-time code a parent can use to link to this account.</summary>
    [HttpPost("me/guardian-code")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<ActionResult<ApiResponse<GuardianCodeDto>>> IssueGuardianCode(CancellationToken cancellationToken)
    {
        var code = await _guardians.IssueLinkCodeAsync(Caller.UserId, cancellationToken);
        return code is null
            ? NotFound(new ApiResponse<GuardianCodeDto>(false, null, "Öğrenci profili bulunamadı"))
            : Ok(new ApiResponse<GuardianCodeDto>(true, code));
    }

    [HttpGet("me/guardians")]
    [Authorize(Roles = UserRoles.Student)]
    public async Task<ActionResult<ApiResponse<List<PublicUserDto>>>> GetGuardians(CancellationToken cancellationToken)
    {
        var guardians = await _guardians.GetGuardiansAsync(Caller.UserId, cancellationToken);
        return Ok(new ApiResponse<List<PublicUserDto>>(true, guardians));
    }

    /// <summary>
    /// Whether the caller may follow this student. Other services call it with the caller's own token
    /// (see <c>GuardianAccessClient</c>), so it can only ever answer for the person asking.
    /// </summary>
    [HttpGet("guardianship/{studentId}")]
    public async Task<ActionResult<ApiResponse<GuardianshipDto>>> GetGuardianship(Guid studentId, CancellationToken cancellationToken)
    {
        var caller = Caller;
        var allowed = caller.CanActFor(studentId) ||
            (caller.IsParent && await _guardians.IsGuardianAsync(caller.UserId, studentId, cancellationToken));

        return Ok(new ApiResponse<GuardianshipDto>(true, new GuardianshipDto(studentId, allowed)));
    }
}
