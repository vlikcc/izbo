using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Audit;
using Shared.Models;
using UserService.Services.Promotion;

namespace UserService.Data;

public class UserDbContext : DbContext, IAuditDbContext
{
    public UserDbContext(DbContextOptions<UserDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<AuditEvent> AuditEvents { get; set; }
    public DbSet<GuardianLink> GuardianLinks { get; set; }
    public DbSet<GuardianLinkCode> GuardianLinkCodes { get; set; }
    public DbSet<PromotionRun> PromotionRuns { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.Username).HasMaxLength(32);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Role).HasConversion<string>();
            entity.Property(e => e.ExamTarget).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => e.Email).IsUnique().HasFilter("\"Email\" IS NOT NULL");
            entity.HasIndex(e => e.Username).IsUnique().HasFilter("\"Username\" IS NOT NULL");
            entity.HasIndex(e => e.Role);
        });

        modelBuilder.Entity<GuardianLink>(entity =>
        {
            entity.ToTable("guardian_links");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ParentId, e.StudentId }).IsUnique();
            entity.HasIndex(e => e.StudentId);
        });

        modelBuilder.Entity<GuardianLinkCode>(entity =>
        {
            entity.ToTable("guardian_link_codes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CodeHash).IsRequired().HasMaxLength(64);
            entity.HasIndex(e => e.CodeHash).IsUnique();
            entity.HasIndex(e => e.StudentId);
        });

        modelBuilder.Entity<PromotionRun>(entity =>
        {
            entity.ToTable("promotion_runs");
            entity.HasKey(e => e.Year);
            entity.Property(e => e.Year).ValueGeneratedNever();
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.ToTable("audit_events");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OccurredAt);
            entity.Property(e => e.Action).HasMaxLength(64);
            entity.Property(e => e.EntityType).HasMaxLength(64);
        });
    }
}
