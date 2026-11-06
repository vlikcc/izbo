using Shared.Audit;
using Shared.Configuration;
using Shared.Extensions;
using Shared.Internal;
using UserService.Data;
using UserService.Services;
using UserService.Services.Promotion;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<UserDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddEduPlatformAudit<UserDbContext>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IGuardianService, GuardianService>();
builder.Services.AddAccountStateClient(builder.Configuration);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.Configure<PromotionOptions>(builder.Configuration.GetSection(PromotionOptions.SectionName));
builder.Services.AddScoped<IGradePromotionService, GradePromotionService>();
builder.Services.AddHostedService<PromotionWorker>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

var app = builder.Build();
app.UseEduPlatformPipeline();

app.ApplyMigrations<UserDbContext>();
await UserDataSeeder.SeedAsync(app.Services);

app.Run();
