namespace MRV.Domain.Entities;

public sealed class UserTehsil
{
    public required string UserId { get; set; }
    public required string Tehsil { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

