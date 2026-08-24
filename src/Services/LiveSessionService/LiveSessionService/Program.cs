using LiveSessionService.Hubs;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost(options => options.IncludeRedisHealth = true);

builder.WebHost.ConfigureKestrel(options => options.ListenAnyIP(80));

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddSingleton<ISessionRegistry, InMemorySessionRegistry>();
builder.Services.AddEduPlatformSignalR(builder.Configuration, "LiveHub", options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 102400;
});

var app = builder.Build();
app.UseEduPlatformPipeline();
app.MapHub<LiveSessionHub>("/hubs/live");

app.Run();
