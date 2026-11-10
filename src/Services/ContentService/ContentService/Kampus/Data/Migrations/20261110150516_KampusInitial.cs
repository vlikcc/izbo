using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ContentService.Kampus.Data.Migrations
{
    /// <inheritdoc />
    public partial class KampusInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "kampus_activities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StopId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    Week = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_activities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kampus_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TeacherId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Due = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_assignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kampus_avatars",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Custom = table.Column<bool>(type: "boolean", nullable: false),
                    Config = table.Column<string>(type: "jsonb", nullable: false),
                    Equipped = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_avatars", x => x.StudentId);
                });

            migrationBuilder.CreateTable(
                name: "kampus_books",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Answers = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_books", x => new { x.StudentId, x.BookId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_collection",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_collection", x => new { x.StudentId, x.TopicId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_cup_entries",
                columns: table => new
                {
                    Week = table.Column<DateOnly>(type: "date", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Grade = table.Column<int>(type: "integer", nullable: false),
                    Seq = table.Column<int>(type: "integer", nullable: false),
                    GroupNo = table.Column<int>(type: "integer", nullable: false),
                    Nick = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Emoji = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_cup_entries", x => new { x.Week, x.StudentId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_cup_results",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Week = table.Column<DateOnly>(type: "date", nullable: false),
                    CupId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Rank = table.Column<int>(type: "integer", nullable: true),
                    Size = table.Column<int>(type: "integer", nullable: false),
                    GroupNo = table.Column<int>(type: "integer", nullable: false),
                    Won = table.Column<bool>(type: "boolean", nullable: false),
                    Stars = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_cup_results", x => new { x.StudentId, x.Week });
                });

            migrationBuilder.CreateTable(
                name: "kampus_exam_results",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExamId = table.Column<Guid>(type: "uuid", nullable: false),
                    Idx = table.Column<int>(type: "integer", nullable: false),
                    Done = table.Column<bool>(type: "boolean", nullable: false),
                    Answers = table.Column<string>(type: "jsonb", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_exam_results", x => new { x.StudentId, x.ExamId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_exams",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Subject = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ThemeNo = table.Column<int>(type: "integer", nullable: true),
                    ThemeTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Grade = table.Column<int>(type: "integer", nullable: false),
                    ClassroomIds = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    TeacherId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OpensAt = table.Column<DateOnly>(type: "date", nullable: false),
                    ClosesAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Skills = table.Column<List<string>>(type: "text[]", nullable: false),
                    Questions = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_exams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kampus_in_progress",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StopId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_in_progress", x => x.StudentId);
                });

            migrationBuilder.CreateTable(
                name: "kampus_minitests",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Attempt = table.Column<int>(type: "integer", nullable: false),
                    Set = table.Column<List<string>>(type: "text[]", nullable: false),
                    Idx = table.Column<int>(type: "integer", nullable: false),
                    Answers = table.Column<string>(type: "jsonb", nullable: false),
                    Done = table.Column<bool>(type: "boolean", nullable: false),
                    Prev = table.Column<List<string>>(type: "text[]", nullable: false),
                    Shown = table.Column<List<string>>(type: "text[]", nullable: false),
                    Best = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_minitests", x => new { x.StudentId, x.TopicId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_owned_items",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PricePaid = table.Column<int>(type: "integer", nullable: false),
                    AcquiredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_owned_items", x => new { x.StudentId, x.ItemId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_rewards",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Ref = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kp = table.Column<int>(type: "integer", nullable: false),
                    Star = table.Column<int>(type: "integer", nullable: false),
                    AwardedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    Week = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_rewards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kampus_stop_completions",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StopId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_stop_completions", x => new { x.StudentId, x.TopicId, x.StopId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_topic_answers",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Answers = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_topic_answers", x => new { x.StudentId, x.TopicId });
                });

            migrationBuilder.CreateTable(
                name: "kampus_topic_attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Answers = table.Column<string>(type: "jsonb", nullable: false),
                    ViaStops = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_topic_attempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kampus_wallets",
                columns: table => new
                {
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    KpBalance = table.Column<int>(type: "integer", nullable: false),
                    Nick = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PendingLevelUp = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kampus_wallets", x => x.StudentId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_kampus_activities_StudentId_Day",
                table: "kampus_activities",
                columns: new[] { "StudentId", "Day" });

            migrationBuilder.CreateIndex(
                name: "IX_kampus_activities_StudentId_Week",
                table: "kampus_activities",
                columns: new[] { "StudentId", "Week" });

            migrationBuilder.CreateIndex(
                name: "IX_kampus_assignments_ClassroomId",
                table: "kampus_assignments",
                column: "ClassroomId");

            migrationBuilder.CreateIndex(
                name: "IX_kampus_assignments_TeacherId",
                table: "kampus_assignments",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_kampus_cup_entries_Week_Grade_GroupNo_Nick",
                table: "kampus_cup_entries",
                columns: new[] { "Week", "Grade", "GroupNo", "Nick" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_kampus_cup_entries_Week_Grade_Seq",
                table: "kampus_cup_entries",
                columns: new[] { "Week", "Grade", "Seq" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_kampus_exam_results_ExamId",
                table: "kampus_exam_results",
                column: "ExamId");

            migrationBuilder.CreateIndex(
                name: "IX_kampus_exams_Grade",
                table: "kampus_exams",
                column: "Grade");

            migrationBuilder.CreateIndex(
                name: "IX_kampus_exams_TeacherId",
                table: "kampus_exams",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_kampus_rewards_StudentId_Day",
                table: "kampus_rewards",
                columns: new[] { "StudentId", "Day" });

            migrationBuilder.CreateIndex(
                name: "IX_kampus_rewards_StudentId_Kind_Ref",
                table: "kampus_rewards",
                columns: new[] { "StudentId", "Kind", "Ref" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_kampus_rewards_StudentId_Week",
                table: "kampus_rewards",
                columns: new[] { "StudentId", "Week" });

            migrationBuilder.CreateIndex(
                name: "IX_kampus_topic_attempts_StudentId_TopicId",
                table: "kampus_topic_attempts",
                columns: new[] { "StudentId", "TopicId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kampus_activities");

            migrationBuilder.DropTable(
                name: "kampus_assignments");

            migrationBuilder.DropTable(
                name: "kampus_avatars");

            migrationBuilder.DropTable(
                name: "kampus_books");

            migrationBuilder.DropTable(
                name: "kampus_collection");

            migrationBuilder.DropTable(
                name: "kampus_cup_entries");

            migrationBuilder.DropTable(
                name: "kampus_cup_results");

            migrationBuilder.DropTable(
                name: "kampus_exam_results");

            migrationBuilder.DropTable(
                name: "kampus_exams");

            migrationBuilder.DropTable(
                name: "kampus_in_progress");

            migrationBuilder.DropTable(
                name: "kampus_minitests");

            migrationBuilder.DropTable(
                name: "kampus_owned_items");

            migrationBuilder.DropTable(
                name: "kampus_rewards");

            migrationBuilder.DropTable(
                name: "kampus_stop_completions");

            migrationBuilder.DropTable(
                name: "kampus_topic_answers");

            migrationBuilder.DropTable(
                name: "kampus_topic_attempts");

            migrationBuilder.DropTable(
                name: "kampus_wallets");
        }
    }
}
