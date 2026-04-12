using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MRV.Application.Persistence;
using MRV.Infrastructure.Persistence;

namespace MRV.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var dbConn = ResolveDatabaseConnectionString(configuration);

        services.AddDbContext<MRVDbContext>(options =>
        {
            options.UseNpgsql(dbConn);
        });

        services.AddScoped<IMrvDbContext>(sp => sp.GetRequiredService<MRVDbContext>());

        return services;
    }

    private static string? ResolveDatabaseConnectionString(IConfiguration configuration)
    {
        var cs = configuration.GetConnectionString("Database");
        if (!string.IsNullOrWhiteSpace(cs))
        {
            // Support both Npgsql key-value and postgres URI formats.
            if (cs.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
                cs.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
            {
                return ConvertPostgresUriToNpgsql(cs);
            }
            return cs;
        }

        var env = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(env))
            return ConvertPostgresUriToNpgsql(env);

        return cs;
    }

    private static string ConvertPostgresUriToNpgsql(string uriString)
    {
        // Accepts: postgresql://user:pass@host:port/dbname?sslmode=require
        var u = new Uri(uriString);

        var userInfo = (u.UserInfo ?? string.Empty).Split(':', 2);
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
        var host = u.Host;
        var port = u.IsDefaultPort ? 5432 : u.Port;
        var database = u.AbsolutePath.Trim('/'); // "/postgres" -> "postgres"

        // Parse sslmode if provided
        var sslMode = string.Empty;
        var trust = string.Empty;
        var query = u.Query.TrimStart('?');
        if (!string.IsNullOrWhiteSpace(query))
        {
            foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = pair.Split('=', 2);
                var k = kv[0];
                var v = kv.Length > 1 ? kv[1] : string.Empty;
                if (k.Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                    sslMode = v;
                if (k.Equals("trust_server_certificate", StringComparison.OrdinalIgnoreCase))
                    trust = v;
            }
        }

        var parts = new List<string>
        {
            $"Host={host}",
            $"Port={port}",
            $"Database={database}",
        };
        if (!string.IsNullOrWhiteSpace(username)) parts.Add($"Username={username}");
        if (!string.IsNullOrWhiteSpace(password)) parts.Add($"Password={password}");
        if (!string.IsNullOrWhiteSpace(sslMode)) parts.Add($"SSL Mode={sslMode}");
        if (!string.IsNullOrWhiteSpace(trust)) parts.Add($"Trust Server Certificate={trust}");

        return string.Join(';', parts);
    }
}

