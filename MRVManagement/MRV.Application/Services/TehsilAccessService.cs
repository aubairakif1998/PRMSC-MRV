using Microsoft.EntityFrameworkCore;
using MRV.Application.Persistence;
using MRV.Domain;
using MRV.Domain.Entities;

namespace MRV.Application.Services;

public interface ITehsilAccessService
{
    Task AssertUserMayAccessTehsilAsync(User user, string? tehsil, bool forWrite, CancellationToken ct);
    Task AssertActorMayAssignWaterSystemsToOperatorAsync(User actor, IReadOnlyCollection<string> waterSystemIds, CancellationToken ct);
    Task<HashSet<string>> OperatorTehsilsDerivedFromWaterSystemsAsync(User user, CancellationToken ct);
}

public sealed class TehsilAccessService : ITehsilAccessService
{
    private readonly IMrvDbContext _db;

    public TehsilAccessService(IMrvDbContext db)
    {
        _db = db;
    }

    public async Task AssertUserMayAccessTehsilAsync(User user, string? tehsil, bool forWrite, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tehsil))
            throw new TehsilAccessDeniedException("Not allowed for this tehsil");

        var role = user.AssignedRole?.Code ?? string.Empty;
        var rank = RoleRank(role);

        if (forWrite && rank >= 3)
            throw new TehsilAccessDeniedException("Read-only role — cannot modify data for this tehsil");

        if (rank >= 3)
            return; // SUPER_ADMIN / SYSTEM_ADMIN read all

        if (role == RoleCodes.Admin)
        {
            var ok = await _db.UserTehsils.AnyAsync(x => x.UserId == user.Id && x.Tehsil == tehsil, ct);
            if (!ok) throw new TehsilAccessDeniedException("Not allowed for this tehsil");
            return;
        }

        if (role == RoleCodes.User)
        {
            var tehsils = await OperatorTehsilsDerivedFromWaterSystemsAsync(user, ct);
            if (!tehsils.Contains(tehsil))
                throw new TehsilAccessDeniedException("Not allowed for this tehsil");
            return;
        }

        throw new TehsilAccessDeniedException("Not allowed for this tehsil");
    }

    public async Task AssertActorMayAssignWaterSystemsToOperatorAsync(User actor, IReadOnlyCollection<string> waterSystemIds, CancellationToken ct)
    {
        if (waterSystemIds.Count < 1)
            throw new ArgumentException("At least one water_system_id is required");

        var role = actor.AssignedRole?.Code ?? string.Empty;
        if (!string.Equals(role, RoleCodes.Admin, StringComparison.OrdinalIgnoreCase))
            throw new TehsilAccessDeniedException("Only tehsil managers can assign water systems to operators");

        var actorTehsils = await _db.UserTehsils
            .Where(x => x.UserId == actor.Id)
            .Select(x => x.Tehsil)
            .ToListAsync(ct);

        var systems = await _db.WaterSystems
            .Where(x => waterSystemIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Tehsil })
            .ToListAsync(ct);

        var found = new HashSet<string>(systems.Select(s => s.Id));
        foreach (var sid in waterSystemIds)
        {
            if (!found.Contains(sid))
                throw new ArgumentException($"Water system not found: {sid}");
        }

        var allowed = new HashSet<string>(actorTehsils);
        foreach (var ws in systems)
        {
            if (!allowed.Contains(ws.Tehsil))
                throw new TehsilAccessDeniedException($"Water system {ws.Id} is outside your tehsil scope — you cannot assign it");
        }
    }

    public async Task<HashSet<string>> OperatorTehsilsDerivedFromWaterSystemsAsync(User user, CancellationToken ct)
    {
        var waterSystemIds = await _db.UserWaterSystems
            .Where(x => x.UserId == user.Id)
            .Select(x => x.WaterSystemId)
            .ToListAsync(ct);

        if (waterSystemIds.Count == 0)
            return [];

        var tehsils = await _db.WaterSystems
            .Where(x => waterSystemIds.Contains(x.Id))
            .Select(x => x.Tehsil)
            .Distinct()
            .ToListAsync(ct);

        return tehsils.ToHashSet();
    }

    private static int RoleRank(string role) => role switch
    {
        RoleCodes.User => 1,
        RoleCodes.Admin => 2,
        RoleCodes.SuperAdmin => 3,
        RoleCodes.SystemAdmin => 4,
        _ => 0
    };
}

