using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace ContentService.Data;

public class ContentDbContext : DbContext
{
    public ContentDbContext(DbContextOptions<ContentDbContext> options) : base(options) { }

    public DbSet<Level> Levels { get; set; }
    public DbSet<Subject> Subjects { get; set; }
    public DbSet<CurriculumUnit> Units { get; set; }
    public DbSet<Topic> Topics { get; set; }
    public DbSet<LearningOutcome> LearningOutcomes { get; set; }
    public DbSet<ContentItem> ContentItems { get; set; }
    public DbSet<ContentItemOutcome> ContentItemOutcomes { get; set; }
    public DbSet<ContentProgress> Progress { get; set; }
    public DbSet<BankQuestion> BankQuestions { get; set; }
    public DbSet<QuestionAsset> QuestionAssets { get; set; }
    public DbSet<Assessment> Assessments { get; set; }
    public DbSet<AssessmentSection> AssessmentSections { get; set; }
    public DbSet<AssessmentQuestion> AssessmentQuestions { get; set; }
    public DbSet<Attempt> Attempts { get; set; }
    public DbSet<AttemptItem> AttemptItems { get; set; }

    private static readonly JsonSerializerOptions OptionJson = new(JsonSerializerDefaults.Web);

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Level>(entity =>
        {
            entity.ToTable("levels");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(32);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasData(CurriculumSeed.Levels);
        });

