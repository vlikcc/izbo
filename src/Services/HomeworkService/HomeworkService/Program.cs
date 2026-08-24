using HomeworkService.Data;
using HomeworkService.Services;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<HomeworkDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddClassroomAccessClient(builder.Configuration);
builder.Services.AddScoped<IHomeworkManagementService, HomeworkManagementService>();

var app = builder.Build();
app.UseEduPlatformPipeline();

app.ApplyMigrations<HomeworkDbContext>();

app.Run();
