using System.Text.Json.Serialization;
using ContentService.Data;
using ContentService.Kampus;
using ContentService.Kampus.Catalog;
using ContentService.Kampus.Data;
using ContentService.Kampus.Services;
using ContentService.Services;
using ContentService.Services.Assessments;
using ContentService.Services.Media;
using ContentService.Services.Questions;
using ContentService.Services.Storage;
using Microsoft.EntityFrameworkCore;
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
builder.Services.AddLearnerAccessClient(builder.Configuration);
builder.Services.AddScoped<IContentAccessPolicy, PackageContentAccessPolicy>();
builder.Services.AddScoped<ICurriculumService, CurriculumService>();
builder.Services.AddScoped<IContentItemService, ContentItemService>();
builder.Services.AddScoped<IQuestionBankService, QuestionBankService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAttemptService, AttemptService>();
builder.Services.AddScoped<IAssessmentService, AssessmentService>();
builder.Services.AddHostedService<AttemptMaintenanceWorker>();
builder.Services.AddScoped<TranscodeJobStore>();
builder.Services.AddHostedService<VideoTranscodeWorker>();
builder.Services.AddSubscriptionGuard(builder.Configuration);
builder.Services.AddGuardianAccessClient(builder.Configuration);

// YZ Kampüs: learner progress, rewards ledger, Yıldız Kupası, avatar, assignments and skill checks.
builder.Services.AddDbContext<KampusDbContext>(options =>
    options.UseNpgsql(
        NpgsqlPooling.Apply(builder.Configuration.GetConnectionString("Postgres")),
        npgsql => npgsql.MigrationsHistoryTable(KampusDbContext.MigrationsHistoryTable)));
builder.Services.AddSingleton(KampusCatalog.LoadEmbedded());
builder.Services.AddSingleton<KampusClock>();
builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddHttpClient(KampusDirectory.ClassroomClientName, client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:ClassroomService"]!.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddScoped<IKampusDirectory, KampusDirectory>();
builder.Services.AddScoped<KampusCupService>();
builder.Services.AddScoped<KampusLearnerService>();
builder.Services.AddScoped<KampusAvatarService>();
builder.Services.AddScoped<KampusTeachingService>();

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());

app.ApplyMigrations<ContentDbContext>();
app.ApplyMigrations<KampusDbContext>();

app.Run();
