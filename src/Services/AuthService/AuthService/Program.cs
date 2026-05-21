using Serilog;
using AuthService.Data;
using AuthService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Configuration;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// Services
builder.Services.AddScoped<IAuthService, AuthenticationService>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

// CORS
builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
builder.Services.AddEduPlatformHealthChecks(builder.Configuration);

var app = builder.Build();
app.UseSerilogRequestLogging();

// Configure pipeline
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

app.ApplyMigrations<AuthDbContext>();
await AuthDataSeeder.SeedAsync(app.Services);

app.Run();
