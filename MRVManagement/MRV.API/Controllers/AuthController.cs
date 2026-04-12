using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MRV.Application.Common;
using MRV.Application.Core.Commands.Auth.Login;
using MRV.Application.Core.Queries.Auth.Profile;
using MRV.Application.Dtos;
using System.IdentityModel.Tokens.Jwt;

namespace MRV.API.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly ISender _sender;

    public AuthController(ISender sender)
    {
        _sender = sender;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponseDto<LoginResponseDto>), StatusCodes.Status200OK)]
    public async Task<ApiResponseDto<LoginResponseDto>> Login([FromBody] LoginRequest request)
    {
        return await _sender.Send(new LoginCommand { Login = request });
    }

    [Authorize]
    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponseDto<UserDto>), StatusCodes.Status200OK)]
    public async Task<ApiResponseDto<UserDto>> Profile()
    {
        var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                     ?? User.FindFirst("sub")?.Value
                     ?? string.Empty;

        return await _sender.Send(new ProfileQuery { UserId = userId });
    }
}

