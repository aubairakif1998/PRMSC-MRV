using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MRV.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    submission_id = table.Column<string>(type: "text", nullable: true),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    hierarchy_rank = table.Column<int>(type: "integer", nullable: false),
                    permissions = table.Column<List<string>>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "solar_energy_logging_monthly",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    solar_system_id = table.Column<string>(type: "text", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    month = table.Column<int>(type: "integer", nullable: false),
                    energy_consumed_from_grid = table.Column<double>(type: "double precision", nullable: true),
                    energy_exported_to_grid = table.Column<double>(type: "double precision", nullable: true),
                    electricity_bill_image_url = table.Column<string>(type: "text", nullable: true),
                    remarks = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solar_energy_logging_monthly", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "solar_systems",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    tehsil = table.Column<string>(type: "text", nullable: false),
                    village = table.Column<string>(type: "text", nullable: false),
                    settlement = table.Column<string>(type: "text", nullable: true),
                    unique_identifier = table.Column<string>(type: "text", nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    installation_location = table.Column<string>(type: "text", nullable: true),
                    solar_panel_capacity = table.Column<double>(type: "double precision", nullable: true),
                    inverter_capacity = table.Column<double>(type: "double precision", nullable: true),
                    inverter_serial_number = table.Column<string>(type: "text", nullable: true),
                    installation_date = table.Column<DateOnly>(type: "date", nullable: true),
                    meter_model = table.Column<string>(type: "text", nullable: true),
                    meter_serial_number = table.Column<string>(type: "text", nullable: true),
                    green_meter_connection_date = table.Column<DateOnly>(type: "date", nullable: true),
                    remarks = table.Column<string>(type: "text", nullable: true),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solar_systems", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "submissions",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    operator_id = table.Column<string>(type: "text", nullable: false),
                    submission_type = table.Column<string>(type: "text", nullable: false),
                    record_id = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<string>(type: "text", nullable: true),
                    approved_by = table.Column<string>(type: "text", nullable: true),
                    remarks = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submissions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "verification_logs",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    submission_id = table.Column<string>(type: "text", nullable: false),
                    action_type = table.Column<string>(type: "text", nullable: false),
                    performed_by = table.Column<string>(type: "text", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_verification_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "water_energy_logging_daily",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    water_system_id = table.Column<string>(type: "text", nullable: false),
                    log_date = table.Column<DateOnly>(type: "date", nullable: false),
                    pump_start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    pump_end_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    pump_operating_hours = table.Column<double>(type: "double precision", nullable: true),
                    total_water_pumped = table.Column<double>(type: "double precision", nullable: true),
                    bulk_meter_image_url = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    remarks = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_water_energy_logging_daily", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "water_systems",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    tehsil = table.Column<string>(type: "text", nullable: false),
                    village = table.Column<string>(type: "text", nullable: false),
                    settlement = table.Column<string>(type: "text", nullable: true),
                    unique_identifier = table.Column<string>(type: "text", nullable: false),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    pump_model = table.Column<string>(type: "text", nullable: true),
                    pump_serial_number = table.Column<string>(type: "text", nullable: true),
                    start_of_operation = table.Column<DateOnly>(type: "date", nullable: true),
                    depth_of_water_intake = table.Column<double>(type: "double precision", nullable: true),
                    height_to_ohr = table.Column<double>(type: "double precision", nullable: true),
                    pump_flow_rate = table.Column<double>(type: "double precision", nullable: true),
                    meter_model = table.Column<string>(type: "text", nullable: true),
                    meter_serial_number = table.Column<string>(type: "text", nullable: true),
                    meter_accuracy_class = table.Column<string>(type: "text", nullable: true),
                    calibration_requirement = table.Column<string>(type: "text", nullable: true),
                    installation_date = table.Column<DateOnly>(type: "date", nullable: true),
                    created_by = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_water_systems", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    role_id = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_users_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_tehsils",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    tehsil = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_tehsils", x => new { x.user_id, x.tehsil });
                    table.ForeignKey(
                        name: "FK_user_tehsils_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_water_systems",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    water_system_id = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_water_systems", x => new { x.user_id, x.water_system_id });
                    table.ForeignKey(
                        name: "FK_user_water_systems_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_role_id",
                table: "users",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "uq_water_energy_logging_daily_sid_date",
                table: "water_energy_logging_daily",
                columns: new[] { "water_system_id", "log_date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "password_reset_tokens");

            migrationBuilder.DropTable(
                name: "solar_energy_logging_monthly");

            migrationBuilder.DropTable(
                name: "solar_systems");

            migrationBuilder.DropTable(
                name: "submissions");

            migrationBuilder.DropTable(
                name: "user_tehsils");

            migrationBuilder.DropTable(
                name: "user_water_systems");

            migrationBuilder.DropTable(
                name: "verification_logs");

            migrationBuilder.DropTable(
                name: "water_energy_logging_daily");

            migrationBuilder.DropTable(
                name: "water_systems");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "roles");
        }
    }
}
