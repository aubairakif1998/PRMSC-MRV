namespace MRV.Application.Core.Commands.Auth.Login;

public sealed class LoginRequest
{
    public required string Email { get; set; }
    public required string Password { get; set; }
}
