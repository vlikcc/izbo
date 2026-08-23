using Serilog;
using ExamService.Data;
using ExamService.Hubs;
using ExamService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Extensions;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<ExamDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// Redis Cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "ExamService_";
});

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR().AddStackExchangeRedis(builder.Configuration.GetConnectionString("Redis")!, options =>
{
    options.Configuration.ChannelPrefix = RedisChannel.Literal("ExamHub");
});

// Services
builder.Services.AddScoped<IExamManagementService, ExamManagementService>();
builder.Services.AddScoped<IExamSessionService, ExamSessionService>();

// CORS
builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
builder.Services.AddEduPlatformHealthChecks(builder.Configuration, includeRedis: true);

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
app.MapControllers();
app.MapHub<ExamHub>("/hubs/exam");
app.MapHealthChecks("/health");

app.ApplyMigrations<ExamDbContext>();

app.Run();
