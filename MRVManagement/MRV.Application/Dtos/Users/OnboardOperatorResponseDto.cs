namespace MRV.Application.Dtos.Users;

public sealed class OnboardOperatorResponseDto
{
    public required string Message { get; set; }
    public required UserListItemDto User { get; set; }
}

