using Microsoft.EntityFrameworkCore;
using MRV.Application.Persistence;

namespace MRV.Application.Services;

public interface IDashboardService
{
    Task<object> GetProgramSummaryAsync(string? tehsil, string? village, CancellationToken ct);
    Task<List<object>> GetWaterSuppliedAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct);
    Task<List<object>> GetPumpHoursAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct);
    Task<List<object>> GetSolarGenerationAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct);
    Task<List<object>> GetGridImportAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct);
}

public sealed class DashboardService : IDashboardService
{
    private readonly IMrvDbContext _db;

    public DashboardService(IMrvDbContext db)
    {
        _db = db;
    }

    public async Task<object> GetProgramSummaryAsync(string? tehsil, string? village, CancellationToken ct)
    {
        var ws = _db.WaterSystems.AsQueryable();
        var ss = _db.SolarSystems.AsQueryable();

        if (!string.IsNullOrWhiteSpace(tehsil) && tehsil != "All Tehsils")
        {
            ws = ws.Where(x => x.Tehsil == tehsil);
            ss = ss.Where(x => x.Tehsil == tehsil);
        }
        if (!string.IsNullOrWhiteSpace(village) && village != "All Villages")
        {
            ws = ws.Where(x => x.Village == village);
            ss = ss.Where(x => x.Village == village);
        }

        var ohrCount = await ws.CountAsync(ct);
        var solarFacilities = await ss.CountAsync(ct);
        var bulkMeters = await ws.CountAsync(x => x.MeterSerialNumber != null && x.MeterSerialNumber != "", ct);

        return new { ohr_count = ohrCount, solar_facilities = solarFacilities, bulk_meters = bulkMeters };
    }

    public async Task<List<object>> GetWaterSuppliedAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct)
    {
        var q = _db.WaterEnergyLoggingDaily
            .Join(_db.WaterSystems, r => r.WaterSystemId, s => s.Id, (r, s) => new { r, s })
            .Where(x => x.s.MeterSerialNumber != null && x.s.MeterSerialNumber != "");

        if (!string.IsNullOrWhiteSpace(tehsil) && tehsil != "All Tehsils") q = q.Where(x => x.s.Tehsil == tehsil);
        if (!string.IsNullOrWhiteSpace(village) && village != "All Villages") q = q.Where(x => x.s.Village == village);
        if (month is not null) q = q.Where(x => x.r.LogDate.Month == month);
        if (year is not null) q = q.Where(x => x.r.LogDate.Year == year);

        var results = await q
            .GroupBy(x => x.r.LogDate.Month)
            .Select(g => new { Month = g.Key, Total = g.Sum(x => x.r.TotalWaterPumped) ?? 0 })
            .OrderBy(x => x.Month)
            .ToListAsync(ct);

        var dict = results.ToDictionary(x => x.Month, x => (double)x.Total);
        var data = new List<object>();
        for (var m = 1; m <= 12; m++)
            data.Add(new { month = m, total_water_pumped = dict.GetValueOrDefault(m, 0) });
        return data;
    }

    public async Task<List<object>> GetPumpHoursAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct)
    {
        var q = _db.WaterEnergyLoggingDaily
            .Join(_db.WaterSystems, r => r.WaterSystemId, s => s.Id, (r, s) => new { r, s })
            .Where(x => x.s.MeterSerialNumber == null || x.s.MeterSerialNumber == "");

        if (!string.IsNullOrWhiteSpace(tehsil) && tehsil != "All Tehsils") q = q.Where(x => x.s.Tehsil == tehsil);
        if (!string.IsNullOrWhiteSpace(village) && village != "All Villages") q = q.Where(x => x.s.Village == village);
        if (month is not null) q = q.Where(x => x.r.LogDate.Month == month);
        if (year is not null) q = q.Where(x => x.r.LogDate.Year == year);

        var results = await q
            .GroupBy(x => x.r.LogDate.Month)
            .Select(g => new { Month = g.Key, Total = g.Sum(x => x.r.PumpOperatingHours) ?? 0 })
            .OrderBy(x => x.Month)
            .ToListAsync(ct);

        var dict = results.ToDictionary(x => x.Month, x => (double)x.Total);
        var data = new List<object>();
        for (var m = 1; m <= 12; m++)
            data.Add(new { month = m, pump_operating_hours = dict.GetValueOrDefault(m, 0) });
        return data;
    }

    public async Task<List<object>> GetSolarGenerationAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct)
    {
        var q = _db.SolarEnergyLoggingMonthly
            .Join(_db.SolarSystems, r => r.SolarSystemId, s => s.Id, (r, s) => new { r, s });

        if (!string.IsNullOrWhiteSpace(tehsil) && tehsil != "All Tehsils") q = q.Where(x => x.s.Tehsil == tehsil);
        if (!string.IsNullOrWhiteSpace(village) && village != "All Villages") q = q.Where(x => x.s.Village == village);
        if (month is not null) q = q.Where(x => x.r.Month == month);
        if (year is not null) q = q.Where(x => x.r.Year == year);

        var results = await q
            .GroupBy(x => x.r.Month)
            .Select(g => new { Month = g.Key, Total = g.Sum(x => x.r.EnergyExportedToGrid) ?? 0 })
            .OrderBy(x => x.Month)
            .ToListAsync(ct);

        var dict = results.ToDictionary(x => x.Month, x => (double)x.Total);
        var data = new List<object>();
        for (var m = 1; m <= 12; m++)
            data.Add(new { month = m, solar_generation_kwh = dict.GetValueOrDefault(m, 0) });
        return data;
    }

    public async Task<List<object>> GetGridImportAsync(string? tehsil, string? village, int? month, int? year, CancellationToken ct)
    {
        var q = _db.SolarEnergyLoggingMonthly
            .Join(_db.SolarSystems, r => r.SolarSystemId, s => s.Id, (r, s) => new { r, s });

        if (!string.IsNullOrWhiteSpace(tehsil) && tehsil != "All Tehsils") q = q.Where(x => x.s.Tehsil == tehsil);
        if (!string.IsNullOrWhiteSpace(village) && village != "All Villages") q = q.Where(x => x.s.Village == village);
        if (month is not null) q = q.Where(x => x.r.Month == month);
        if (year is not null) q = q.Where(x => x.r.Year == year);

        var results = await q
            .GroupBy(x => x.r.Month)
            .Select(g => new { Month = g.Key, Total = g.Sum(x => x.r.EnergyConsumedFromGrid) ?? 0 })
            .OrderBy(x => x.Month)
            .ToListAsync(ct);

        var dict = results.ToDictionary(x => x.Month, x => (double)x.Total);
        var data = new List<object>();
        for (var m = 1; m <= 12; m++)
            data.Add(new { month = m, grid_import_kwh = dict.GetValueOrDefault(m, 0) });
        return data;
    }
}

