using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MRV.Application.Services;

namespace MRV.API.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboard;

    public DashboardController(IDashboardService dashboard)
    {
        _dashboard = dashboard;
    }

    [HttpGet("program-summary")]
    public async Task<IActionResult> ProgramSummary([FromQuery] string? tehsil, [FromQuery] string? village, CancellationToken ct)
        => Ok(await _dashboard.GetProgramSummaryAsync(tehsil, village, ct));

    [HttpGet("water-supplied")]
    public async Task<IActionResult> WaterSupplied([FromQuery] string? tehsil, [FromQuery] string? village, [FromQuery] int? month, [FromQuery] int? year, CancellationToken ct)
        => Ok(await _dashboard.GetWaterSuppliedAsync(tehsil, village, month, year, ct));

    [HttpGet("pump-hours")]
    public async Task<IActionResult> PumpHours([FromQuery] string? tehsil, [FromQuery] string? village, [FromQuery] int? month, [FromQuery] int? year, CancellationToken ct)
        => Ok(await _dashboard.GetPumpHoursAsync(tehsil, village, month, year, ct));

    [HttpGet("solar-generation")]
    public async Task<IActionResult> SolarGeneration([FromQuery] string? tehsil, [FromQuery] string? village, [FromQuery] int? month, [FromQuery] int? year, CancellationToken ct)
        => Ok(await _dashboard.GetSolarGenerationAsync(tehsil, village, month, year, ct));

    [HttpGet("grid-import")]
    public async Task<IActionResult> GridImport([FromQuery] string? tehsil, [FromQuery] string? village, [FromQuery] int? month, [FromQuery] int? year, CancellationToken ct)
        => Ok(await _dashboard.GetGridImportAsync(tehsil, village, month, year, ct));
}

