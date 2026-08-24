using HomeworkService.Data;
using HomeworkService.Services;
using Shared.Audit;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<HomeworkDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddEduPlatformAuditLogger();
builder.Services.AddScoped<IHomeworkManagementService, HomeworkManagementService>();

var app = builder.Build();
app.UseEduPlatformPipeline();

app.ApplyMigrations<HomeworkDbContext>();

app.Run();
