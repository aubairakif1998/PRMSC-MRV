using MediatR;
using MRV.Application.Common;
using MRV.Application.Dtos;

namespace MRV.Application.Core.Commands.Auth.Login;

public sealed class LoginCommand : IRequest<ApiResponseDto<LoginResponseDto>>
{
    public required LoginRequest Login { get; init; }
}

