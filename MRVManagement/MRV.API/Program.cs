using MRV.API;
using MRV.Application;
using MRV.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Flask-compatible env var mapping (so existing hosting env works):
// - DATABASE_URL -> ConnectionStrings:Database
// - JWT_SECRET_KEY -> Jwt:SigningKey
// - CORS_ORIGINS -> handled by CorsOrigins.ResolveAllowlist()
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (!string.IsNullOrWhiteSpace(databaseUrl) && string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("Database")))
{
    builder.Configuration["ConnectionStrings:Database"] = databaseUrl;
}

var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
if (!string.IsNullOrWhiteSpace(jwtSecret) && string.IsNullOrWhiteSpace(builder.Configuration["Jwt:SigningKey"]))
{
    builder.Configuration["Jwt:SigningKey"] = jwtSecret;
}

builder.Services
    .AddApplicationServices(builder.Configuration)
    .AddInfrastructureServices(builder.Configuration)
    .AddApiServices(builder.Configuration);

builder.Services.AddControllers()
    .AddJsonOptions(_ => { });

builder.Services.AddAuthenticationMiddlewares(builder.Configuration);

builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(Microsoft.Extensions.Logging.LogLevel.Information);

var app = builder.Build();

app.UseHttpsRedirection();

app.UseApiServices();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
