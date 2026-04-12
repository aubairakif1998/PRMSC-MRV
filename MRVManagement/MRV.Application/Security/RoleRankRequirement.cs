using Microsoft.AspNetCore.Authorization;

namespace MRV.Application.Security;

public sealed class RoleRankRequirement : IAuthorizationRequirement
{
    public RoleRankRequirement(int minimumRank)
    {
        MinimumRank = minimumRank;
    }

    public int MinimumRank { get; }
}

