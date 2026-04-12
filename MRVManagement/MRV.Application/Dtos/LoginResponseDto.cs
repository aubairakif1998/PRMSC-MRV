namespace MRV.Application.Dtos;

public sealed class LoginResponseDto
{
    public required string Token { get; set; }
    public required UserDto User { get; set; }
}

