namespace MRV.Domain.Entities;

public sealed class User
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public string? Phone { get; set; }

    public required string RoleId { get; set; }
    public Role? AssignedRole { get; set; }

    public List<UserTehsil> TehsilLinks { get; set; } = [];
    public List<UserWaterSystem> WaterSystemLinks { get; set; } = [];

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

