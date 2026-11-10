using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ContentService.Kampus.Data;

/// <summary>
/// YZ Kampüs learner progress and motivation. Lives in ContentService's database next to the curriculum,
/// but in its own context and migration history (<c>__kampus_migrations</c>), so it can move to a service of
/// its own later without untangling it from the catalog tables.
/// </summary>
public class KampusDbContext : DbContext
{
    public const string MigrationsHistoryTable = "__kampus_migrations";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public KampusDbContext(DbContextOptions<KampusDbContext> options) : base(options) { }

    public DbSet<KampusWallet> Wallets => Set<KampusWallet>();
    public DbSet<KampusReward> Rewards => Set<KampusReward>();
    public DbSet<KampusStopCompletion> StopCompletions => Set<KampusStopCompletion>();
    public DbSet<KampusActivity> Activities => Set<KampusActivity>();
    public DbSet<KampusTopicAnswers> TopicAnswers => Set<KampusTopicAnswers>();
    public DbSet<KampusInProgress> InProgress => Set<KampusInProgress>();
    public DbSet<KampusMiniTest> MiniTests => Set<KampusMiniTest>();
    public DbSet<KampusTopicAttempt> TopicAttempts => Set<KampusTopicAttempt>();
    public DbSet<KampusCollectionEntry> Collection => Set<KampusCollectionEntry>();
    public DbSet<KampusBookState> Books => Set<KampusBookState>();
    public DbSet<KampusCupEntry> CupEntries => Set<KampusCupEntry>();
    public DbSet<KampusCupResult> CupResults => Set<KampusCupResult>();
    public DbSet<KampusAvatar> Avatars => Set<KampusAvatar>();
    public DbSet<KampusOwnedItem> OwnedItems => Set<KampusOwnedItem>();
    public DbSet<KampusAssignment> Assignments => Set<KampusAssignment>();
    public DbSet<KampusExam> Exams => Set<KampusExam>();
    public DbSet<KampusExamResult> ExamResults => Set<KampusExamResult>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<KampusWallet>(e =>
        {
            e.ToTable("kampus_wallets");
            e.HasKey(x => x.StudentId);
            e.Property(x => x.Nick).HasMaxLength(64);
        });

