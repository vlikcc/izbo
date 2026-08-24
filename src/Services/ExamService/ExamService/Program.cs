using ExamService.Data;
using ExamService.Hubs;
using ExamService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost(options => options.IncludeRedisHealth = true);

builder.Services.AddDbContext<ExamDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "ExamService_";
});

builder.Services.AddEduPlatformSignalR(builder.Configuration, "ExamHub");
builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddScoped<IExamManagementService, ExamManagementService>();
builder.Services.AddScoped<IExamSessionService, ExamSessionService>();
builder.Services.AddSingleton<ILiveQuizStore, InMemoryLiveQuizStore>();

var app = builder.Build();
app.UseEduPlatformPipeline();
app.MapHub<ExamHub>("/hubs/exam");

app.ApplyMigrations<ExamDbContext>();

app.Run();
