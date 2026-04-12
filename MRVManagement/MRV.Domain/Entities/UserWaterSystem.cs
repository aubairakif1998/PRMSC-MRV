namespace MRV.Domain.Entities;

public sealed class UserWaterSystem
{
    public required string UserId { get; set; }
    public required string WaterSystemId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

