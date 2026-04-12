using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MRV.Application.Security;
using MRV.Application.Services;
using System.Reflection;

namespace MRV.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
        });
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddSingleton<IWerkzeugPasswordHasher, WerkzeugPasswordHasher>();
        services.AddScoped<ITehsilAccessService, TehsilAccessService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IUserManagementService, UserManagementService>();

        return services;
    }

    public static IServiceCollection AddAuthenticationMiddlewares(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddAuthentication("Bearer")
            .AddJwtBearer("Bearer", options =>
            {
                var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
                options.TokenValidationParameters = JwtTokenGenerator.BuildTokenValidationParameters(jwt);
            });

        services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, RoleRankAuthorizationHandler>();

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthPolicies.MinUser, p => p.AddRequirements(new RoleRankRequirement(1)));
            options.AddPolicy(AuthPolicies.MinAdmin, p => p.AddRequirements(new RoleRankRequirement(2)));
            options.AddPolicy(AuthPolicies.MinSuperAdmin, p => p.AddRequirements(new RoleRankRequirement(3)));
            options.AddPolicy(AuthPolicies.MinSystemAdmin, p => p.AddRequirements(new RoleRankRequirement(4)));
        });

        return services;
    }
}

