using ExamService.Data;
using ExamService.Hubs;
using ExamService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;
using Shared.Subscription;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost(options => options.IncludeRedisHealth = true);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddDbContext<ExamDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

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
builder.Services.AddSubscriptionGuard(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());
app.MapHub<ExamHub>("/hubs/exam");

app.ApplyMigrations<ExamDbContext>();

app.Run();
