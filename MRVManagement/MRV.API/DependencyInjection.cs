using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using MRV.API.Middleware;
using Scalar.AspNetCore;

namespace MRV.API;

public static class DependencyInjection
{
    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = CorsOrigins.ResolveAllowlist(configuration);

        var dbConn = configuration.GetConnectionString("Database");
        var hc = services.AddHealthChecks();
        if (!string.IsNullOrWhiteSpace(dbConn))
        {
            hc.AddNpgSql(dbConn);
        }

        services.AddEndpointsApiExplorer();
        services.AddOpenApi();

        services.AddCors(options =>
        {
            options.AddPolicy(CorsOrigins.PolicyName, policy =>
            {
                policy
                    .WithOrigins(origins.ToArray())
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }

    public static WebApplication UseApiServices(this WebApplication app)
    {
        app.MapOpenApi();
        app.UseSwaggerUI(options => { options.SwaggerEndpoint("/openapi/v1.json", "v1"); });
        app.MapScalarApiReference(options => { options.Title = "PRMSC MRV APIs"; });

        app.UseMiddleware<ApiExceptionMiddleware>();
        app.UseCors(CorsOrigins.PolicyName);

        app.UseHealthChecks("/healthDb",
            new HealthCheckOptions { ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse });

        app.MapGet("/health", () => new { status = "healthy", timestamp = DateTime.UtcNow })
            .WithName("Health")
            .WithOpenApi();

        app.MapGet("/", () => "Welcome to PRMSC MRV APIs!")
            .WithName("Root")
            .WithOpenApi();

        return app;
    }
}

