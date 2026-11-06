using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContentService.Migrations
{
    /// <inheritdoc />
    public partial class QuestionBank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bank_questions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    learning_outcome_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    stem = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    stem_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    options = table.Column<string>(type: "jsonb", nullable: false),
                    correct_key = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false),
                    difficulty = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    explanation = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    solution_video_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    review_note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_questions", x => x.id);
                    table.ForeignKey(
                        name: "FK_bank_questions_content_items_solution_video_item_id",
                        column: x => x.solution_video_item_id,
                        principalTable: "content_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_bank_questions_learning_outcomes_learning_outcome_id",
                        column: x => x.learning_outcome_id,
                        principalTable: "learning_outcomes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_bank_questions_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "question_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    content_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    size = table.Column<long>(type: "bigint", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_assets", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bank_questions_learning_outcome_id",
                table: "bank_questions",
                column: "learning_outcome_id");

            migrationBuilder.CreateIndex(
                name: "IX_bank_questions_owner_id",
                table: "bank_questions",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_bank_questions_solution_video_item_id",
                table: "bank_questions",
                column: "solution_video_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_bank_questions_status",
                table: "bank_questions",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_bank_questions_topic_id_status",
                table: "bank_questions",
                columns: new[] { "topic_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_question_assets_owner_id",
                table: "question_assets",
                column: "owner_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bank_questions");

            migrationBuilder.DropTable(
                name: "question_assets");
        }
    }
}
