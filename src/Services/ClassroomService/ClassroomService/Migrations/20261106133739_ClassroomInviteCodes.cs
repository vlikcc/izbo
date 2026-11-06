using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassroomService.Migrations
{
    /// <inheritdoc />
    public partial class ClassroomInviteCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "classrooms",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxStudents",
                table: "classrooms",
                type: "integer",
                nullable: true);

            // Existing classrooms get a code too, from the same unambiguous alphabet the service uses.
            migrationBuilder.Sql("""
                UPDATE classrooms
                SET "InviteCode" = (
                    SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
                    FROM generate_series(1, 8 + (0 * length("Id"::text)))
                )
                WHERE "InviteCode" IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_classrooms_InviteCode",
                table: "classrooms",
                column: "InviteCode",
                unique: true,
                filter: "\"InviteCode\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_classrooms_InviteCode",
                table: "classrooms");

            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "classrooms");

            migrationBuilder.DropColumn(
                name: "MaxStudents",
                table: "classrooms");
        }
    }
}
