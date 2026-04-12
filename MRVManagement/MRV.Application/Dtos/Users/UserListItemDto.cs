namespace MRV.Application.Dtos.Users;

public sealed class UserListItemDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string Role { get; set; }
    public List<string> Tehsils { get; set; } = [];
    public List<string> WaterSystemIds { get; set; } = [];
    public string? CreatedAt { get; set; }
}

