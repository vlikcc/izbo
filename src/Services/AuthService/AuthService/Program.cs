using AuthService.Data;
using AuthService.Services;
using Shared.Audit;
using Shared.Configuration;
using Shared.Email;
using Shared.Extensions;
using Shared.Internal;
using Shared.Messaging;
using Shared.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformWebHost();

builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseEduPlatformNpgsql(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddEduPlatformAudit<AuthDbContext>();
builder.Services.AddScoped<IAuthService, AuthenticationService>();
builder.Services.AddScoped<IAccountEmailService, AccountEmailService>();
builder.Services.AddSingleton<RabbitMqMessageBus>();
builder.Services.AddSingleton<IMessageBus>(sp => sp.GetRequiredService<RabbitMqMessageBus>());
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddHostedService<OutboxProcessor>();
builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

builder.Services.AddAccountDirectoryClient(builder.Configuration);

builder.Services.AddAuthRateLimiting(builder.Configuration.GetConnectionString("Redis"));

var app = builder.Build();
app.UseEduPlatformPipeline(configure: pipeline => pipeline.UseRateLimiter());

app.ApplyMigrations<AuthDbContext>();
await AuthDataSeeder.SeedAsync(app.Services);

app.Run();
