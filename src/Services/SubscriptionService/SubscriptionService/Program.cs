using Microsoft.EntityFrameworkCore;
using Serilog;
using Shared.Extensions;
using Shared.Subscription;
using SubscriptionService.Configuration;
using SubscriptionService.Data;
using SubscriptionService.Services;
using SubscriptionService.Workers;

var builder = WebApplication.CreateBuilder(args);
builder.AddEduPlatformLogging();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        foreach (var converter in SubscriptionJsonOptions.Default.Converters)
            options.JsonSerializerOptions.Converters.Add(converter);
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<SubscriptionDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JWT");
builder.Services.AddJwtAuthentication(
    jwtSettings["Secret"]!,
    jwtSettings["Issuer"]!,
    jwtSettings["Audience"]!
);
builder.Services.AddAuthorization();

// Options
builder.Services.Configure<TrialOptions>(builder.Configuration.GetSection(TrialOptions.SectionName));

// Services
builder.Services.AddScoped<ISubscriberResolver, SubscriberResolver>();
builder.Services.AddScoped<IPaymentProvider, ManualPaymentProvider>();
builder.Services.AddScoped<SubscriptionManagementService>();
builder.Services.AddScoped<ISubscriptionManagementService>(sp => sp.GetRequiredService<SubscriptionManagementService>());
builder.Services.AddScoped<IOrganizationService, OrganizationService>();
builder.Services.AddHostedService<SubscriptionLifecycleWorker>();

// CORS
builder.Services.AddCorsPolicy("AllowFrontend", builder.Configuration["Frontend:Url"] ?? "http://localhost:3000");
builder.Services.AddEduPlatformHealthChecks(builder.Configuration);

var app = builder.Build();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.ApplyMigrations<SubscriptionDbContext>();
await SubscriptionDataSeeder.SeedAsync(app.Services);

app.Run();
