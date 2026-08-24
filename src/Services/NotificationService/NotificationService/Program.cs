using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Hubs;
using NotificationService.Services;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost(options => options.IncludeRedisHealth = true);

builder.Services.AddDbContext<NotificationDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddEduPlatformSignalR(builder.Configuration, "NotificationHub");
builder.Services.AddScoped<INotificationManagementService, NotificationManagementService>();

var app = builder.Build();
app.UseEduPlatformPipeline();
app.MapHub<NotificationHub>("/hubs/notifications");

app.ApplyMigrations<NotificationDbContext>();

app.Run();
