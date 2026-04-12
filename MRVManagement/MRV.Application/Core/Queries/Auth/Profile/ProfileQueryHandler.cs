using MediatR;
using Microsoft.EntityFrameworkCore;
using MRV.Application.Common;
using MRV.Application.Dtos;
using MRV.Application.Persistence;

namespace MRV.Application.Core.Queries.Auth.Profile;

public sealed class ProfileQueryHandler : IRequestHandler<ProfileQuery, ApiResponseDto<UserDto>>
{
    private readonly IMrvDbContext _db;

    public ProfileQueryHandler(IMrvDbContext db)
    {
        _db = db;
    }

    public async Task<ApiResponseDto<UserDto>> Handle(ProfileQuery request, CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .Include(x => x.AssignedRole)
            .Include(x => x.TehsilLinks)
            .Include(x => x.WaterSystemLinks)
            .FirstOrDefaultAsync(x => x.Id == request.UserId, cancellationToken);

        if (user is null)
        {
            return new ApiResponseDto<UserDto>
            {
                IsSuccess = false,
                Errors = [new ApiErrorDto { Message = "User not found", Type = "not_found" }],
                Data = new UserDto { Id = string.Empty, Name = string.Empty, Role = string.Empty }
            };
        }

        return new ApiResponseDto<UserDto>
        {
            Data = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Role = user.AssignedRole?.Code ?? string.Empty,
                Tehsils = user.TehsilLinks.Select(x => x.Tehsil).ToList(),
                WaterSystemIds = user.WaterSystemLinks.Select(x => x.WaterSystemId).ToList()
            }
        };
    }
}

