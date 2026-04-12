namespace MRV.Domain.Entities;

public sealed class VerificationLog
{
    public required string Id { get; set; }
    public required string SubmissionId { get; set; }
    public required string ActionType { get; set; } // submit, accept, reject, revert, ...
    public required string PerformedBy { get; set; }
    public required string Role { get; set; }
    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

