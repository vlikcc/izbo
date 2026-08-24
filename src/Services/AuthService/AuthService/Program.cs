using AuthService.Data;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Configuration;
using Shared.Extensions;
using Shared.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddScoped<IAuthService, AuthenticationService>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

builder.Services.AddAuthRateLimiting(builder.Configuration.GetConnectionString("Redis"));

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseRateLimiter());

app.ApplyMigrations<AuthDbContext>();
await AuthDataSeeder.SeedAsync(app.Services);

app.Run();
