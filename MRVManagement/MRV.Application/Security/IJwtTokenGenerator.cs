using MRV.Domain.Entities;

namespace MRV.Application.Security;

public interface IJwtTokenGenerator
{
    string CreateAccessToken(User user, IEnumerable<string> tehsils, IEnumerable<string> waterSystemIds);
}

