namespace MRV.Application.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "mrv-api";
    public string Audience { get; set; } = "mrv-clients";
    public string SigningKey { get; set; } = "change-me";
    public int AccessTokenHours { get; set; } = 24;
}

