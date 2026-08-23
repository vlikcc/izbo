using Serilog;
using FileService.Data;
using FileService.Services;
using Microsoft.EntityFrameworkCore;
using Minio;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<FileDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// MinIO
var minioUseSsl = builder.Configuration.GetValue<bool>("MinIO:UseSsl");
builder.Services.AddMinio(configureClient =>
{
    configureClient
        .WithEndpoint(builder.Configuration["MinIO:Endpoint"] ?? "localhost:9000")
        .WithCredentials(
            builder.Configuration["MinIO:AccessKey"] ?? "minioadmin",
            builder.Configuration["MinIO:SecretKey"] ?? "minioadmin");
    if (minioUseSsl)
    {
        configureClient.WithSSL();
    }
});

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);

builder.Services.AddAuthorization();

// Files attached to a classroom are readable by its members, which requires the classroom lookup.
builder.Services.AddClassroomAccessClient(builder.Configuration);

// Services
builder.Services.AddScoped<IFileManagementService, FileManagementService>();

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

app.ApplyMigrations<FileDbContext>();

app.Run();
