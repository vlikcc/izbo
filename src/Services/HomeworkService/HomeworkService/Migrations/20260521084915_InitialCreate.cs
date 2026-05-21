using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeworkService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "homeworks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    AttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    MaxScore = table.Column<int>(type: "integer", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllowLateSubmission = table.Column<bool>(type: "boolean", nullable: false),
                    LatePenaltyPercent = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_homeworks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "homework_submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HomeworkId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: true),
                    FileUrl = table.Column<string>(type: "text", nullable: true),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    Feedback = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    GradedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    GradedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_homework_submissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_homework_submissions_homeworks_HomeworkId",
                        column: x => x.HomeworkId,
                        principalTable: "homeworks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_homework_submissions_HomeworkId_StudentId",
                table: "homework_submissions",
                columns: new[] { "HomeworkId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_homework_submissions_Status",
                table: "homework_submissions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_homeworks_ClassroomId",
                table: "homeworks",
                column: "ClassroomId");

            migrationBuilder.CreateIndex(
                name: "IX_homeworks_DueDate",
                table: "homeworks",
                column: "DueDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "homework_submissions");

            migrationBuilder.DropTable(
                name: "homeworks");
        }
    }
}
