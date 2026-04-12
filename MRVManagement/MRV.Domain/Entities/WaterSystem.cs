namespace MRV.Domain.Entities;

public sealed class WaterSystem
{
    public required string Id { get; set; }
    public required string Tehsil { get; set; }
    public required string Village { get; set; }
    public string? Settlement { get; set; }
    public required string UniqueIdentifier { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public string? PumpModel { get; set; }
    public string? PumpSerialNumber { get; set; }
    public DateOnly? StartOfOperation { get; set; }
    public double? DepthOfWaterIntake { get; set; }
    public double? HeightToOhr { get; set; }
    public double? PumpFlowRate { get; set; }

    public string? MeterModel { get; set; }
    public string? MeterSerialNumber { get; set; }
    public string? MeterAccuracyClass { get; set; }
    public string? CalibrationRequirement { get; set; }
    public DateOnly? InstallationDate { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

