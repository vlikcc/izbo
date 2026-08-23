using HomeworkService.Data;
using HomeworkService.Services;
using Serilog;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<HomeworkDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// Assignments are scoped to classrooms owned by ClassroomService, so authorization needs that lookup.
builder.Services.AddClassroomAccessClient(builder.Configuration);

// Services
builder.Services.AddScoped<IHomeworkManagementService, HomeworkManagementService>();

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
app.MapControllers();
app.MapHealthChecks("/health");

app.ApplyMigrations<HomeworkDbContext>();

app.Run();
