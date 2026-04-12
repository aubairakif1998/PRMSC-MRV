namespace MRV.Domain.Entities;

public sealed class SolarEnergyLoggingMonthly
{
    public required string Id { get; set; }
    public required string SolarSystemId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }

    public double? EnergyConsumedFromGrid { get; set; }
    public double? EnergyExportedToGrid { get; set; }
    public string? ElectricityBillImageUrl { get; set; }
    public string? Remarks { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

