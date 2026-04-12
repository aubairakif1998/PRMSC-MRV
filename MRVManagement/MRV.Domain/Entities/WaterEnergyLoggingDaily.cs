namespace MRV.Domain.Entities;

public sealed class WaterEnergyLoggingDaily
{
    public required string Id { get; set; }
    public required string WaterSystemId { get; set; }
    public DateOnly LogDate { get; set; }

    public TimeOnly? PumpStartTime { get; set; }
    public TimeOnly? PumpEndTime { get; set; }
    public double? PumpOperatingHours { get; set; }
    public double? TotalWaterPumped { get; set; }

    public string? BulkMeterImageUrl { get; set; }
    public string Status { get; set; } = SubmissionStatuses.Drafted;
    public string? Remarks { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

