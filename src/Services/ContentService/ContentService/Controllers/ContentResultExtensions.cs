using ContentService.Services;
using Microsoft.AspNetCore.Mvc;
using Shared.DTOs;

namespace ContentService.Controllers;

internal static class ContentResultExtensions
{
    public static ActionResult<ApiResponse<T>> ToActionResult<T>(this ContentResult<T> result, ControllerBase controller, string? successMessage = null)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(controller);

        var body = new ApiResponse<T>(result.IsOk, result.Value, result.IsOk ? successMessage : result.Error);
        return result.Status switch
        {
            ContentResultStatus.Ok => controller.Ok(body),
            ContentResultStatus.NotFound => controller.NotFound(body),
            ContentResultStatus.Forbidden => controller.StatusCode(StatusCodes.Status403Forbidden, body),
            ContentResultStatus.Conflict => controller.Conflict(body),
            _ => controller.BadRequest(body),
        };
    }
}
