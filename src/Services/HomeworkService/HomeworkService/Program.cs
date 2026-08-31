using HomeworkService.Data;
using HomeworkService.Services;
using Shared.Audit;
using Shared.Authorization;
using Shared.Extensions;
using Shared.Subscription;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<HomeworkDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddEduPlatformAuditLogger();
builder.Services.AddScoped<IHomeworkManagementService, HomeworkManagementService>();
builder.Services.AddSubscriptionGuard(builder.Configuration);

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseSubscriptionQuotaExceptions());

app.ApplyMigrations<HomeworkDbContext>();

app.Run();
