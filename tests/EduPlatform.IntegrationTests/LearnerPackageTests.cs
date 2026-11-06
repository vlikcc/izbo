using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shared.DTOs;
using Shared.Models;
using Shouldly;
using SubscriptionService.Configuration;
using SubscriptionService.Data;
using SubscriptionService.Services;
using SubscriptionService.Services.Learner;

namespace EduPlatform.IntegrationTests;

[Collection("postgres")]
public class LearnerPackageTests
{
    private static readonly DateTimeOffset November = new(2026, 11, 7, 9, 0, 0, TimeSpan.Zero);

    private readonly PostgresFixture _postgres;
    private readonly Guid _parent = Guid.NewGuid();
    private readonly Guid _child = Guid.NewGuid();
    private readonly Guid _admin = Guid.NewGuid();

    public LearnerPackageTests(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    [SkippableFact]
    public async Task Approving_a_transfer_grants_the_package_once_and_the_price_comes_from_the_catalogue()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        await using var db = await CreateDbAsync();
        var packages = CreateService(db, clock);

        (await packages.GetAccessAsync(_child)).Tier.ShouldBe(0);
        (await packages.GetAccessAsync(_child)).PracticeTestsPerDay.ShouldBe(3);

        (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "yok", LearnerTerm.Month3), Payer())).Status
            .ShouldBe(LearnerResultStatus.NotFound);

        var order = (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "plus", LearnerTerm.Month3), Payer())).Value!;
        order.Amount.ShouldBe(899m, "the seeded Plus 3-month price");
        order.Status.ShouldBe(LearnerOrderStatus.Pending);
        order.Reference.ShouldMatch("^YZK-[2-9A-HJ-NP-Z]{5}$");
        order.Instructions!.Reference.ShouldBe(order.Reference);

        // Only the payer reports the transfer.
        (await packages.NotifyPaidAsync(order.Id, Guid.NewGuid(), null)).Status.ShouldBe(LearnerResultStatus.NotFound);
        (await packages.NotifyPaidAsync(order.Id, _parent, "Ziraat'ten gönderdim")).Value!.Status.ShouldBe(LearnerOrderStatus.AwaitingApproval);

        var paid = (await packages.ApproveAsync(order.Id, _admin)).Value!;
        paid.Status.ShouldBe(LearnerOrderStatus.Paid);
        paid.Instructions.ShouldBeNull("a paid order no longer shows how to pay");

        (await packages.ApproveAsync(order.Id, _admin)).Status.ShouldBe(LearnerResultStatus.Conflict, "a second click must not add another quarter");
        (await packages.RejectAsync(order.Id, _admin, "geç")).Status.ShouldBe(LearnerResultStatus.Conflict);
        (await packages.CancelOrderAsync(order.Id, _parent)).Status.ShouldBe(LearnerResultStatus.Conflict);
        (await db.LearnerPasses.CountAsync(p => p.StudentId == _child)).ShouldBe(1);

        var access = await packages.GetAccessAsync(_child);
        (access.PackageCode, access.Tier, access.PracticeTestsPerDay).ShouldBe(("plus", 2, -1));
        access.Features.ShouldContain(LearnerFeatures.PremiumAssessments);
        access.EndsAt.ShouldBe(November.UtcDateTime.AddDays(90));
    }

    [SkippableFact]
    public async Task Renewing_queues_after_the_running_pass_and_a_higher_tier_applies_at_once()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        await using var db = await CreateDbAsync();
        var packages = CreateService(db, clock);

        await BuyAsync(packages, "temel", LearnerTerm.Month1);
        clock.Advance(TimeSpan.FromDays(10));
        await BuyAsync(packages, "temel", LearnerTerm.Month1);

        var temel = await packages.GetAccessAsync(_child);
        temel.Tier.ShouldBe(1);
        temel.EndsAt.ShouldBe(November.UtcDateTime.AddDays(60), "renewing early must not lose the 20 days left");

        await BuyAsync(packages, "premium", LearnerTerm.Month1);
        var premium = await packages.GetAccessAsync(_child);
        (premium.PackageCode, premium.Tier).ShouldBe(("premium", 3));
        premium.EndsAt.ShouldBe(clock.Now.AddDays(30));

        // When Premium runs out the queued Temel days are still there.
        clock.Advance(TimeSpan.FromDays(31));
        (await packages.GetAccessAsync(_child)).PackageCode.ShouldBe("temel");
        clock.Advance(TimeSpan.FromDays(30));
        (await packages.GetAccessAsync(_child)).Tier.ShouldBe(0);
    }

    [SkippableFact]
    public async Task The_free_trial_is_one_week_of_Plus_once_per_student()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        await using var db = await CreateDbAsync();
        var packages = CreateService(db, clock);

        (await packages.GetAccessAsync(_child)).TrialAvailable.ShouldBeTrue();
        var trial = (await packages.StartTrialAsync(_child, _parent)).Value!;
        (trial.PackageCode, trial.TrialAvailable).ShouldBe(("plus", false));
        (await packages.StartTrialAsync(_child, _parent)).Status.ShouldBe(LearnerResultStatus.Conflict);

        clock.Advance(TimeSpan.FromDays(8));
        var after = await packages.GetAccessAsync(_child);
        (after.Tier, after.TrialAvailable).ShouldBe((0, false));
        (await packages.StartTrialAsync(_child, _parent)).Status.ShouldBe(LearnerResultStatus.Conflict);
    }

    [SkippableFact]
    public async Task Orders_can_be_cancelled_or_rejected_while_open_and_unpaid_orders_are_capped()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        await using var db = await CreateDbAsync();
        var packages = CreateService(db, clock);

        var first = (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "temel", LearnerTerm.Month1), Payer())).Value!;
        (await packages.CancelOrderAsync(first.Id, Guid.NewGuid())).Status.ShouldBe(LearnerResultStatus.NotFound);
        (await packages.CancelOrderAsync(first.Id, _parent)).Value!.Status.ShouldBe(LearnerOrderStatus.Canceled);

        var second = (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "temel", LearnerTerm.Month1), Payer())).Value!;
        (await packages.RejectAsync(second.Id, _admin, " ")).Status.ShouldBe(LearnerResultStatus.Invalid);
        var rejected = (await packages.RejectAsync(second.Id, _admin, "Tutar eksik geldi")).Value!;
        (rejected.Status, rejected.RejectReason).ShouldBe((LearnerOrderStatus.Rejected, "Tutar eksik geldi"));
        (await packages.ApproveAsync(second.Id, _admin)).Status.ShouldBe(LearnerResultStatus.Conflict);
        (await packages.GetAccessAsync(_child)).Tier.ShouldBe(0);

        for (var i = 0; i < 5; i++)
        {
            (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "temel", LearnerTerm.Month1), Payer())).IsOk.ShouldBeTrue();
        }

        (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "temel", LearnerTerm.Month1), Payer())).Status
            .ShouldBe(LearnerResultStatus.Conflict);
        (await packages.GetOrdersByPayerAsync(_parent)).Count.ShouldBe(7);
        (await packages.AdminListOrdersAsync(LearnerOrderStatus.Pending, new PagedRequest(1, 50))).TotalCount.ShouldBe(5);
    }

    [SkippableFact]
    public async Task The_summer_package_sells_in_summer_and_ends_in_mid_September()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        await using var db = await CreateDbAsync();
        var packages = CreateService(db, clock);

        (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, "plus", LearnerTerm.Summer), Payer())).Status
            .ShouldBe(LearnerResultStatus.Invalid, "not on sale in November");

        clock.Set(new DateTimeOffset(2027, 6, 20, 9, 0, 0, TimeSpan.Zero));
        await BuyAsync(packages, "plus", LearnerTerm.Summer);
        var access = await packages.GetAccessAsync(_child);
        access.EndsAt.ShouldBe(new DateTime(2027, 9, 15, 20, 59, 59, DateTimeKind.Utc), "23:59:59 in Istanbul");
    }

    [SkippableFact]
    public async Task Administrators_edit_the_catalogue_and_the_seed_does_not_overwrite_it()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var clock = new TestClock(November);
        var (db, services) = await CreateDbWithServicesAsync();
        await using var _ = db;
        var packages = CreateService(db, clock);

        (await packages.UpdatePackageAsync("temel", new UpdateLearnerPackageRequest("Temel", "x", ["bilinmeyen"], 3, true, 1))).Status
            .ShouldBe(LearnerResultStatus.Invalid);
        (await packages.UpdatePackageAsync("temel", new UpdateLearnerPackageRequest("Başlangıç", "x", [LearnerFeatures.PremiumContent], 5, true, 1))).IsOk
            .ShouldBeTrue();
        var priced = (await packages.SetPricesAsync("temel", new SetLearnerPricesRequest([new LearnerPriceDto(LearnerTerm.Month1, 30, 199m, "TRY", true)]))).Value!;
        priced.Prices.Single(p => p.Term == LearnerTerm.Month1).Price.ShouldBe(199m);

        await SubscriptionDataSeeder.SeedAsync(services);
        db.ChangeTracker.Clear();
        var temel = (await packages.GetCatalogAsync(includeInactive: true)).Single(p => p.Code == "temel");
        (temel.Name, temel.PracticeTestsPerDay).ShouldBe(("Başlangıç", 5));
        temel.Prices.Single(p => p.Term == LearnerTerm.Month1).Price.ShouldBe(199m);

        var grant = (await packages.GrantAsync(new GrantLearnerPassRequest(_child, "premium", 14), _admin)).Value!;
        (grant.Source, grant.EndsAt).ShouldBe((LearnerPassSource.AdminGrant, November.UtcDateTime.AddDays(14)));
    }

    [SkippableFact]
    public async Task A_paid_teacher_plan_ends_with_its_period_and_is_marked_paid_only_once()
    {
        Skip.If(!_postgres.Available, "Docker is not available for Testcontainers.");

        var (db, _) = await CreateDbWithServicesAsync();
        await using var __ = db;
        var teacher = Guid.NewGuid();
        var subscriptions = new SubscriptionManagementService(
            db, new SubscriberResolver(db), new ManualPaymentProvider(),
            Options.Create(new TrialOptions()), NullLogger<SubscriptionManagementService>.Instance);

        (await subscriptions.GetMySubscriptionAsync(teacher)).Plan.Code.ShouldBe("free");
        var checkout = await subscriptions.CreateCheckoutAsync(teacher, new CheckoutRequest("pro", BillingCycle.Monthly));
        (await subscriptions.AdminMarkOrderPaidAsync(checkout.OrderId)).ShouldBe(OrderDecision.Done);
        (await subscriptions.AdminMarkOrderPaidAsync(checkout.OrderId)).ShouldBe(OrderDecision.NotPending);
        (await subscriptions.AdminRejectOrderAsync(checkout.OrderId)).ShouldBe(OrderDecision.NotPending);
        (await subscriptions.AdminMarkOrderPaidAsync(Guid.NewGuid())).ShouldBe(OrderDecision.NotFound);
        (await subscriptions.GetMySubscriptionAsync(teacher)).Plan.Code.ShouldBe("pro");
        (await subscriptions.GetEntitlementsAsync(teacher)).Features.ShouldContain(f => f.FeatureCode == "live_class" && f.IsEnabled);

        // The paid month runs out without another payment: back to free, not another free month of Pro.
        var sub = await db.Subscriptions.SingleAsync(s => s.SubscriberId == teacher);
        sub.CurrentPeriodEnd = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        (await subscriptions.GetMySubscriptionAsync(teacher)).Plan.Code.ShouldBe("free");
    }

    private async Task BuyAsync(LearnerPackageService packages, string code, LearnerTerm term)
    {
        var order = (await packages.CreateOrderAsync(new CreateLearnerOrderRequest(_child, code, term), Payer())).Value!;
        (await packages.ApproveAsync(order.Id, _admin)).IsOk.ShouldBeTrue();
    }

    private PaymentBuyer Payer() => new(_parent, "Veli", null, null);

    private static LearnerPackageService CreateService(SubscriptionDbContext db, TimeProvider clock) =>
        new(db,
            new BankTransferPaymentProvider(Options.Create(new BankTransferOptions { BankName = "Banka", AccountHolder = "YZ Kampüs", Iban = "TR00 0000" })),
            Options.Create(new LearnerOptions()),
            clock,
            NullLogger<LearnerPackageService>.Instance);

    private async Task<SubscriptionDbContext> CreateDbAsync() => (await CreateDbWithServicesAsync()).Db;

    /// <summary>A fresh database per test, migrated and seeded by the real seeder.</summary>
    private async Task<(SubscriptionDbContext Db, IServiceProvider Services)> CreateDbWithServicesAsync()
    {
        var connection = _postgres.ConnectionStringFor("learner_" + Guid.NewGuid().ToString("N")[..12]);
        var services = new ServiceCollection()
            .AddLogging()
            .AddDbContext<SubscriptionDbContext>(o => o.UseNpgsql(connection))
            .BuildServiceProvider();

        await using (var scope = services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<SubscriptionDbContext>().Database.MigrateAsync();
        }

        await SubscriptionDataSeeder.SeedAsync(services);
        return (new SubscriptionDbContext(new DbContextOptionsBuilder<SubscriptionDbContext>().UseNpgsql(connection).Options), services);
    }
}

/// <summary>A clock tests move by hand.</summary>
internal sealed class TestClock : TimeProvider
{
    private DateTimeOffset _now;

    public TestClock(DateTimeOffset start) => _now = start;

    public DateTime Now => _now.UtcDateTime;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;

    public void Set(DateTimeOffset to) => _now = to;
}
