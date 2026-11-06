using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ContentService.Migrations
{
    /// <inheritdoc />
    public partial class Assessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "assessments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    level_id = table.Column<Guid>(type: "uuid", nullable: false),
                    duration_minutes = table.Column<int>(type: "integer", nullable: false),
                    scoring_rule = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    window_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    window_end = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    access_tier = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ranked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assessments", x => x.id);
                    table.ForeignKey(
                        name: "FK_assessments_levels_level_id",
                        column: x => x.level_id,
                        principalTable: "levels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "assessment_sections",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assessment_sections", x => x.id);
                    table.ForeignKey(
                        name: "FK_assessment_sections_assessments_assessment_id",
                        column: x => x.assessment_id,
                        principalTable: "assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_assessment_sections_subjects_subject_id",
                        column: x => x.subject_id,
                        principalTable: "subjects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "attempts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: true),
                    unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assessment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    scoring_rule = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    correct = table.Column<int>(type: "integer", nullable: false),
                    wrong = table.Column<int>(type: "integer", nullable: false),
                    blank = table.Column<int>(type: "integer", nullable: false),
                    net = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: false),
                    percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    is_ranked = table.Column<bool>(type: "boolean", nullable: false),
                    rank = table.Column<int>(type: "integer", nullable: true),
                    participant_count = table.Column<int>(type: "integer", nullable: true),
                    top_percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attempts", x => x.id);
                    table.ForeignKey(
                        name: "FK_attempts_assessments_assessment_id",
                        column: x => x.assessment_id,
                        principalTable: "assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "assessment_questions",
                columns: table => new
                {
                    assessment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    question_id = table.Column<Guid>(type: "uuid", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assessment_questions", x => new { x.assessment_id, x.question_id });
                    table.ForeignKey(
                        name: "FK_assessment_questions_assessment_sections_section_id",
                        column: x => x.section_id,
                        principalTable: "assessment_sections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_assessment_questions_assessments_assessment_id",
                        column: x => x.assessment_id,
                        principalTable: "assessments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_assessment_questions_bank_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "bank_questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "attempt_items",
                columns: table => new
                {
                    attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    question_id = table.Column<Guid>(type: "uuid", nullable: false),
                    section_id = table.Column<Guid>(type: "uuid", nullable: true),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    learning_outcome_id = table.Column<Guid>(type: "uuid", nullable: true),
                    option_count = table.Column<int>(type: "integer", nullable: false),
                    correct_key = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false),
                    selected_key = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    is_correct = table.Column<bool>(type: "boolean", nullable: true),
                    answered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attempt_items", x => new { x.attempt_id, x.order });
                    table.ForeignKey(
                        name: "FK_attempt_items_attempts_attempt_id",
                        column: x => x.attempt_id,
                        principalTable: "attempts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_attempt_items_bank_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "bank_questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_assessment_questions_question_id",
                table: "assessment_questions",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_assessment_questions_section_id",
                table: "assessment_questions",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "IX_assessment_sections_assessment_id_order",
                table: "assessment_sections",
                columns: new[] { "assessment_id", "order" });

            migrationBuilder.CreateIndex(
                name: "IX_assessment_sections_subject_id",
                table: "assessment_sections",
                column: "subject_id");

            migrationBuilder.CreateIndex(
                name: "IX_assessments_level_id",
                table: "assessments",
                column: "level_id");

            migrationBuilder.CreateIndex(
                name: "IX_assessments_status_level_id",
                table: "assessments",
                columns: new[] { "status", "level_id" });

            migrationBuilder.CreateIndex(
                name: "IX_assessments_window_end",
                table: "assessments",
                column: "window_end");

            migrationBuilder.CreateIndex(
                name: "IX_attempt_items_question_id",
                table: "attempt_items",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_attempt_items_topic_id",
                table: "attempt_items",
                column: "topic_id");

            migrationBuilder.CreateIndex(
                name: "IX_attempts_assessment_id_is_ranked",
                table: "attempts",
                columns: new[] { "assessment_id", "is_ranked" });

            migrationBuilder.CreateIndex(
                name: "IX_attempts_status_deadline",
                table: "attempts",
                columns: new[] { "status", "deadline" });

            migrationBuilder.CreateIndex(
                name: "IX_attempts_user_id_assessment_id",
                table: "attempts",
                columns: new[] { "user_id", "assessment_id" },
                unique: true,
                filter: "assessment_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_attempts_user_id_started_at",
                table: "attempts",
                columns: new[] { "user_id", "started_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assessment_questions");

            migrationBuilder.DropTable(
                name: "attempt_items");

            migrationBuilder.DropTable(
                name: "assessment_sections");

            migrationBuilder.DropTable(
                name: "attempts");

            migrationBuilder.DropTable(
                name: "assessments");
        }
    }
}
