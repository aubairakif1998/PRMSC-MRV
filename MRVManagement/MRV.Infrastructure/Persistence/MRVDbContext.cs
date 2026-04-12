using Microsoft.EntityFrameworkCore;
using MRV.Application.Persistence;
using MRV.Domain.Entities;

namespace MRV.Infrastructure.Persistence;

public sealed class MRVDbContext : DbContext, IMrvDbContext
{
    public MRVDbContext(DbContextOptions<MRVDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserTehsil> UserTehsils => Set<UserTehsil>();
    public DbSet<UserWaterSystem> UserWaterSystems => Set<UserWaterSystem>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<WaterSystem> WaterSystems => Set<WaterSystem>();
    public DbSet<WaterEnergyLoggingDaily> WaterEnergyLoggingDaily => Set<WaterEnergyLoggingDaily>();
    public DbSet<SolarSystem> SolarSystems => Set<SolarSystem>();
    public DbSet<SolarEnergyLoggingMonthly> SolarEnergyLoggingMonthly => Set<SolarEnergyLoggingMonthly>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<VerificationLog> VerificationLogs => Set<VerificationLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(e =>
        {
            e.ToTable("roles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Code).HasColumnName("code");
            e.Property(x => x.DisplayName).HasColumnName("display_name");
            e.Property(x => x.HierarchyRank).HasColumnName("hierarchy_rank");
            e.Property(x => x.Permissions).HasColumnName("permissions").HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.PasswordHash).HasColumnName("password_hash");
            e.Property(x => x.Phone).HasColumnName("phone");
            e.Property(x => x.RoleId).HasColumnName("role_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");

            e.HasOne(x => x.AssignedRole)
                .WithMany()
                .HasForeignKey(x => x.RoleId);

            e.HasMany(x => x.TehsilLinks)
                .WithOne()
                .HasForeignKey(x => x.UserId);

            e.HasMany(x => x.WaterSystemLinks)
                .WithOne()
                .HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<UserTehsil>(e =>
        {
            e.ToTable("user_tehsils");
            e.HasKey(x => new { x.UserId, x.Tehsil });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Tehsil).HasColumnName("tehsil");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<UserWaterSystem>(e =>
        {
            e.ToTable("user_water_systems");
            e.HasKey(x => new { x.UserId, x.WaterSystemId });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.WaterSystemId).HasColumnName("water_system_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("password_reset_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.TokenHash).HasColumnName("token_hash");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.UsedAt).HasColumnName("used_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<WaterSystem>(e =>
        {
            e.ToTable("water_systems");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Tehsil).HasColumnName("tehsil");
            e.Property(x => x.Village).HasColumnName("village");
            e.Property(x => x.Settlement).HasColumnName("settlement");
            e.Property(x => x.UniqueIdentifier).HasColumnName("unique_identifier");
            e.Property(x => x.Latitude).HasColumnName("latitude");
            e.Property(x => x.Longitude).HasColumnName("longitude");
            e.Property(x => x.PumpModel).HasColumnName("pump_model");
            e.Property(x => x.PumpSerialNumber).HasColumnName("pump_serial_number");
            e.Property(x => x.StartOfOperation).HasColumnName("start_of_operation");
            e.Property(x => x.DepthOfWaterIntake).HasColumnName("depth_of_water_intake");
            e.Property(x => x.HeightToOhr).HasColumnName("height_to_ohr");
            e.Property(x => x.PumpFlowRate).HasColumnName("pump_flow_rate");
            e.Property(x => x.MeterModel).HasColumnName("meter_model");
            e.Property(x => x.MeterSerialNumber).HasColumnName("meter_serial_number");
            e.Property(x => x.MeterAccuracyClass).HasColumnName("meter_accuracy_class");
            e.Property(x => x.CalibrationRequirement).HasColumnName("calibration_requirement");
            e.Property(x => x.InstallationDate).HasColumnName("installation_date");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<WaterEnergyLoggingDaily>(e =>
        {
            e.ToTable("water_energy_logging_daily");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.WaterSystemId).HasColumnName("water_system_id");
            e.Property(x => x.LogDate).HasColumnName("log_date");
            e.Property(x => x.PumpStartTime).HasColumnName("pump_start_time");
            e.Property(x => x.PumpEndTime).HasColumnName("pump_end_time");
            e.Property(x => x.PumpOperatingHours).HasColumnName("pump_operating_hours");
            e.Property(x => x.TotalWaterPumped).HasColumnName("total_water_pumped");
            e.Property(x => x.BulkMeterImageUrl).HasColumnName("bulk_meter_image_url");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");

            e.HasIndex(x => new { x.WaterSystemId, x.LogDate })
                .IsUnique()
                .HasDatabaseName("uq_water_energy_logging_daily_sid_date");
        });

        modelBuilder.Entity<SolarSystem>(e =>
        {
            e.ToTable("solar_systems");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Tehsil).HasColumnName("tehsil");
            e.Property(x => x.Village).HasColumnName("village");
            e.Property(x => x.Settlement).HasColumnName("settlement");
            e.Property(x => x.UniqueIdentifier).HasColumnName("unique_identifier");
            e.Property(x => x.Latitude).HasColumnName("latitude");
            e.Property(x => x.Longitude).HasColumnName("longitude");
            e.Property(x => x.InstallationLocation).HasColumnName("installation_location");
            e.Property(x => x.SolarPanelCapacity).HasColumnName("solar_panel_capacity");
            e.Property(x => x.InverterCapacity).HasColumnName("inverter_capacity");
            e.Property(x => x.InverterSerialNumber).HasColumnName("inverter_serial_number");
            e.Property(x => x.InstallationDate).HasColumnName("installation_date");
            e.Property(x => x.MeterModel).HasColumnName("meter_model");
            e.Property(x => x.MeterSerialNumber).HasColumnName("meter_serial_number");
            e.Property(x => x.GreenMeterConnectionDate).HasColumnName("green_meter_connection_date");
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<SolarEnergyLoggingMonthly>(e =>
        {
            e.ToTable("solar_energy_logging_monthly");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.SolarSystemId).HasColumnName("solar_system_id");
            e.Property(x => x.Year).HasColumnName("year");
            e.Property(x => x.Month).HasColumnName("month");
            e.Property(x => x.EnergyConsumedFromGrid).HasColumnName("energy_consumed_from_grid");
            e.Property(x => x.EnergyExportedToGrid).HasColumnName("energy_exported_to_grid");
            e.Property(x => x.ElectricityBillImageUrl).HasColumnName("electricity_bill_image_url");
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Submission>(e =>
        {
            e.ToTable("submissions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.OperatorId).HasColumnName("operator_id");
            e.Property(x => x.SubmissionType).HasColumnName("submission_type");
            e.Property(x => x.RecordId).HasColumnName("record_id");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            e.Property(x => x.ReviewedAt).HasColumnName("reviewed_at");
            e.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            e.Property(x => x.ReviewedBy).HasColumnName("reviewed_by");
            e.Property(x => x.ApprovedBy).HasColumnName("approved_by");
            e.Property(x => x.Remarks).HasColumnName("remarks");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<VerificationLog>(e =>
        {
            e.ToTable("verification_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.SubmissionId).HasColumnName("submission_id");
            e.Property(x => x.ActionType).HasColumnName("action_type");
            e.Property(x => x.PerformedBy).HasColumnName("performed_by");
            e.Property(x => x.Role).HasColumnName("role");
            e.Property(x => x.Comment).HasColumnName("comment");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("notifications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Title).HasColumnName("title");
            e.Property(x => x.Message).HasColumnName("message");
            e.Property(x => x.SubmissionId).HasColumnName("submission_id");
            e.Property(x => x.IsRead).HasColumnName("is_read");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        base.OnModelCreating(modelBuilder);
    }
}

