using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Shared.Errors;

/// <summary>
/// Turns unhandled exceptions into RFC 7807 ProblemDetails. Business endpoints still return
/// <c>ApiResponse&lt;T&gt;</c>; this is the safety net for validation failures and unexpected faults.
/// The same payload carries <c>success</c>/<c>message</c>/<c>errors</c> so the SPA can parse either shape.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetails = problemDetails;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        var correlationId = httpContext.GetCorrelationId();
        var (status, title, detail, errors) = Describe(exception);

        if (status >= StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception {CorrelationId}", correlationId);
        }
        else
        {
            _logger.LogWarning(exception, "{Title} {CorrelationId}", title, correlationId);
        }

        httpContext.Response.StatusCode = status;

        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = detail,
                Instance = httpContext.Request.Path,
                Extensions =
                {
                    ["correlationId"] = correlationId,
                    ["success"] = false,
                    ["message"] = detail,
                    ["errors"] = errors
                }
            }
        });
    }

    private static (int Status, string Title, string Detail, List<string>? Errors) Describe(Exception exception)
    {
        switch (exception)
        {
            case ValidationException validation:
                return (
                    StatusCodes.Status400BadRequest,
                    "Doğrulama hatası",
                    "Gönderilen veri geçersiz.",
                    validation.Errors.Select(e => e.ErrorMessage).Distinct().ToList());
            case UnauthorizedAccessException:
                return (StatusCodes.Status403Forbidden, "Yetkisiz", exception.Message, null);
            case KeyNotFoundException:
                return (StatusCodes.Status404NotFound, "Bulunamadı", exception.Message, null);
            case ArgumentException:
                return (StatusCodes.Status400BadRequest, "Geçersiz istek", exception.Message, null);
            default:
                return (
                    StatusCodes.Status500InternalServerError,
                    "Beklenmeyen bir hata oluştu",
                    "İstek işlenemedi. Destek için korelasyon kimliğini kullanın.",
                    null);
        }
    }
}
