namespace MRV.Domain.Entities;

public sealed class Submission
{
    public required string Id { get; set; }
    public required string OperatorId { get; set; }
    public required string SubmissionType { get; set; } // "water_system" | "solar_system"
    public required string RecordId { get; set; }

    public string Status { get; set; } = SubmissionStatuses.Drafted;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public string? ReviewedBy { get; set; }
    public string? ApprovedBy { get; set; }
    public string? Remarks { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

