using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace HomeworkService.Data;

public class HomeworkDbContext : DbContext
{
    public HomeworkDbContext(DbContextOptions<HomeworkDbContext> options) : base(options) { }

    public DbSet<Homework> Homeworks { get; set; }
    public DbSet<HomeworkSubmission> Submissions { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Homework>(entity =>
        {
            entity.ToTable("homeworks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.ClassroomId);
            entity.HasIndex(e => e.DueDate);
            // Ignore Classroom navigation - Classroom is in different database
            entity.Ignore(e => e.Classroom);
        });

        modelBuilder.Entity<HomeworkSubmission>(entity =>
        {
            entity.ToTable("homework_submissions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasOne(e => e.Homework)
                .WithMany(h => h.Submissions)
                .HasForeignKey(e => e.HomeworkId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.HomeworkId, e.StudentId }).IsUnique();
            entity.HasIndex(e => e.Status);
            // Ignore User navigation - User is in different database
            entity.Ignore(e => e.Student);
        });
    }
}
