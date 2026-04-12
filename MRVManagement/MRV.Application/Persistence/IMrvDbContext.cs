using Microsoft.EntityFrameworkCore;
using MRV.Domain.Entities;

namespace MRV.Application.Persistence;

public interface IMrvDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<UserTehsil> UserTehsils { get; }
    DbSet<UserWaterSystem> UserWaterSystems { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<WaterSystem> WaterSystems { get; }
    DbSet<WaterEnergyLoggingDaily> WaterEnergyLoggingDaily { get; }
    DbSet<SolarSystem> SolarSystems { get; }
    DbSet<SolarEnergyLoggingMonthly> SolarEnergyLoggingMonthly { get; }
    DbSet<Submission> Submissions { get; }
    DbSet<VerificationLog> VerificationLogs { get; }
    DbSet<Notification> Notifications { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

