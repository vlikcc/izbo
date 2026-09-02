using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FileService.Migrations
{
    /// <summary>
    /// Removes the User table EF built inside eduplatform_file. FileMetadata.Uploader was left mapped,
    /// so the shared User entity was pulled into this service's model: a User table nobody ever wrote
    /// to (0 rows), and a files.UploaderId foreign key pointing at it that no code ever set. Every
    /// column added to Shared.Models.User drifted this service's schema, which is what broke CI.
    /// Dropping them loses nothing — the uploader is identified by files.UploadedBy.
    /// </summary>
    /// <inheritdoc />
    public partial class DropPhantomUserTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_files_User_UploaderId",
                table: "files");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropIndex(
                name: "IX_files_UploaderId",
                table: "files");

            migrationBuilder.DropColumn(
                name: "UploaderId",
                table: "files");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UploaderId",
                table: "files",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: false),
                    EmailVerified = table.Column<bool>(type: "boolean", nullable: false),
                    EmailVerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    ProfileImageUrl = table.Column<string>(type: "text", nullable: true),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_files_UploaderId",
                table: "files",
                column: "UploaderId");

            migrationBuilder.AddForeignKey(
                name: "FK_files_User_UploaderId",
                table: "files",
                column: "UploaderId",
                principalTable: "User",
                principalColumn: "Id");
        }
    }
}
