using Microsoft.EntityFrameworkCore;
using MRV.Application.Dtos.Users;
using MRV.Application.Persistence;
using MRV.Application.Security;
using MRV.Domain;
using MRV.Domain.Entities;

namespace MRV.Application.Services;

public interface IUserManagementService
{
    Task<List<UserListItemDto>> ListUsersAsync(CancellationToken ct);
    Task<UserListItemDto> CreateTubewellOperatorAsync(string actorUserId, OnboardOperatorRequestDto request, CancellationToken ct);
}

public sealed class UserManagementService : IUserManagementService
{
    private readonly IMrvDbContext _db;
    private readonly IWerkzeugPasswordHasher _hasher;
    private readonly ITehsilAccessService _tehsilAccess;

    public UserManagementService(IMrvDbContext db, IWerkzeugPasswordHasher hasher, ITehsilAccessService tehsilAccess)
    {
        _db = db;
        _hasher = hasher;
        _tehsilAccess = tehsilAccess;
    }

    public async Task<List<UserListItemDto>> ListUsersAsync(CancellationToken ct)
    {
        var users = await _db.Users
            .Include(x => x.AssignedRole)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        var userIds = users.Select(u => u.Id).ToList();
        var tehsilLinks = await _db.UserTehsils.Where(x => userIds.Contains(x.UserId)).ToListAsync(ct);
        var wsLinks = await _db.UserWaterSystems.Where(x => userIds.Contains(x.UserId)).ToListAsync(ct);

        var byTehsil = tehsilLinks.GroupBy(x => x.UserId).ToDictionary(g => g.Key, g => g.Select(x => x.Tehsil).ToList());
        var byWs = wsLinks.GroupBy(x => x.UserId).ToDictionary(g => g.Key, g => g.Select(x => x.WaterSystemId).ToList());

        // Derive operator tehsils from assigned water systems (Flask behavior)
        var allWsIds = wsLinks.Select(x => x.WaterSystemId).Distinct().ToList();
        var wsTehsils = await _db.WaterSystems
            .Where(x => allWsIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Tehsil })
            .ToListAsync(ct);
        var tehsilByWaterSystem = wsTehsils.ToDictionary(x => x.Id, x => x.Tehsil);

        var result = new List<UserListItemDto>();
        foreach (var u in users)
        {
            var role = u.AssignedRole?.Code ?? string.Empty;
            var wids = byWs.TryGetValue(u.Id, out var list) ? list : [];
            var tehsils = role == RoleCodes.User
                ? wids.Select(id => tehsilByWaterSystem.GetValueOrDefault(id)).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList()
                : (byTehsil.TryGetValue(u.Id, out var tl) ? tl : []);

            result.Add(new UserListItemDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Role = role,
                Tehsils = tehsils,
                WaterSystemIds = wids,
                CreatedAt = u.CreatedAt == default ? null : u.CreatedAt.ToString("O")
            });
        }

        return result;
    }

    public async Task<UserListItemDto> CreateTubewellOperatorAsync(string actorUserId, OnboardOperatorRequestDto request, CancellationToken ct)
    {
        var actor = await _db.Users
            .Include(x => x.AssignedRole)
            .FirstOrDefaultAsync(x => x.Id == actorUserId, ct);
        if (actor is null)
            throw new KeyNotFoundException("User not found");

        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(x => x.Email.ToLower() == email, ct))
            throw new ArgumentException("User already exists with this email");

        var ids = request.WaterSystemIds
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct()
            .ToList();

        await _tehsilAccess.AssertActorMayAssignWaterSystemsToOperatorAsync(actor, ids, ct);

        var roleRow = await _db.Roles.FirstOrDefaultAsync(x => x.Code == RoleCodes.User, ct);
        if (roleRow is null)
            throw new ArgumentException("System roles are not initialized; run database migrations");

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            RoleId = roleRow.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        foreach (var wsid in ids)
        {
            _db.UserWaterSystems.Add(new UserWaterSystem
            {
                UserId = user.Id,
                WaterSystemId = wsid,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync(ct);

        // Derive tehsils from water systems
        var tehsils = await _db.WaterSystems
            .Where(x => ids.Contains(x.Id))
            .Select(x => x.Tehsil)
            .Distinct()
            .ToListAsync(ct);

        return new UserListItemDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = RoleCodes.User,
            Tehsils = tehsils,
            WaterSystemIds = ids,
            CreatedAt = user.CreatedAt.ToString("O")
        };
    }
}

