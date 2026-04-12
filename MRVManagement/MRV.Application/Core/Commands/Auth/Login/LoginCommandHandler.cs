using MediatR;
using Microsoft.EntityFrameworkCore;
using MRV.Application.Common;
using MRV.Application.Dtos;
using MRV.Application.Persistence;
using MRV.Application.Security;

namespace MRV.Application.Core.Commands.Auth.Login;

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, ApiResponseDto<LoginResponseDto>>
{
    private readonly IMrvDbContext _db;
    private readonly IWerkzeugPasswordHasher _hasher;
    private readonly IJwtTokenGenerator _jwt;

    public LoginCommandHandler(IMrvDbContext db, IWerkzeugPasswordHasher hasher, IJwtTokenGenerator jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    public async Task<ApiResponseDto<LoginResponseDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var email = request.Login.Email.Trim().ToLowerInvariant();
        var user = await _db.Users
            .Include(x => x.AssignedRole)
            .Include(x => x.TehsilLinks)
            .Include(x => x.WaterSystemLinks)
            .FirstOrDefaultAsync(x => x.Email.ToLower() == email, cancellationToken);

        if (user is null || !_hasher.Verify(user.PasswordHash, request.Login.Password))
        {
            return new ApiResponseDto<LoginResponseDto>
            {
                IsSuccess = false,
                Errors = [new ApiErrorDto { Message = "Invalid email or password", Type = "unauthorized" }],
                Data = new LoginResponseDto
                {
                    Token = string.Empty,
                    User = new UserDto { Id = string.Empty, Name = string.Empty, Role = string.Empty }
                }
            };
        }

        var role = user.AssignedRole?.Code ?? string.Empty;
        var tehsils = user.TehsilLinks.Select(t => t.Tehsil).ToList();
        var waterSystemIds = user.WaterSystemLinks.Select(w => w.WaterSystemId).ToList();

        var token = _jwt.CreateAccessToken(user, tehsils, waterSystemIds);

        return new ApiResponseDto<LoginResponseDto>
        {
            Data = new LoginResponseDto
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Role = role,
                    Tehsils = tehsils,
                    WaterSystemIds = waterSystemIds
                }
            }
        };
    }
}

