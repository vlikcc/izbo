using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Audit;
using Shared.Messaging;
using Shared.Models;
using AuthService.Models;

namespace AuthService.Data;

public class AuthDbContext : DbContext, IAuditDbContext
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
    public DbSet<OutboxMessage> OutboxMessages { get; set; }
    public DbSet<AuditEvent> AuditEvents { get; set; }
    public DbSet<NationalIdCredential> NationalIdCredentials { get; set; }
    public DbSet<NationalIdLoginThrottle> NationalIdLoginThrottles { get; set; }

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
            // Child accounts have no address and sign in by user name instead; both keys are unique when set.
            entity.HasIndex(e => e.Email).IsUnique().HasFilter("\"Email\" IS NOT NULL");
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.HasIndex(e => e.Username).IsUnique().HasFilter("\"Username\" IS NOT NULL");
            entity.Property(e => e.Username).HasMaxLength(32);
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Role).HasConversion<string>();

            // School profile lives in UserService; the account only carries it to the first mirror.
            entity.Ignore(e => e.GradeLevel);
            entity.Ignore(e => e.ExamTarget);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
            entity.Property(e => e.RevokedReason).HasMaxLength(32);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.UserAgent).HasMaxLength(256);

            entity.HasIndex(e => e.ReplacedByTokenId);
            entity.HasIndex(e => new { e.UserId, e.IsRevoked });

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailVerificationToken>(entity =>
        {
            entity.ToTable("email_verification_tokens");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("password_reset_tokens");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
        });

        modelBuilder.Entity<OutboxMessage>(entity =>
        {
            entity.ToTable("outbox_messages");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ProcessedAt);
            entity.Property(e => e.Type).HasMaxLength(64);
        });

        // T.C. Kimlik No: only a keyed hash and ciphertext are stored (KVKK), in tables of their own so the
        // shared User model other services map stays unchanged.
        modelBuilder.Entity<NationalIdCredential>(entity =>
        {
            entity.ToTable("national_id_credentials");
            entity.HasKey(e => e.UserId);
            entity.HasIndex(e => e.LookupHash).IsUnique();
            entity.Property(e => e.LookupHash).IsRequired().HasMaxLength(64);
            entity.Property(e => e.Ciphertext).IsRequired().HasMaxLength(128);
            entity.HasOne<User>().WithOne().HasForeignKey<NationalIdCredential>(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NationalIdLoginThrottle>(entity =>
        {
            entity.ToTable("national_id_login_throttles");
            entity.HasKey(e => e.LookupHash);
            entity.Property(e => e.LookupHash).HasMaxLength(64);
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
