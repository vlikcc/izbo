using Microsoft.EntityFrameworkCore;
using Shared.Models;

namespace SubscriptionService.Data;

/// <summary>Idempotently seeds the plan catalog (Free / Pro / Kurumsal). Upserts by Plan.Code so it is
/// safe to run on every boot, mirroring AuthDataSeeder's pattern.</summary>
public static class SubscriptionDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SubscriptionDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("SubscriptionDataSeeder");

        foreach (var definition in PlanDefinitions())
        {
            var existing = await context.Plans
                .Include(p => p.Limits)
                .Include(p => p.Features)
                .FirstOrDefaultAsync(p => p.Code == definition.Code);

            if (existing == null)
            {
                context.Plans.Add(definition);
                logger.LogInformation("Seeding plan {Code}", definition.Code);
                continue;
            }

            // Keep existing plan row (preserve Id), but refresh its limits/features/pricing so
            // catalog changes deployed in code always win over whatever is in the DB.
            existing.Name = definition.Name;
            existing.Description = definition.Description;
            existing.PriceMonthly = definition.PriceMonthly;
            existing.PriceYearly = definition.PriceYearly;
            existing.Currency = definition.Currency;
            existing.Tier = definition.Tier;
            existing.TargetSubscriberType = definition.TargetSubscriberType;
            existing.IsPublic = definition.IsPublic;
            existing.IsActive = definition.IsActive;
            existing.SortOrder = definition.SortOrder;

            context.PlanLimits.RemoveRange(existing.Limits);
            context.PlanFeatures.RemoveRange(existing.Features);
            foreach (var limit in definition.Limits)
            {
                limit.PlanId = existing.Id;
                context.PlanLimits.Add(limit);
            }
            foreach (var feature in definition.Features)
            {
                feature.PlanId = existing.Id;
                context.PlanFeatures.Add(feature);
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Plan catalog seed complete.");
    }

    private static List<Plan> PlanDefinitions() =>
    [
        new Plan
        {
            Id = Guid.NewGuid(),
            Code = "free",
            Name = "Ücretsiz",
            Description = "Bireysel eğitmenler için başlangıç planı.",
            PriceMonthly = 0,
            PriceYearly = 0,
            Currency = "TRY",
            Tier = 0,
            TargetSubscriberType = SubscriberType.User,
            IsPublic = true,
            IsActive = true,
            SortOrder = 0,
            Limits =
            [
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Classrooms, Value = 1, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxStudentsPerClassroom, Value = 25, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.ExamsCreated, Value = 3, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.HomeworksCreated, Value = 5, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.LiveMinutes, Value = 60, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.StorageMegabytes, Value = 250, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxQuestionsPerExam, Value = 20, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Seats, Value = 1, Period = QuotaPeriod.Absolute },
            ],
            Features = []
        },
        new Plan
        {
            Id = Guid.NewGuid(),
            Code = "pro",
            Name = "Pro",
            Description = "Aktif eğitmenler için tüm özellikler.",
            PriceMonthly = 299m,
            PriceYearly = 2990m,
            Currency = "TRY",
            Tier = 1,
            TargetSubscriberType = SubscriberType.User,
            IsPublic = true,
            IsActive = true,
            SortOrder = 1,
            Limits =
            [
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Classrooms, Value = 15, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxStudentsPerClassroom, Value = 150, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.ExamsCreated, Value = 100, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.HomeworksCreated, Value = -1, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.LiveMinutes, Value = 1500, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.StorageMegabytes, Value = 10240, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxQuestionsPerExam, Value = 200, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Seats, Value = 1, Period = QuotaPeriod.Absolute },
            ],
            Features =
            [
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "live_quiz", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "question_import", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "analytics", IsEnabled = true },
            ]
        },
        new Plan
        {
            Id = Guid.NewGuid(),
            Code = "institution",
            Name = "Kurumsal",
            Description = "Okullar ve kurumlar için koltuk bazlı plan.",
            PriceMonthly = 4999m,
            PriceYearly = 49990m,
            Currency = "TRY",
            Tier = 2,
            TargetSubscriberType = SubscriberType.Organization,
            IsPublic = true,
            IsActive = true,
            SortOrder = 2,
            Limits =
            [
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Classrooms, Value = -1, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxStudentsPerClassroom, Value = 500, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.ExamsCreated, Value = -1, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.HomeworksCreated, Value = -1, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.LiveMinutes, Value = 10000, Period = QuotaPeriod.Monthly },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.StorageMegabytes, Value = 102400, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.MaxQuestionsPerExam, Value = -1, Period = QuotaPeriod.Absolute },
                new PlanLimit { Id = Guid.NewGuid(), Metric = QuotaMetric.Seats, Value = 10, Period = QuotaPeriod.Absolute },
            ],
            Features =
            [
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "live_quiz", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "question_import", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "analytics", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "custom_branding", IsEnabled = true },
                new PlanFeature { Id = Guid.NewGuid(), FeatureCode = "priority_support", IsEnabled = true },
            ]
        },
    ];
}
