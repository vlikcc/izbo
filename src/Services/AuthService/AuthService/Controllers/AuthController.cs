using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Net.Http.Headers;
using Shared.Authorization;
using Shared.DTOs;
using Shared.RateLimiting;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// Sent whether or not the address was already registered, so registration cannot be used to discover
    /// which addresses have accounts. A duplicate attempt creates nothing and grants nothing.
    /// </summary>
    private const string RegistrationAccepted =
        "Kayıt talebiniz alındı. Giriş ekranından hesabınıza giriş yapabilirsiniz.";

    /// <summary>The one answer for an unknown number, a wrong password, a wrong role and a disabled account.</summary>
    private const string NationalIdRejected = "T.C. kimlik numarası veya şifre hatalı.";

    private readonly IAuthService _authService;
    private readonly IAccountEmailService _accountEmail;
    private readonly INationalIdAuthService _nationalId;

    public AuthController(IAuthService authService, IAccountEmailService accountEmail, INationalIdAuthService nationalId)
    {
        _authService = authService;
        _accountEmail = accountEmail;
        _nationalId = nationalId;
    }

    [HttpPost("register")]
    [EnableRateLimiting(AuthRateLimits.Registration)]
    public async Task<ActionResult<ApiResponse<bool>>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.RegisterAsync(request, Client(), cancellationToken);

        // Only the password verdict is reported, because it reveals nothing about the address.
        if (result.Outcome == RegistrationOutcome.PasswordRejected)
        {
            return BadRequest(new ApiResponse<bool>(false, false, result.Error));
        }

        return Ok(new ApiResponse<bool>(true, true, RegistrationAccepted));
    }

    [HttpPost("login")]
    [EnableRateLimiting(AuthRateLimits.Login)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(request, Client(), cancellationToken);

        if (result == null)
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "E-posta/kullanıcı adı veya parola hatalı"));

        return Ok(new ApiResponse<AuthResponse>(true, result, "Giriş başarılı"));
    }

    /// <summary>
    /// YZ Kampüs sign-in: T.C. Kimlik No + password. Never says which of the two was wrong; repeated failures
    /// lock the number for a while whether or not an account has it.
    /// </summary>
    [HttpPost("tc-login")]
    [EnableRateLimiting(AuthRateLimits.Login)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> NationalIdLogin(
        [FromBody] NationalIdLoginRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var result = await _nationalId.LoginAsync(request, Client(), cancellationToken);

        switch (result.Status)
        {
            case NationalIdLoginStatus.Success:
                return Ok(new ApiResponse<AuthResponse>(true, result.Auth, "Giriş başarılı"));
            case NationalIdLoginStatus.InvalidNumber:
                return BadRequest(new ApiResponse<AuthResponse>(false, null, "Geçerli bir T.C. kimlik numarası gir (11 hane)."));
            case NationalIdLoginStatus.MissingPassword:
                return BadRequest(new ApiResponse<AuthResponse>(false, null, "Şifreni gir."));
            case NationalIdLoginStatus.LockedOut:
                Response.Headers.RetryAfter = result.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
                return StatusCode(StatusCodes.Status429TooManyRequests, new ApiResponse<AuthResponse>(
                    false, null, $"Çok fazla hatalı deneme. {result.RetryAfterSeconds} saniye sonra tekrar dene."));
            case NationalIdLoginStatus.Unavailable:
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiResponse<AuthResponse>(
                    false, null, "T.C. kimlik numarasıyla giriş şu anda kullanılamıyor."));
            default:
                return Unauthorized(new ApiResponse<AuthResponse>(false, null, NationalIdRejected));
        }
    }

    [Authorize]
    [HttpPost("change-password")]
    [EnableRateLimiting(AuthRateLimits.Login)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> ChangePassword(
        [FromBody] ChangeOwnPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var (error, auth) = await _authService.ChangePasswordAsync(User.GetCaller().UserId, request, Client(), cancellationToken);
        if (error is not null)
        {
            return BadRequest(new ApiResponse<AuthResponse>(false, null, error));
        }

        return Ok(new ApiResponse<AuthResponse>(true, auth, "Şifre güncellendi"));
    }

    [HttpPost("refresh")]
    [EnableRateLimiting(AuthRateLimits.Refresh)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var result = await _authService.RefreshTokenAsync(request.RefreshToken, Client(), cancellationToken);

        if (result == null)
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Oturum süresi doldu, tekrar giriş yapın"));

        return Ok(new ApiResponse<AuthResponse>(true, result, "Token yenilendi"));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<bool>>> Logout(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var result = await _authService.LogoutAsync(User.GetCaller().UserId, request.RefreshToken, cancellationToken);

        return Ok(new ApiResponse<bool>(true, result, "Çıkış yapıldı"));
    }

    [Authorize]
    [HttpPost("revoke-all")]
    public async Task<ActionResult<ApiResponse<bool>>> RevokeAllTokens(CancellationToken cancellationToken)
    {
        var result = await _authService.RevokeAllTokensAsync(User.GetCaller().UserId, cancellationToken);

        return Ok(new ApiResponse<bool>(true, result, "Tüm oturumlar kapatıldı"));
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult<ApiResponse<object>> GetCurrentUser()
    {
        var caller = User.GetCaller();

        return Ok(new ApiResponse<object>(true, new
        {
            userId = caller.UserId,
            email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value,
            username = User.FindFirst("username")?.Value,
            role = caller.Role.ToString(),
            firstName = User.FindFirst("firstName")?.Value,
            lastName = User.FindFirst("lastName")?.Value
        }));
    }

    private ClientFingerprint Client() => new(
        HttpContext.Connection.RemoteIpAddress?.ToString(),
        Request.Headers[HeaderNames.UserAgent].ToString());

    [HttpPost("forgot-password")]
    [EnableRateLimiting(AuthRateLimits.ForgotPassword)]
    public async Task<ActionResult<ApiResponse<bool>>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        await _accountEmail.RequestPasswordResetAsync(request.Email, cancellationToken);
        return Ok(new ApiResponse<bool>(true, true, "Adres kayıtlıysa sıfırlama bağlantısı gönderildi."));
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting(AuthRateLimits.ForgotPassword)]
    public async Task<ActionResult<ApiResponse<bool>>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var ok = await _accountEmail.ResetPasswordAsync(request.Token, request.Password, cancellationToken);
        if (!ok)
        {
            return BadRequest(new ApiResponse<bool>(false, false, "Sıfırlama bağlantısı geçersiz veya süresi doldu."));
        }

        return Ok(new ApiResponse<bool>(true, true, "Parola güncellendi"));
    }

    [HttpPost("verify-email")]
    public async Task<ActionResult<ApiResponse<bool>>> VerifyEmail(
        [FromBody] VerifyEmailRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var ok = await _accountEmail.VerifyEmailAsync(request.Token, cancellationToken);
        if (!ok)
        {
            return BadRequest(new ApiResponse<bool>(false, false, "Doğrulama bağlantısı geçersiz."));
        }

        return Ok(new ApiResponse<bool>(true, true, "E-posta doğrulandı"));
    }

    [Authorize]
    [HttpDelete("me")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAccount(CancellationToken cancellationToken)
    {
        await _accountEmail.DeleteAccountAsync(User.GetCaller().UserId, cancellationToken);
        return Ok(new ApiResponse<bool>(true, true, "Hesap silindi"));
    }
}
