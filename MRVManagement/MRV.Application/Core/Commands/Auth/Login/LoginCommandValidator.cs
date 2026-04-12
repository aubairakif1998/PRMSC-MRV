using FluentValidation;

namespace MRV.Application.Core.Commands.Auth.Login;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Login.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Login.Password).NotEmpty();
    }
}

