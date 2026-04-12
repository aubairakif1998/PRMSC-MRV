using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MRV.Application.Dtos.Users;
using MRV.Application.Security;
using MRV.Application.Services;
using System.IdentityModel.Tokens.Jwt;

namespace MRV.API.Controllers;

[ApiController]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
    private readonly IUserManagementService _users;

    public UsersController(IUserManagementService users)
    {
        _users = users;
    }

    [HttpGet("")]
    [Authorize(Policy = AuthPolicies.MinSuperAdmin)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await _users.ListUsersAsync(ct);
        return Ok(new { users = items });
    }

    [HttpPost("onboard-operator")]
    [Authorize(Policy = AuthPolicies.MinAdmin)]
    public async Task<IActionResult> OnboardOperator([FromBody] OnboardOperatorRequestDto request, CancellationToken ct)
    {
        var actorUserId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                         ?? User.FindFirst("sub")?.Value
                         ?? string.Empty;

        try
        {
            var user = await _users.CreateTubewellOperatorAsync(actorUserId, request, ct);
            return StatusCode(StatusCodes.Status201Created, new { message = "Tubewell operator created", user });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (TehsilAccessDeniedException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

