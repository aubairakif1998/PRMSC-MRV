using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MRV.API.Controllers;

[ApiController]
[AllowAnonymous]
public sealed class MainController : ControllerBase
{
    [HttpGet("/")]
    public IActionResult Index() => Ok(new { status = "MRV API is running!", version = "1.0.0" });

    [HttpGet("/api/health")]
    public IActionResult Health() => Ok(new { status = "ok" });

    [HttpGet("/api/hello")]
    public IActionResult Hello() => Ok(new { message = "hello" });

    [HttpGet("/api/debug/cors-test")]
    public IActionResult CorsTest() => Ok(new { status = "ok", message = "CORS test endpoint" });
}

