using Microsoft.EntityFrameworkCore;
using Shared.Configuration;
using Shared.Extensions;
using UserService.Data;
using UserService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<UserDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

var app = builder.Build();
app.UseEduPlatformPipeline();

app.ApplyMigrations<UserDbContext>();
await UserDataSeeder.SeedAsync(app.Services);

app.Run();
