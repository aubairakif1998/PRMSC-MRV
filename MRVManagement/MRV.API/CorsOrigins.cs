namespace MRV.API;

public static class CorsOrigins
{
    public const string PolicyName = "CorsOrigins";

    public static List<string> ResolveAllowlist(IConfiguration configuration)
    {
        // Primary source: appsettings.* -> Cors:Origins (array)
        var fromConfig = configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
        var configList = fromConfig
            .Select(NormalizeOrigin)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (configList.Count > 0)
            return configList;

        // Secondary source: Flask-compatible env var CORS_ORIGINS (comma-separated)
        var env = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? string.Empty;
        var envList = env.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeOrigin)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (envList.Count > 0)
            return envList;

        if (string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase))
        {
            return
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:4200",
                "http://127.0.0.1:4200",
            ];
        }

        throw new InvalidOperationException(
            "CORS origins are required outside Development. Set Cors:Origins (array) in appsettings, " +
            "or set CORS_ORIGINS as a comma-separated list (Flask-compatible).");
    }

    private static string NormalizeOrigin(string? value)
    {
        var o = (value ?? string.Empty).Trim();
        if (o.Length > 1 && o.EndsWith("/"))
            o = o.TrimEnd('/');
        return o;
    }
}

