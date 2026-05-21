using Serilog;
using Microsoft.EntityFrameworkCore;
using Shared.Extensions;
using Shared.Configuration;
using UserService.Data;
using UserService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<UserDbContext>(options =>
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
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

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

app.ApplyMigrations<UserDbContext>();
await UserDataSeeder.SeedAsync(app.Services);

app.Run();
