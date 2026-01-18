using LiveSessionService.Hubs;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Configure to listen on port 80
builder.WebHost.ConfigureKestrel(options => options.ListenAnyIP(80));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 102400; // 100KB for WebRTC signaling
});

// CORS
builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<LiveSessionHub>("/hubs/live");

app.Run();
