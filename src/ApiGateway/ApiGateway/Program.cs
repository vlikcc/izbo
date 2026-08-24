using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using Serilog;
using Shared.Errors;
using Shared.Extensions;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();
builder.Services.AddForwardedHeaders();

var ocelotFile = builder.Environment.IsProduction() ? "ocelot.Production.json" : "ocelot.json";
builder.Configuration.AddJsonFile(ocelotFile, optional: false, reloadOnChange: true);
var apiPublicUrl = builder.Configuration["Api:PublicUrl"];
if (!string.IsNullOrWhiteSpace(apiPublicUrl))
{
    builder.Configuration["GlobalConfiguration:BaseUrl"] = apiPublicUrl;
}

var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!)),
            ClockSkew = TimeSpan.Zero
        };

        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
builder.Services.AddOcelot();
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 200,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseForwardedHeadersFromProxy();
app.UseCorrelationId();
app.UseRateLimiter();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.RoutePrefix = "docs";
    options.DocumentTitle = "EduPlatform API";
    options.SwaggerEndpoint("/openapi/auth/v1/swagger.json", "Auth");
    options.SwaggerEndpoint("/openapi/users/v1/swagger.json", "Users");
    options.SwaggerEndpoint("/openapi/classrooms/v1/swagger.json", "Classrooms");
    options.SwaggerEndpoint("/openapi/homework/v1/swagger.json", "Homework");
    options.SwaggerEndpoint("/openapi/exams/v1/swagger.json", "Exams");
    options.SwaggerEndpoint("/openapi/live/v1/swagger.json", "Live");
    options.SwaggerEndpoint("/openapi/notifications/v1/swagger.json", "Notifications");
    options.SwaggerEndpoint("/openapi/files/v1/swagger.json", "Files");
});

app.UseWebSockets();
app.UseRouting();
app.MapEduPlatformHealthChecks();

app.UseWhen(
    ctx => !ctx.Request.Path.StartsWithSegments("/health")
        && !ctx.Request.Path.StartsWithSegments("/docs")
        && !ctx.Request.Path.StartsWithSegments("/swagger"),
    branch => branch.UseOcelot().GetAwaiter().GetResult());

app.Run();
