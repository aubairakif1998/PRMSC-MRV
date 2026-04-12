namespace MRV.Application.Dtos.Users;

public sealed class OnboardOperatorRequestDto
{
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string Password { get; set; }
    public required List<string> WaterSystemIds { get; set; }
}

