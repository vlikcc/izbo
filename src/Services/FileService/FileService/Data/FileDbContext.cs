using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Shared.Models;

namespace FileService.Data;

public class FileDbContext : DbContext
{
    public FileDbContext(DbContextOptions<FileDbContext> options) : base(options) { }

    public DbSet<FileMetadata> Files { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.ConfigureWarnings(warnings =>
            warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<FileMetadata>(entity =>
        {
            entity.ToTable("files");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FileName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.ContentType).HasMaxLength(100);
            entity.Property(e => e.Type).HasConversion<string>();
            entity.HasIndex(e => e.UploadedBy);
            entity.HasIndex(e => e.EntityId);
            // Ignore User navigation - User is in different database.
            // Left mapped, EF pulled the whole shared User entity into this service: it built a User
            // table inside eduplatform_file plus a files.UploaderId foreign key pointing at it, and
            // every later change to Shared.Models.User silently drifted this service's schema. The
            // uploader is referenced by UploadedBy, which is the id and needs no navigation.
            entity.Ignore(e => e.Uploader);
        });
    }
}
