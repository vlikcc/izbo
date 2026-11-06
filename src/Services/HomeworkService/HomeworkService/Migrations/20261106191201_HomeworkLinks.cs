using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeworkService.Migrations
{
    /// <inheritdoc />
    public partial class HomeworkLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LinkKind",
                table: "homeworks",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<Guid>(
                name: "LinkTargetId",
                table: "homeworks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkTitle",
                table: "homeworks",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LinkKind",
                table: "homeworks");

            migrationBuilder.DropColumn(
                name: "LinkTargetId",
                table: "homeworks");

            migrationBuilder.DropColumn(
                name: "LinkTitle",
                table: "homeworks");
        }
    }
}
