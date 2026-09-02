using FileService.Data;
using FileService.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Diagnostics.HealthChecks;
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

// Registered from Build()'s return value rather than through AddMinio(Action<IMinioClient>). That
// overload hands the action a client and registers that same instance, so Build()'s result is thrown
// away — and the half-configured client it leaves behind accepts PutObject without throwing while
// writing an empty object. Uploads reported success, MinIO held zero bytes, and every download then
// died on a Content-Length mismatch.
builder.Services.AddSingleton<IMinioClient>(_ =>
{
    var client = new MinioClient()
        .WithEndpoint(builder.Configuration["MinIO:Endpoint"] ?? "localhost:9000")
        .WithCredentials(
            builder.Configuration["MinIO:AccessKey"] ?? "minioadmin",
            builder.Configuration["MinIO:SecretKey"] ?? "minioadmin");

    if (minioUseSsl)
    {
        client = client.WithSSL();
    }

    return client.Build();
});

// Prepares the bucket at boot and surfaces the object store's state, so a deployment that never ran
// the bucket script is caught at start-up rather than by the first user who tries to upload.
builder.Services.AddHostedService<MinioBucketProvisioner>();
builder.Services.AddHttpClient(MinioHealthCheck.HttpClientName,
    client => client.Timeout = TimeSpan.FromSeconds(5));
builder.Services.AddHealthChecks()
    .AddCheck<MinioHealthCheck>("minio", failureStatus: HealthStatus.Degraded);

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddEduPlatformAuditLogger();
builder.Services.AddScoped<IFileManagementService, FileManagementService>();
builder.Services.AddSubscriptionGuard(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());

app.ApplyMigrations<FileDbContext>();

app.Run();