        modelBuilder.Entity<Subject>(entity =>
        {
            entity.ToTable("subjects");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Color).IsRequired().HasMaxLength(16);
            entity.HasOne(e => e.Level)
                .WithMany(l => l.Subjects)
                .HasForeignKey(e => e.LevelId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.LevelId, e.Slug }).IsUnique();
            entity.HasData(CurriculumSeed.Subjects);
        });

        modelBuilder.Entity<CurriculumUnit>(entity =>
        {
            entity.ToTable("units");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.HasOne(e => e.Subject)
                .WithMany(s => s.Units)
                .HasForeignKey(e => e.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.SubjectId, e.Order });
        });

        modelBuilder.Entity<Topic>(entity =>
        {
            entity.ToTable("topics");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.HasOne(e => e.Unit)
                .WithMany(u => u.Topics)
                .HasForeignKey(e => e.UnitId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UnitId, e.Slug }).IsUnique();
        });

        modelBuilder.Entity<LearningOutcome>(entity =>
        {
            entity.ToTable("learning_outcomes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(64);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(2000);
            entity.HasOne(e => e.Topic)
                .WithMany(t => t.Outcomes)
                .HasForeignKey(e => e.TopicId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.TopicId, e.Code }).IsUnique();
        });

        modelBuilder.Entity<ContentItem>(entity =>
        {
            entity.ToTable("content_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(4000);
            entity.Property(e => e.Type).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.AccessTier).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.OwnerKind).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ProcessingStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ReviewNote).HasMaxLength(2000);
            entity.Property(e => e.ProcessingError).HasMaxLength(2000);
            entity.Property(e => e.StorageKey).HasMaxLength(512);
            entity.Property(e => e.OriginalFileName).HasMaxLength(255);
            entity.Property(e => e.FileContentType).HasMaxLength(128);
            entity.Property(e => e.HlsPrefix).HasMaxLength(512);
            entity.Property(e => e.ThumbnailKey).HasMaxLength(512);
            entity.Property(e => e.EmbedUrl).HasMaxLength(2048);
            entity.Ignore(e => e.IsVideo);
            entity.Ignore(e => e.IsDocument);

            // Content outlives curriculum edits: a topic cannot be deleted while items still hang off it.
            entity.HasOne(e => e.Topic)
                .WithMany(t => t.Items)
                .HasForeignKey(e => e.TopicId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TopicId, e.Status });
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.ProcessingStatus);
        });

        modelBuilder.Entity<ContentItemOutcome>(entity =>
        {
            entity.ToTable("content_item_outcomes");
            entity.HasKey(e => new { e.ContentItemId, e.LearningOutcomeId });
            entity.HasOne(e => e.ContentItem)
                .WithMany(i => i.Outcomes)
                .HasForeignKey(e => e.ContentItemId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.LearningOutcome)
                .WithMany()
                .HasForeignKey(e => e.LearningOutcomeId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.LearningOutcomeId);
        });

        modelBuilder.Entity<ContentProgress>(entity =>
        {
            entity.ToTable("content_progress");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.ContentItem)
                .WithMany()
                .HasForeignKey(e => e.ContentItemId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.ContentItemId }).IsUnique();
            entity.HasIndex(e => new { e.UserId, e.UpdatedAt });
        });

        modelBuilder.Entity<BankQuestion>(entity =>
        {
            entity.ToTable("bank_questions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Difficulty).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.OwnerKind).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Stem).IsRequired().HasMaxLength(8000);
            entity.Property(e => e.CorrectKey).IsRequired().HasMaxLength(1);
            entity.Property(e => e.Explanation).IsRequired().HasMaxLength(8000);
            entity.Property(e => e.ReviewNote).HasMaxLength(2000);

            // Options are always read and written with their question, so they live in one jsonb column.
            entity.Property(e => e.Options)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, OptionJson),
                    v => JsonSerializer.Deserialize<List<BankQuestionOption>>(v, OptionJson) ?? new List<BankQuestionOption>(),
                    new ValueComparer<List<BankQuestionOption>>(
                        (a, b) => a!.SequenceEqual(b!),
                        v => v.Aggregate(0, (hash, option) => HashCode.Combine(hash, option.GetHashCode())),
                        v => v.ToList()));

            // Like content, questions outlive curriculum edits: a topic with questions cannot be deleted.
            entity.HasOne(e => e.Topic)
                .WithMany()
                .HasForeignKey(e => e.TopicId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.LearningOutcome)
                .WithMany()
                .HasForeignKey(e => e.LearningOutcomeId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.SolutionVideo)
                .WithMany()
                .HasForeignKey(e => e.SolutionVideoItemId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.TopicId, e.Status });
            entity.HasIndex(e => e.LearningOutcomeId);
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<QuestionAsset>(entity =>
        {
            entity.ToTable("question_assets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StorageKey).IsRequired().HasMaxLength(512);
            entity.Property(e => e.ContentType).IsRequired().HasMaxLength(64);
            entity.HasIndex(e => e.OwnerId);
        });

        modelBuilder.Entity<Assessment>(entity =>
        {
            entity.ToTable("assessments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ScoringRule).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.AccessTier).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(4000);
            entity.HasOne(e => e.Level)
                .WithMany()
                .HasForeignKey(e => e.LevelId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => new { e.Status, e.LevelId });
            entity.HasIndex(e => e.WindowEnd);
        });

        modelBuilder.Entity<AssessmentSection>(entity =>
        {
            entity.ToTable("assessment_sections");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.HasOne(e => e.Assessment)
                .WithMany(a => a.Sections)
                .HasForeignKey(e => e.AssessmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Subject)
                .WithMany()
                .HasForeignKey(e => e.SubjectId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(e => new { e.AssessmentId, e.Order });
        });

        modelBuilder.Entity<AssessmentQuestion>(entity =>
        {
            entity.ToTable("assessment_questions");
            entity.HasKey(e => new { e.AssessmentId, e.QuestionId });
            entity.HasOne(e => e.Assessment)
                .WithMany(a => a.Questions)
                .HasForeignKey(e => e.AssessmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Section)
                .WithMany()
                .HasForeignKey(e => e.SectionId)
                .OnDelete(DeleteBehavior.Cascade);

            // A question inside a test cannot be deleted; it can be unpublished.
            entity.HasOne(e => e.Question)
                .WithMany()
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.QuestionId);
        });

        modelBuilder.Entity<Attempt>(entity =>
        {
            entity.ToTable("attempts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Scope).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.ScoringRule).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Net).HasPrecision(8, 2);
            entity.Property(e => e.Percent).HasPrecision(5, 2);
            entity.Property(e => e.TopPercent).HasPrecision(5, 2);
            entity.HasOne(e => e.Assessment)
                .WithMany()
                .HasForeignKey(e => e.AssessmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // One sitting per curated test; generated tests can be repeated.
            entity.HasIndex(e => new { e.UserId, e.AssessmentId })
                .IsUnique()
                .HasFilter("assessment_id IS NOT NULL");
            entity.HasIndex(e => new { e.UserId, e.StartedAt });
            entity.HasIndex(e => new { e.Status, e.Deadline });
            entity.HasIndex(e => new { e.AssessmentId, e.IsRanked });
        });

        modelBuilder.Entity<AttemptItem>(entity =>
        {
            entity.ToTable("attempt_items");
            entity.HasKey(e => new { e.AttemptId, e.Order });
            entity.Property(e => e.CorrectKey).IsRequired().HasMaxLength(1);
            entity.Property(e => e.SelectedKey).HasMaxLength(1);
            entity.HasOne(e => e.Attempt)
                .WithMany(a => a.Items)
                .HasForeignKey(e => e.AttemptId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Question)
                .WithMany()
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(e => e.QuestionId);
            entity.HasIndex(e => e.TopicId);
        });

        ApplySnakeCaseColumnNames(modelBuilder);
    }

    /// <summary>
    /// Columns are snake_case so the raw SQL in the transcode queue and progress upsert reads like the
    /// rest of the schema. Applied after configuration so every property, including keys, is covered.
    /// </summary>
    private static void ApplySnakeCaseColumnNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    internal static string ToSnakeCase(string name)
    {
        var builder = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && (char.IsLower(name[i - 1]) || (i + 1 < name.Length && char.IsLower(name[i + 1]) && char.IsUpper(name[i - 1]))))
                {
                    builder.Append('_');
                }

                builder.Append(char.ToLowerInvariant(c));
            }
            else
            {
                builder.Append(c);
            }
        }

        return builder.ToString();
    }
}
