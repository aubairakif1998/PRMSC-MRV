using Microsoft.AspNetCore.Authorization;
using MRV.Domain;

namespace MRV.Application.Security;

public sealed class RoleRankAuthorizationHandler : AuthorizationHandler<RoleRankRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, RoleRankRequirement requirement)
    {
        var role = context.User.FindFirst("role")?.Value;
        var rank = role switch
        {
            RoleCodes.User => 1,
            RoleCodes.Admin => 2,
            RoleCodes.SuperAdmin => 3,
            RoleCodes.SystemAdmin => 4,
            _ => 0
        };

        if (rank >= requirement.MinimumRank)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}

