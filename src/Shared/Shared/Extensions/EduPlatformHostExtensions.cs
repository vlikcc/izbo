using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Shared.Errors;
using Shared.Validation;

namespace Shared.Extensions;

public sealed class EduPlatformHostOptions
{
    public bool IncludeRedisHealth { get; set; }
}

public static class EduPlatformHostExtensions
{
    /// <summary>
    /// Logging, forwarded headers, ProblemDetails, FluentValidation, JWT, CORS, health and Swagger.
    /// Service-specific registrations (DbContext, SignalR, domain services) still happen in each Program.cs.
    /// </summary>
    public static WebApplicationBuilder AddEduPlatformWebHost(
        this WebApplicationBuilder builder,
        Action<EduPlatformHostOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(builder);

        var options = new EduPlatformHostOptions();
        configure?.Invoke(options);

        builder.AddEduPlatformLogging();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddForwardedHeaders();
        builder.Services.AddProblemDetails(problem =>
        {
            problem.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Extensions["correlationId"] = context.HttpContext.GetCorrelationId();
            };
        });
        builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
        builder.Services.AddControllers(mvc => mvc.Filters.Add<FluentValidationActionFilter>());
        builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        var jwt = builder.Configuration.GetSection("JWT");
        var secret = jwt["Secret"];
        if (!string.IsNullOrWhiteSpace(secret))
        {
            builder.Services.AddJwtAuthentication(
                secret,
                jwt["Issuer"] ?? "EduPlatform",
                jwt["Audience"] ?? "EduPlatformUsers");
            builder.Services.AddAuthorization();
        }

        builder.Services.AddCorsPolicy(
            "AllowFrontend",
            builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
        builder.Services.AddEduPlatformHealthChecks(builder.Configuration, options.IncludeRedisHealth);

        return builder;
    }

    /// <summary>
    /// Pipeline shared by every HTTP service. <paramref name="configure"/> runs after CORS and before
    /// authentication — AuthService uses it to insert the credential rate limiter.
    /// </summary>
    public static WebApplication UseEduPlatformPipeline(
        this WebApplication app,
        Action<IApplicationBuilder>? configure = null,
        bool mapControllers = true)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseSerilogRequestLogging();
        app.UseForwardedHeadersFromProxy();
        app.UseCorrelationId();
        app.UseExceptionHandler();
        app.UseSwagger();
        if (app.Environment.IsDevelopment())
        {
            app.UseSwaggerUI();
        }

        app.UseCors("AllowFrontend");
        configure?.Invoke(app);
        app.UseAuthentication();
        app.UseAuthorization();

        if (mapControllers)
        {
            app.MapControllers();
        }

        app.MapEduPlatformHealthChecks();
        return app;
    }

    public static IEndpointRouteBuilder MapEduPlatformHealthChecks(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false
        });
        endpoints.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = _ => true
        });
        endpoints.MapHealthChecks("/health", new HealthCheckOptions
        {
            Predicate = _ => true
        });

        return endpoints;
    }
}
