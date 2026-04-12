using FluentValidation;
using MRV.Application.Dtos.Users;

namespace MRV.Application.Validators;

public sealed class OnboardOperatorRequestDtoValidator : AbstractValidator<OnboardOperatorRequestDto>
{
    public OnboardOperatorRequestDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.WaterSystemIds)
            .NotNull()
            .Must(x => x is { Count: > 0 })
            .WithMessage("water_system_ids must be a non-empty array");
    }
}

