using FileService.Data;
using FileService.Services;
using Microsoft.AspNetCore.Http.Features;
using Minio;
using Shared.Audit;
using Shared.Authorization;
using Shared.Extensions;
using Shared.Subscription;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.Configure<FormOptions>(options =>
    options.MultipartBodyLengthLimit = FileUploadRules.AbsoluteMaxBytes);

builder.Services.AddDbContext<FileDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

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

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddEduPlatformAuditLogger();
builder.Services.AddScoped<IFileManagementService, FileManagementService>();
builder.Services.AddSubscriptionGuard(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());

app.ApplyMigrations<FileDbContext>();

app.Run();
