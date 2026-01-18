using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace ExamService.Data;

public class ExamDbContext : DbContext
{
    public ExamDbContext(DbContextOptions<ExamDbContext> options) : base(options) { }

    public DbSet<Exam> Exams { get; set; }
    public DbSet<Question> Questions { get; set; }
    public DbSet<ExamSession> ExamSessions { get; set; }
    public DbSet<Answer> Answers { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Exam>(entity =>
        {
            entity.ToTable("exams");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasIndex(e => e.ClassroomId);
            entity.HasIndex(e => e.StartTime);
            entity.HasIndex(e => e.Status);
            // Ignore Classroom navigation - Classroom is in different database
            entity.Ignore(e => e.Classroom);
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("questions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type).HasConversion<string>();
            entity.Property(e => e.Content).IsRequired();
            entity.HasOne(e => e.Exam)
                .WithMany(e => e.Questions)
                .HasForeignKey(e => e.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.ExamId, e.OrderIndex });
        });

        modelBuilder.Entity<ExamSession>(entity =>
        {
            entity.ToTable("exam_sessions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasOne(e => e.Exam)
                .WithMany(e => e.Sessions)
                .HasForeignKey(e => e.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.ExamId, e.StudentId }).IsUnique();
            entity.HasIndex(e => e.Status);
            // Ignore User navigation - User is in different database
            entity.Ignore(e => e.Student);
        });

        modelBuilder.Entity<Answer>(entity =>
        {
            entity.ToTable("answers");
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Session)
                .WithMany(e => e.Answers)
                .HasForeignKey(e => e.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Question)
                .WithMany(e => e.Answers)
                .HasForeignKey(e => e.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.SessionId, e.QuestionId }).IsUnique();
        });
    }
}
