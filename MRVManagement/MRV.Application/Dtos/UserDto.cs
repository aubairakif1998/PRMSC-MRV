namespace MRV.Application.Dtos;

public sealed class UserDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Role { get; set; }
    public List<string> Tehsils { get; set; } = [];
    public List<string> WaterSystemIds { get; set; } = [];
}

