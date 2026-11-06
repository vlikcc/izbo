using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ContentService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "levels",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    grade_number = table.Column<int>(type: "integer", nullable: true),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_levels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "subjects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    level_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subjects", x => x.id);
                    table.ForeignKey(
                        name: "FK_subjects_levels_level_id",
                        column: x => x.level_id,
                        principalTable: "levels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "units",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_units", x => x.id);
                    table.ForeignKey(
                        name: "FK_units_subjects_subject_id",
                        column: x => x.subject_id,
                        principalTable: "subjects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "topics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    unit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_topics", x => x.id);
                    table.ForeignKey(
                        name: "FK_topics_units_unit_id",
                        column: x => x.unit_id,
                        principalTable: "units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "content_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    duration_seconds = table.Column<int>(type: "integer", nullable: true),
                    access_tier = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    review_note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    processing_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    processing_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    processing_attempts = table.Column<int>(type: "integer", nullable: false),
                    processing_started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    storage_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    original_file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    file_content_type = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    file_size = table.Column<long>(type: "bigint", nullable: true),
                    hls_prefix = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    thumbnail_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    embed_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_content_items_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "learning_outcomes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    topic_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learning_outcomes", x => x.id);
                    table.ForeignKey(
                        name: "FK_learning_outcomes_topics_topic_id",
                        column: x => x.topic_id,
                        principalTable: "topics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "content_progress",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position_seconds = table.Column<int>(type: "integer", nullable: false),
                    completed = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_progress", x => x.id);
                    table.ForeignKey(
                        name: "FK_content_progress_content_items_content_item_id",
                        column: x => x.content_item_id,
                        principalTable: "content_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "content_item_outcomes",
                columns: table => new
                {
                    content_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    learning_outcome_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_item_outcomes", x => new { x.content_item_id, x.learning_outcome_id });
                    table.ForeignKey(
                        name: "FK_content_item_outcomes_content_items_content_item_id",
                        column: x => x.content_item_id,
                        principalTable: "content_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_content_item_outcomes_learning_outcomes_learning_outcome_id",
                        column: x => x.learning_outcome_id,
                        principalTable: "learning_outcomes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "levels",
                columns: new[] { "id", "grade_number", "kind", "name", "order", "slug" },
                values: new object[,]
                {
                    { new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), 10, "Grade", "10. Sınıf", 10, "10-sinif" },
                    { new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), null, "ExamPrep", "LGS", 100, "lgs" },
                    { new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), 5, "Grade", "5. Sınıf", 5, "5-sinif" },
                    { new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), 3, "Grade", "3. Sınıf", 3, "3-sinif" },
                    { new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), null, "ExamPrep", "YKS - AYT", 102, "yks-ayt" },
                    { new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), null, "ExamPrep", "YKS - TYT", 101, "yks-tyt" },
                    { new Guid("50108e2e-a04c-8968-2329-952eb05b31eb"), 1, "Grade", "1. Sınıf", 1, "1-sinif" },
                    { new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), 7, "Grade", "7. Sınıf", 7, "7-sinif" },
                    { new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), 9, "Grade", "9. Sınıf", 9, "9-sinif" },
                    { new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), 11, "Grade", "11. Sınıf", 11, "11-sinif" },
                    { new Guid("8ebf2bba-687a-06a3-05d6-f0a31e35c52c"), 2, "Grade", "2. Sınıf", 2, "2-sinif" },
                    { new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), 6, "Grade", "6. Sınıf", 6, "6-sinif" },
                    { new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), 4, "Grade", "4. Sınıf", 4, "4-sinif" },
                    { new Guid("e9416807-bb99-a10a-7061-32390ed62069"), null, "ExamPrep", "YKS - YDT", 103, "yks-ydt" },
                    { new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), 8, "Grade", "8. Sınıf", 8, "8-sinif" },
                    { new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), 12, "Grade", "12. Sınıf", 12, "12-sinif" }
                });

            migrationBuilder.InsertData(
                table: "subjects",
                columns: new[] { "id", "color", "level_id", "name", "order", "slug" },
                values: new object[,]
                {
                    { new Guid("037eabd6-52ac-17af-5f8e-6ff96bf6e248"), "#7c3aed", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Fizik", 3, "fizik" },
                    { new Guid("0705d81b-f08c-fabc-a763-72b36bcf815c"), "#2563eb", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "Matematik", 2, "matematik" },
                    { new Guid("071745af-fb02-5199-92b2-609e55222913"), "#15803d", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Biyoloji", 5, "biyoloji" },
                    { new Guid("0b90910d-f3ed-ffd5-b144-ca61621f11c9"), "#ea580c", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "Sosyal Bilgiler", 4, "sosyal-bilgiler" },
                    { new Guid("102c66d0-fb04-b84a-cf90-00003323b4cc"), "#6d28d9", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Felsefe Grubu", 9, "felsefe-grubu" },
                    { new Guid("1090274a-6973-8b27-b383-6d9f7838e281"), "#16a34a", new Guid("50108e2e-a04c-8968-2329-952eb05b31eb"), "Hayat Bilgisi", 3, "hayat-bilgisi" },
                    { new Guid("172cb85a-4929-c1d6-3cf4-7e882a222cc8"), "#0d9488", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Coğrafya", 7, "cografya" },
                    { new Guid("193bbfe4-b808-7c86-fad5-7dc60a6355d5"), "#2563eb", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Matematik", 2, "matematik" },
                    { new Guid("19d4fb40-34ff-350f-a582-b13343f9d3a0"), "#db2777", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "İngilizce", 9, "ingilizce" },
                    { new Guid("1cb44c90-e758-3060-7db0-c63fea43f0b9"), "#7c3aed", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Fizik", 3, "fizik" },
                    { new Guid("1e673986-ee81-75f0-e830-db433d067207"), "#1d4ed8", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Geometri", 3, "geometri" },
                    { new Guid("20dd02a3-2a9a-e293-dd7d-5231a23254b0"), "#16a34a", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("22578240-5e83-3804-1634-770c5cd5a5de"), "#b45309", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Tarih", 6, "tarih" },
                    { new Guid("22923310-5a3a-646d-4a93-f5d1ae144d6b"), "#0f766e", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "Din Kültürü ve Ahlak Bilgisi", 6, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("234b37bb-7615-b251-5752-6eb342325edd"), "#4f46e5", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "İnsan Hakları, Yurttaşlık ve Demokrasi", 7, "insan-haklari-yurttaslik-ve-demokrasi" },
                    { new Guid("2429f865-5261-0dbb-214a-67ace49f810b"), "#16a34a", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("2bcdc0e0-bc9e-6a7a-8f0b-23f0229918f3"), "#0f766e", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "Din Kültürü ve Ahlak Bilgisi", 6, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("2d520b1b-0446-1863-942b-17c67f8c5a46"), "#2563eb", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "Matematik", 2, "matematik" },
                    { new Guid("304bd2f4-6db1-9400-41cf-bd007251c1b3"), "#b45309", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Tarih", 7, "tarih" },
                    { new Guid("32d732fb-2b3c-1835-876d-66773bd4126a"), "#0891b2", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Kimya", 4, "kimya" },
                    { new Guid("360d8c94-1d7d-62af-f717-a11308a4ddce"), "#0d9488", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Coğrafya", 7, "cografya" },
                    { new Guid("365df5ff-61b6-b224-0152-a0aedac14013"), "#0f766e", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "Din Kültürü ve Ahlak Bilgisi", 5, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("37f0820a-02d6-46f8-f11f-75e2f741f8d8"), "#0f766e", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Din Kültürü ve Ahlak Bilgisi", 10, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("38905cbf-8724-2232-b2ae-7ee17b93d248"), "#16a34a", new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), "Fen Bilimleri", 4, "fen-bilimleri" },
                    { new Guid("393c5ab1-5d09-3445-7620-a34af01dba4a"), "#2563eb", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Matematik", 2, "matematik" },
                    { new Guid("3bf520af-8e0a-41bc-b492-90e15214485f"), "#b45309", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Tarih", 6, "tarih" },
                    { new Guid("3c9caf9a-742f-7a5f-5f03-9623dde9a373"), "#db2777", new Guid("8ebf2bba-687a-06a3-05d6-f0a31e35c52c"), "İngilizce", 4, "ingilizce" },
                    { new Guid("4076a733-8ce2-02d7-20ad-5c2239220d87"), "#0891b2", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Kimya", 4, "kimya" },
                    { new Guid("41f4757c-d4ee-334b-9617-99bbad28bcad"), "#dc2626", new Guid("8ebf2bba-687a-06a3-05d6-f0a31e35c52c"), "Türkçe", 1, "turkce" },
                    { new Guid("44c66db2-f9e8-1a47-2694-0a62bd8e7082"), "#16a34a", new Guid("8ebf2bba-687a-06a3-05d6-f0a31e35c52c"), "Hayat Bilgisi", 3, "hayat-bilgisi" },
                    { new Guid("459858b2-fb77-5ebe-69b7-1547b831201b"), "#db2777", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "İngilizce", 5, "ingilizce" },
                    { new Guid("47dfd12e-01c7-f354-5df1-94f46c464830"), "#16a34a", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("48f3b3aa-516f-4b64-aaa2-f485e9fad6fd"), "#2563eb", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Matematik", 1, "matematik" },
                    { new Guid("496a0dc2-f538-2ecb-5408-01e153f75082"), "#dc2626", new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), "Türkçe", 1, "turkce" },
                    { new Guid("49a6dd30-9575-47f2-8b09-2d87c497305a"), "#7c3aed", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Fizik", 4, "fizik" },
                    { new Guid("4e408c33-1b9f-0aae-21b3-5d66774c77ea"), "#ea580c", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "Sosyal Bilgiler", 4, "sosyal-bilgiler" },
                    { new Guid("54ce0080-01ce-0d1e-7bbc-21d501a328f5"), "#db2777", new Guid("e9416807-bb99-a10a-7061-32390ed62069"), "İngilizce", 1, "ingilizce" },
                    { new Guid("56cdce75-d79f-ad63-4ec9-e6b2e4221f14"), "#16a34a", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("59307aee-a575-1dd2-cc44-7ab4e7897ace"), "#0f766e", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "Din Kültürü ve Ahlak Bilgisi", 6, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("5eec1b20-65f1-c737-414b-033009bc55ff"), "#0d9488", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Coğrafya", 7, "cografya" },
                    { new Guid("600bdf92-aae5-4293-7276-8706ffb28ec7"), "#0d9488", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Coğrafya", 8, "cografya" },
                    { new Guid("6171d694-e3de-7bca-b54d-7597bf9cd368"), "#0891b2", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Kimya", 4, "kimya" },
                    { new Guid("63966b54-f915-1c8b-7b5a-f735a5a9936c"), "#db2777", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "İngilizce", 9, "ingilizce" },
                    { new Guid("63988109-307b-7749-5dce-20d4494ca92e"), "#0d9488", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Coğrafya", 8, "cografya" },
                    { new Guid("639f48c8-5392-7fee-96a5-a84b6b3f55d4"), "#15803d", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Biyoloji", 5, "biyoloji" },
                    { new Guid("665b8cf6-f3a8-28dc-8018-0a94f18f7b82"), "#dc2626", new Guid("5f8e73dd-8221-6dbf-7508-71940abd6a7a"), "Türkçe", 1, "turkce" },
                    { new Guid("682d549c-aa00-dfe0-a4f1-48d792d1c6a9"), "#dc2626", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Türkçe", 1, "turkce" },
                    { new Guid("6c00edf5-2b21-cae0-518f-c2891ca6c266"), "#db2777", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "İngilizce", 6, "ingilizce" },
                    { new Guid("6e8f476d-4405-6b40-321e-1c49cc3f916a"), "#db2777", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "İngilizce", 5, "ingilizce" },
                    { new Guid("707568a2-0a8f-e476-17bd-bbb985512b05"), "#16a34a", new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), "Hayat Bilgisi", 3, "hayat-bilgisi" },
                    { new Guid("70c4393c-758c-d9f3-b6ec-67683e965ffe"), "#15803d", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Biyoloji", 5, "biyoloji" },
                    { new Guid("71c53117-12b6-16bf-8fe5-f3062176ecab"), "#7c3aed", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Fizik", 3, "fizik" },
                    { new Guid("7659a7f8-342a-e4d8-772e-2992fd975f67"), "#b91c1c", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "T.C. İnkılap Tarihi ve Atatürkçülük", 4, "t-c-inkilap-tarihi-ve-ataturkculuk" },
                    { new Guid("7858a59f-ed86-cd03-333d-40eceaa3b0e7"), "#dc2626", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Türk Dili ve Edebiyatı", 6, "turk-dili-ve-edebiyati" },
                    { new Guid("792736f6-a6b9-b872-885c-9cf7067c64d1"), "#dc2626", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Türk Dili ve Edebiyatı", 1, "turk-dili-ve-edebiyati" },
                    { new Guid("7929cf8e-c1ba-6ca7-4a85-7b03ec4c4ae2"), "#2563eb", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "Matematik", 2, "matematik" },
                    { new Guid("79635ec8-e984-5200-681c-d23107391fde"), "#0f766e", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Din Kültürü ve Ahlak Bilgisi", 10, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("7ac60152-bcdc-9b0d-15ca-f0177ebd3461"), "#dc2626", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Türk Dili ve Edebiyatı", 1, "turk-dili-ve-edebiyati" },
                    { new Guid("7d707876-e2c8-de4f-37b7-f13962628b8e"), "#0d9488", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Coğrafya", 7, "cografya" },
                    { new Guid("7fd04c47-3569-58db-8af5-e8d5626a6a41"), "#2563eb", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Matematik", 2, "matematik" },
                    { new Guid("873bff02-0ab4-9b77-1a18-9137092d4f03"), "#b91c1c", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "T.C. İnkılap Tarihi ve Atatürkçülük", 4, "t-c-inkilap-tarihi-ve-ataturkculuk" },
                    { new Guid("87cd9374-519b-1810-5980-7a7ca3de6e4c"), "#7c3aed", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Fizik", 3, "fizik" },
                    { new Guid("8924b31c-e199-0c56-0d02-325956c4db28"), "#db2777", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "İngilizce", 5, "ingilizce" },
                    { new Guid("8b612144-7b4f-4c84-208f-def5e1b59e96"), "#db2777", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "İngilizce", 5, "ingilizce" },
                    { new Guid("8fb4bafc-df8e-a6f9-87a9-00509a49f026"), "#2563eb", new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), "Matematik", 2, "matematik" },
                    { new Guid("904032f4-42b9-3b95-bf01-10299985c3ab"), "#0891b2", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Kimya", 4, "kimya" },
                    { new Guid("9279c559-6ea3-8e3c-079d-5f956aaeed6e"), "#2563eb", new Guid("8ebf2bba-687a-06a3-05d6-f0a31e35c52c"), "Matematik", 2, "matematik" },
                    { new Guid("94676bf8-b3ab-9e0c-5fb9-6beb81769562"), "#dc2626", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Türk Dili ve Edebiyatı", 1, "turk-dili-ve-edebiyati" },
                    { new Guid("94afc670-a55a-c9fa-43fb-d6828e55122d"), "#15803d", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Biyoloji", 5, "biyoloji" },
                    { new Guid("97bc6f30-0781-2cf7-c9d6-cec4e083709c"), "#2563eb", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "Matematik", 2, "matematik" },
                    { new Guid("9ace8779-7799-0a53-592f-d99ae2d44937"), "#0f766e", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "Din Kültürü ve Ahlak Bilgisi", 6, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("9e77410b-7143-d671-e4c5-b11e46ff9c25"), "#ea580c", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "Sosyal Bilgiler", 4, "sosyal-bilgiler" },
                    { new Guid("a9777a6a-d48e-970f-7b77-2f22e56f5caa"), "#0f766e", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Din Kültürü ve Ahlak Bilgisi", 10, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("ad7f0830-44b2-392e-c968-28adfa8f9463"), "#dc2626", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "Türkçe", 1, "turkce" },
                    { new Guid("b0ced7d9-7424-e279-e30a-fd924d7718a8"), "#7c3aed", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Fizik", 3, "fizik" },
                    { new Guid("b124b0b0-c1f8-a468-6656-aad4a6c6cc73"), "#1d4ed8", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Geometri", 2, "geometri" },
                    { new Guid("b2fd22c9-bfd1-9fab-8c3b-3e18ff840889"), "#dc2626", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "Türkçe", 1, "turkce" },
                    { new Guid("b38159b2-a614-2f76-684f-d258844ef47f"), "#6d28d9", new Guid("7fdbd935-889c-412f-897e-7d67c516ebf7"), "Felsefe", 8, "felsefe" },
                    { new Guid("b67016fe-bd94-1ecf-7934-f97ed683d9d7"), "#dc2626", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "Türkçe", 1, "turkce" },
                    { new Guid("b9545bfc-1e60-ba64-36bf-5feb39813e07"), "#dc2626", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Türk Dili ve Edebiyatı", 1, "turk-dili-ve-edebiyati" },
                    { new Guid("ba615629-7f4e-9564-2db8-fd41f0784aa9"), "#0f766e", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "Din Kültürü ve Ahlak Bilgisi", 6, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("bbd26fb1-420c-18b7-f1c1-e7950720dc82"), "#6d28d9", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Felsefe", 8, "felsefe" },
                    { new Guid("bcaecb22-3192-29e3-e92c-78add207af76"), "#0891b2", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Kimya", 5, "kimya" },
                    { new Guid("bce44b73-1c74-b121-8490-7f200686ade5"), "#b45309", new Guid("35a255c5-e5eb-523d-c43b-0c9d4712e413"), "Tarih", 7, "tarih" },
                    { new Guid("bfcb334b-8b63-4b1e-03da-1dc7716d807c"), "#dc2626", new Guid("edeb70d2-54f0-3a6d-352b-d2063c7e4a84"), "Türkçe", 1, "turkce" },
                    { new Guid("c31ce7ee-ad21-3b6d-1c46-d744b7684c32"), "#2563eb", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "Matematik", 2, "matematik" },
                    { new Guid("c3973350-9be0-0007-fade-b58c5af4f191"), "#16a34a", new Guid("1476a5c4-25c1-4198-a592-50ee03b5931f"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("c58c8b55-fd96-efa7-fde0-d9681522328e"), "#ea580c", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "Sosyal Bilgiler", 4, "sosyal-bilgiler" },
                    { new Guid("c7c10c7a-a7a3-65e8-fafb-bccd3ae2b722"), "#0f766e", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Din Kültürü ve Ahlak Bilgisi", 9, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("c9eb129d-96a8-47e9-83ca-d04a99bd4992"), "#0891b2", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Kimya", 4, "kimya" },
                    { new Guid("ca20c35a-a36f-9ebb-0ed4-0eceee8b41bb"), "#6d28d9", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Felsefe", 9, "felsefe" },
                    { new Guid("ce6a92a7-a0d0-2c98-8fa0-ab5a2ec9a028"), "#db2777", new Guid("25076ca3-cafe-3a72-6145-7a5b208c2bf2"), "İngilizce", 5, "ingilizce" },
                    { new Guid("d3826d5b-8403-e196-7f58-255ee94101f5"), "#0f766e", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Din Kültürü ve Ahlak Bilgisi", 10, "din-kulturu-ve-ahlak-bilgisi" },
                    { new Guid("d389c042-0a85-1c1c-e840-30a09303a773"), "#dc2626", new Guid("dfe785a9-12bb-16d6-e8c4-3ec81f5210fa"), "Türkçe", 1, "turkce" },
                    { new Guid("d45322d6-220c-ece7-1707-0cbdcbfd5542"), "#2563eb", new Guid("50108e2e-a04c-8968-2329-952eb05b31eb"), "Matematik", 2, "matematik" },
                    { new Guid("d488470c-6c5e-dbcf-04e5-ab907cea07a6"), "#db2777", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "İngilizce", 9, "ingilizce" },
                    { new Guid("d92a9cf0-09de-48a2-5504-fae9ad80265b"), "#db2777", new Guid("a44efa50-d8e6-e43d-56ff-28dea60635be"), "İngilizce", 5, "ingilizce" },
                    { new Guid("e5fc7b98-02db-5248-923f-b2d062120e21"), "#b91c1c", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "T.C. İnkılap Tarihi ve Atatürkçülük", 6, "t-c-inkilap-tarihi-ve-ataturkculuk" },
                    { new Guid("e924015e-91d0-eddd-098a-e666d6b52be3"), "#15803d", new Guid("47b5092d-af76-1e26-0b9c-ae6d07f09367"), "Biyoloji", 6, "biyoloji" },
                    { new Guid("e965e90e-384d-2d81-0bad-7a2afc2343ba"), "#16a34a", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "Fen Bilimleri", 3, "fen-bilimleri" },
                    { new Guid("f112b3fa-83a6-9ba0-93df-c86b01161763"), "#db2777", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "İngilizce", 8, "ingilizce" },
                    { new Guid("f122ecaa-020e-02de-1132-33004167576d"), "#b45309", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Tarih", 6, "tarih" },
                    { new Guid("f17da7cc-d0cb-4a97-a389-be3c17b8eb54"), "#6d28d9", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Felsefe", 8, "felsefe" },
                    { new Guid("f4c87e46-c9bf-ca56-939b-903b9c950c6a"), "#dc2626", new Guid("50108e2e-a04c-8968-2329-952eb05b31eb"), "Türkçe", 1, "turkce" },
                    { new Guid("f54070b0-2aad-0274-a174-b4e5bbce75ca"), "#2563eb", new Guid("2094acd8-9814-0990-ede0-d0109de1da74"), "Matematik", 2, "matematik" },
                    { new Guid("f602e2a1-69a4-bbf3-1b6e-76188e796f37"), "#2563eb", new Guid("fa5ed1fb-6c51-801c-a930-de1af60f167a"), "Matematik", 2, "matematik" },
                    { new Guid("f8e4ac95-6b75-dcf4-e3a4-bbb53d718fbc"), "#2563eb", new Guid("0f654b65-bb32-1c4f-36bc-32a3731159de"), "Matematik", 2, "matematik" },
                    { new Guid("fc0e1fce-84a8-f77d-d904-4e8cc241ee75"), "#15803d", new Guid("762d2044-2c17-2e3e-8a27-203dc7c75de4"), "Biyoloji", 5, "biyoloji" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_content_item_outcomes_learning_outcome_id",
                table: "content_item_outcomes",
                column: "learning_outcome_id");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_owner_id",
                table: "content_items",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_processing_status",
                table: "content_items",
                column: "processing_status");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_status",
                table: "content_items",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_topic_id_status",
                table: "content_items",
                columns: new[] { "topic_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_content_progress_content_item_id",
                table: "content_progress",
                column: "content_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_content_progress_user_id_content_item_id",
                table: "content_progress",
                columns: new[] { "user_id", "content_item_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_content_progress_user_id_updated_at",
                table: "content_progress",
                columns: new[] { "user_id", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_learning_outcomes_topic_id_code",
                table: "learning_outcomes",
                columns: new[] { "topic_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_levels_slug",
                table: "levels",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subjects_level_id_slug",
                table: "subjects",
                columns: new[] { "level_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_topics_unit_id_slug",
                table: "topics",
                columns: new[] { "unit_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_units_subject_id_order",
                table: "units",
                columns: new[] { "subject_id", "order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_item_outcomes");

            migrationBuilder.DropTable(
                name: "content_progress");

            migrationBuilder.DropTable(
                name: "learning_outcomes");

            migrationBuilder.DropTable(
                name: "content_items");

            migrationBuilder.DropTable(
                name: "topics");

            migrationBuilder.DropTable(
                name: "units");

            migrationBuilder.DropTable(
                name: "subjects");

            migrationBuilder.DropTable(
                name: "levels");
        }
    }
}
