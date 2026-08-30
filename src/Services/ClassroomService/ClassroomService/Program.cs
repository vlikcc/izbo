using Serilog;
using ClassroomService.Data;
using ClassroomService.Hubs;
using ClassroomService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Extensions;
using Shared.Subscription;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<ClassroomDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// Services
builder.Services.AddScoped<IClassroomManagementService, ClassroomManagementService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddSubscriptionGuard(builder.Configuration);

// CORS
builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
builder.Services.AddEduPlatformHealthChecks(builder.Configuration);

var app = builder.Build();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseSubscriptionQuotaExceptions();
app.MapControllers();
app.MapHub<ClassroomHub>("/hubs/classroom");
app.MapHealthChecks("/health");

app.ApplyMigrations<ClassroomDbContext>();

app.Run();
