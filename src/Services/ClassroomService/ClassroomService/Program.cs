using ClassroomService.Configuration;
using ClassroomService.Data;
using ClassroomService.Hubs;
using ClassroomService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Extensions;
using Shared.Subscription;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost(options => options.IncludeRedisHealth = true);

builder.Services.AddDbContext<ClassroomDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddEduPlatformSignalR(builder.Configuration, "ClassroomHub");
builder.Services.Configure<JitsiOptions>(builder.Configuration.GetSection(JitsiOptions.SectionName));
builder.Services.AddScoped<IClassroomManagementService, ClassroomManagementService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<IClassroomCommunityService, ClassroomCommunityService>();
builder.Services.AddSubscriptionGuard(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());
app.MapHub<ClassroomHub>("/hubs/classroom");

app.ApplyMigrations<ClassroomDbContext>();

app.Run();
