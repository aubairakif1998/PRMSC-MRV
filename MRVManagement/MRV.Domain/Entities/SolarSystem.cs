namespace MRV.Domain.Entities;

public sealed class SolarSystem
{
    public required string Id { get; set; }
    public required string Tehsil { get; set; }
    public required string Village { get; set; }
    public string? Settlement { get; set; }
    public required string UniqueIdentifier { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public string? InstallationLocation { get; set; }
    public double? SolarPanelCapacity { get; set; }
    public double? InverterCapacity { get; set; }
    public string? InverterSerialNumber { get; set; }
    public DateOnly? InstallationDate { get; set; }

    public string? MeterModel { get; set; }
    public string? MeterSerialNumber { get; set; }
    public DateOnly? GreenMeterConnectionDate { get; set; }
    public string? Remarks { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

