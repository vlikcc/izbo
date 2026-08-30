using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace SubscriptionService.Data;

public class SubscriptionDbContext : DbContext
{
    public SubscriptionDbContext(DbContextOptions<SubscriptionDbContext> options) : base(options) { }

    public DbSet<Plan> Plans { get; set; }
    public DbSet<PlanLimit> PlanLimits { get; set; }
    public DbSet<PlanFeature> PlanFeatures { get; set; }
    public DbSet<Organization> Organizations { get; set; }
    public DbSet<OrganizationMember> OrganizationMembers { get; set; }
    public DbSet<Subscription> Subscriptions { get; set; }
    public DbSet<UsageCounter> UsageCounters { get; set; }
    public DbSet<SubscriptionOrder> SubscriptionOrders { get; set; }
    public DbSet<SubscriptionEvent> SubscriptionEvents { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Plan>(entity =>
        {
            entity.ToTable("plans");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Code).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PriceMonthly).HasColumnType("numeric(10,2)");
            entity.Property(e => e.PriceYearly).HasColumnType("numeric(10,2)");
            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.TargetSubscriberType).HasConversion<string>();
            entity.HasMany(e => e.Limits)
                .WithOne(e => e.Plan)
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.Features)
                .WithOne(e => e.Plan)
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlanLimit>(entity =>
        {
            entity.ToTable("plan_limits");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Metric).HasConversion<string>();
            entity.Property(e => e.Period).HasConversion<string>();
            entity.HasIndex(e => new { e.PlanId, e.Metric }).IsUnique();
        });

        modelBuilder.Entity<PlanFeature>(entity =>
        {
            entity.ToTable("plan_features");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FeatureCode).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => new { e.PlanId, e.FeatureCode }).IsUnique();
        });

        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasMany(e => e.Members)
                .WithOne(e => e.Organization)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationMember>(entity =>
        {
            entity.ToTable("organization_members");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.OrgRole).HasConversion<string>();
            entity.HasIndex(e => new { e.OrganizationId, e.UserId }).IsUnique();
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.ToTable("subscriptions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SubscriberType).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasIndex(e => new { e.SubscriberType, e.SubscriberId }).IsUnique();
            entity.HasOne(e => e.Plan)
                .WithMany()
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UsageCounter>(entity =>
        {
            entity.ToTable("usage_counters");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SubscriberType).HasConversion<string>();
            entity.Property(e => e.Metric).HasConversion<string>();
            entity.HasIndex(e => new { e.SubscriberType, e.SubscriberId, e.Metric, e.PeriodStart }).IsUnique();
        });

        modelBuilder.Entity<SubscriptionOrder>(entity =>
        {
            entity.ToTable("subscription_orders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Cycle).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.Amount).HasColumnType("numeric(10,2)");
            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.Provider).HasMaxLength(50);
            entity.HasIndex(e => e.SubscriptionId);
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<SubscriptionEvent>(entity =>
        {
            entity.ToTable("subscription_events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SubscriberType).HasConversion<string>();
            entity.Property(e => e.Type).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => new { e.SubscriberType, e.SubscriberId });
        });
    }
}
