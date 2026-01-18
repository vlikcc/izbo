using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace ClassroomService.Data;

public class ClassroomDbContext : DbContext
{
    public ClassroomDbContext(DbContextOptions<ClassroomDbContext> options) : base(options) { }

    public DbSet<Classroom> Classrooms { get; set; }
    public DbSet<Enrollment> Enrollments { get; set; }
    public DbSet<ClassSession> ClassSessions { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Classroom>(entity =>
        {
            entity.ToTable("classrooms");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.InstructorId);
            entity.HasIndex(e => e.IsActive);
            // Ignore User navigation - User is in different database
            entity.Ignore(e => e.Instructor);
        });

        modelBuilder.Entity<Enrollment>(entity =>
        {
            entity.ToTable("enrollments");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ClassroomId, e.StudentId }).IsUnique();
            entity.HasOne(e => e.Classroom)
                .WithMany(c => c.Enrollments)
                .HasForeignKey(e => e.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);
            // Ignore User navigation - User is in different database
            entity.Ignore(e => e.Student);
        });

        modelBuilder.Entity<ClassSession>(entity =>
        {
            entity.ToTable("class_sessions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasOne(e => e.Classroom)
                .WithMany(c => c.Sessions)
                .HasForeignKey(e => e.ClassroomId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.ClassroomId, e.ScheduledStartTime });
            entity.HasIndex(e => e.Status);
        });
    }
}
