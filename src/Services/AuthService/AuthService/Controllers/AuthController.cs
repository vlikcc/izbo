using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;
using System.Security.Claims;

namespace AuthService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "Invalid request", ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList()));

        var result = await _authService.RegisterAsync(request);

        if (result == null)
            return Conflict(new ApiResponse<AuthResponse>(false, null, "Email already exists"));

        return Ok(new ApiResponse<AuthResponse>(true, result, "Registration successful"));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse<AuthResponse>(false, null, "Invalid request"));

        var result = await _authService.LoginAsync(request);

        if (result == null)
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid email or password"));

        return Ok(new ApiResponse<AuthResponse>(true, result, "Login successful"));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request.RefreshToken);

        if (result == null)
            return Unauthorized(new ApiResponse<AuthResponse>(false, null, "Invalid or expired refresh token"));

        return Ok(new ApiResponse<AuthResponse>(true, result, "Token refreshed"));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<bool>>> Logout([FromBody] RefreshTokenRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _authService.LogoutAsync(userId, request.RefreshToken);

        return Ok(new ApiResponse<bool>(true, result, "Logged out successfully"));
    }

    [Authorize]
    [HttpPost("revoke-all")]
    public async Task<ActionResult<ApiResponse<bool>>> RevokeAllTokens()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _authService.RevokeAllTokensAsync(userId);

        return Ok(new ApiResponse<bool>(true, result, "All tokens revoked"));
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult<ApiResponse<object>> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var role = User.FindFirstValue(ClaimTypes.Role);
        var firstName = User.FindFirstValue("firstName");
        var lastName = User.FindFirstValue("lastName");

        return Ok(new ApiResponse<object>(true, new { userId, email, role, firstName, lastName }));
    }
}