        modelBuilder.Entity<KampusReward>(e =>
        {
            e.ToTable("kampus_rewards");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).IsRequired().HasMaxLength(32);
            e.Property(x => x.Ref).IsRequired().HasMaxLength(200);
            e.HasIndex(x => new { x.StudentId, x.Kind, x.Ref }).IsUnique();
            e.HasIndex(x => new { x.StudentId, x.Day });
            e.HasIndex(x => new { x.StudentId, x.Week });
        });

        modelBuilder.Entity<KampusStopCompletion>(e =>
        {
            e.ToTable("kampus_stop_completions");
            e.HasKey(x => new { x.StudentId, x.TopicId, x.StopId });
            e.Property(x => x.TopicId).HasMaxLength(100);
            e.Property(x => x.StopId).HasMaxLength(32);
        });

        modelBuilder.Entity<KampusActivity>(e =>
        {
            e.ToTable("kampus_activities");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).IsRequired().HasMaxLength(32);
            e.Property(x => x.Ref).IsRequired().HasMaxLength(100);
            e.Property(x => x.StopId).HasMaxLength(32);
            e.HasIndex(x => new { x.StudentId, x.Day });
            e.HasIndex(x => new { x.StudentId, x.Week });
        });

        modelBuilder.Entity<KampusTopicAnswers>(e =>
        {
            e.ToTable("kampus_topic_answers");
            e.HasKey(x => new { x.StudentId, x.TopicId });
            e.Property(x => x.TopicId).HasMaxLength(100);
            JsonColumn(e.Property(x => x.Answers));
        });

        modelBuilder.Entity<KampusInProgress>(e =>
        {
            e.ToTable("kampus_in_progress");
            e.HasKey(x => x.StudentId);
            e.Property(x => x.TopicId).HasMaxLength(100);
            e.Property(x => x.StopId).HasMaxLength(32);
        });

        modelBuilder.Entity<KampusMiniTest>(e =>
        {
            e.ToTable("kampus_minitests");
            e.HasKey(x => new { x.StudentId, x.TopicId });
            e.Property(x => x.TopicId).HasMaxLength(100);
            JsonColumn(e.Property(x => x.Answers));
        });

        modelBuilder.Entity<KampusTopicAttempt>(e =>
        {
            e.ToTable("kampus_topic_attempts");
            e.HasKey(x => x.Id);
            e.Property(x => x.TopicId).HasMaxLength(100);
            e.HasIndex(x => new { x.StudentId, x.TopicId });
            JsonColumn(e.Property(x => x.Answers));
        });

        modelBuilder.Entity<KampusCollectionEntry>(e =>
        {
            e.ToTable("kampus_collection");
            e.HasKey(x => new { x.StudentId, x.TopicId });
            e.Property(x => x.TopicId).HasMaxLength(100);
        });

        modelBuilder.Entity<KampusBookState>(e =>
        {
            e.ToTable("kampus_books");
            e.HasKey(x => new { x.StudentId, x.BookId });
            e.Property(x => x.BookId).HasMaxLength(100);
            JsonColumn(e.Property(x => x.Answers));
        });

        modelBuilder.Entity<KampusCupEntry>(e =>
        {
            e.ToTable("kampus_cup_entries");
            e.HasKey(x => new { x.Week, x.StudentId });
            e.Property(x => x.Nick).IsRequired().HasMaxLength(64);
            e.Property(x => x.Emoji).HasMaxLength(16);
            e.HasIndex(x => new { x.Week, x.Grade, x.Seq }).IsUnique();
            e.HasIndex(x => new { x.Week, x.Grade, x.GroupNo, x.Nick }).IsUnique();
        });

        modelBuilder.Entity<KampusCupResult>(e =>
        {
            e.ToTable("kampus_cup_results");
            e.HasKey(x => new { x.StudentId, x.Week });
            e.Property(x => x.CupId).HasMaxLength(64);
        });

        modelBuilder.Entity<KampusAvatar>(e =>
        {
            e.ToTable("kampus_avatars");
            e.HasKey(x => x.StudentId);
            JsonColumn(e.Property(x => x.Config));
            JsonColumn(e.Property(x => x.Equipped));
        });

        modelBuilder.Entity<KampusOwnedItem>(e =>
        {
            e.ToTable("kampus_owned_items");
            e.HasKey(x => new { x.StudentId, x.ItemId });
            e.Property(x => x.ItemId).HasMaxLength(64);
        });

        modelBuilder.Entity<KampusAssignment>(e =>
        {
            e.ToTable("kampus_assignments");
            e.HasKey(x => x.Id);
            e.Property(x => x.TopicId).IsRequired().HasMaxLength(100);
            e.Property(x => x.Title).HasMaxLength(200);
            e.HasIndex(x => x.ClassroomId);
            e.HasIndex(x => x.TeacherId);
        });

        modelBuilder.Entity<KampusExam>(e =>
        {
            e.ToTable("kampus_exams");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).IsRequired().HasMaxLength(16);
            e.Property(x => x.Title).IsRequired().HasMaxLength(200);
            e.Property(x => x.Subject).HasMaxLength(32);
            e.Property(x => x.ThemeTitle).HasMaxLength(200);
            e.Property(x => x.AssignedBy).HasMaxLength(200);
            e.HasIndex(x => x.Grade);
            e.HasIndex(x => x.TeacherId);
            JsonColumn(e.Property(x => x.Questions));
        });

        modelBuilder.Entity<KampusExamResult>(e =>
        {
            e.ToTable("kampus_exam_results");
            e.HasKey(x => new { x.StudentId, x.ExamId });
            e.HasIndex(x => x.ExamId);
            JsonColumn(e.Property(x => x.Answers));
        });
    }

    /// <summary>Stores a value as jsonb, compared by its serialized form so in-place edits are saved.</summary>
    private static void JsonColumn<T>(PropertyBuilder<T> property) where T : class, new()
    {
        property
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, Json),
                v => JsonSerializer.Deserialize<T>(v, Json) ?? new T(),
                new ValueComparer<T>(
                    (a, b) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(b, Json),
                    v => JsonSerializer.Serialize(v, Json).GetHashCode(StringComparison.Ordinal),
                    v => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v, Json), Json)!));
    }
}
