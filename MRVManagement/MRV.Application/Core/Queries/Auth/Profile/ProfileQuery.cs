using MediatR;
using MRV.Application.Common;
using MRV.Application.Dtos;

namespace MRV.Application.Core.Queries.Auth.Profile;

public sealed class ProfileQuery : IRequest<ApiResponseDto<UserDto>>
{
    public required string UserId { get; init; }
}

