using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SubscriptionService.Migrations
{
    /// <inheritdoc />
    public partial class LearnerPackages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "learner_packages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Tier = table.Column<int>(type: "integer", nullable: false),
                    Features = table.Column<string>(type: "jsonb", nullable: false),
                    PracticeTestsPerDay = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learner_packages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "learner_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PayerId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Term = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ProviderReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PayerNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DecidedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learner_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_learner_orders_learner_packages_PackageId",
                        column: x => x.PackageId,
                        principalTable: "learner_packages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "learner_package_prices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Term = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DurationDays = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learner_package_prices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_learner_package_prices_learner_packages_PackageId",
                        column: x => x.PackageId,
                        principalTable: "learner_packages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "learner_passes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tier = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learner_passes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_learner_passes_learner_packages_PackageId",
                        column: x => x.PackageId,
                        principalTable: "learner_packages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_learner_orders_PackageId",
                table: "learner_orders",
                column: "PackageId");

            migrationBuilder.CreateIndex(
                name: "IX_learner_orders_PayerId_CreatedAt",
                table: "learner_orders",
                columns: new[] { "PayerId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_learner_orders_Reference",
                table: "learner_orders",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_learner_orders_Status",
                table: "learner_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_learner_orders_StudentId",
                table: "learner_orders",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_learner_package_prices_PackageId_Term",
                table: "learner_package_prices",
                columns: new[] { "PackageId", "Term" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_learner_packages_Code",
                table: "learner_packages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_learner_passes_OrderId",
                table: "learner_passes",
                column: "OrderId",
                unique: true,
                filter: "\"OrderId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_learner_passes_PackageId",
                table: "learner_passes",
                column: "PackageId");

            migrationBuilder.CreateIndex(
                name: "IX_learner_passes_StudentId_EndsAt",
                table: "learner_passes",
                columns: new[] { "StudentId", "EndsAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "learner_orders");

            migrationBuilder.DropTable(
                name: "learner_package_prices");

            migrationBuilder.DropTable(
                name: "learner_passes");

            migrationBuilder.DropTable(
                name: "learner_packages");
        }
    }
}
