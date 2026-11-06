using System.Text.Json.Serialization;
using ContentService.Data;
using ContentService.Services;
using ContentService.Services.Media;
using ContentService.Services.Questions;
using ContentService.Services.Storage;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Minio;
using Shared.Audit;
using Shared.Authorization;
using Shared.Extensions;
using Shared.Subscription;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<ContentDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.Configure<ContentOptions>(builder.Configuration.GetSection(ContentOptions.SectionName));

// Same construction as FileService: the client is registered from Build()'s return value, because the
// AddMinio(Action<IMinioClient>) overload keeps a half-configured instance that "succeeds" writing nothing.
builder.Services.AddSingleton<IMinioClient>(_ =>
{
    var client = new MinioClient()
        .WithEndpoint(builder.Configuration["MinIO:Endpoint"] ?? "localhost:9000")
        .WithCredentials(
            builder.Configuration["MinIO:AccessKey"] ?? "minioadmin",
            builder.Configuration["MinIO:SecretKey"] ?? "minioadmin");

    if (builder.Configuration.GetValue<bool>("MinIO:UseSsl"))
    {
        client = client.WithSSL();
    }

    return client.Build();
});
builder.Services.AddSingleton<IContentStorage, MinioContentStorage>();
builder.Services.AddHostedService<MinioBucketProvisioner>();
builder.Services.AddHttpClient(MinioHealthCheck.HttpClientName,
    client => client.Timeout = TimeSpan.FromSeconds(5));
builder.Services.AddHealthChecks()
    .AddCheck<MinioHealthCheck>("minio", failureStatus: HealthStatus.Degraded);

builder.Services.AddEduPlatformAuditLogger();
builder.Services.AddSingleton<IContentAccessPolicy, AllowAllContentAccessPolicy>();
builder.Services.AddScoped<ICurriculumService, CurriculumService>();
builder.Services.AddScoped<IContentItemService, ContentItemService>();
builder.Services.AddScoped<IQuestionBankService, QuestionBankService>();
builder.Services.AddScoped<TranscodeJobStore>();
builder.Services.AddHostedService<VideoTranscodeWorker>();
builder.Services.AddSubscriptionGuard(builder.Configuration);
builder.Services.AddGuardianAccessClient(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());

app.ApplyMigrations<ContentDbContext>();

app.Run();
