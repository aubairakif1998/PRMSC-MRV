namespace MRV.Domain.Entities;

public sealed class Notification
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public required string Title { get; set; }
    public required string Message { get; set; }

    public string? SubmissionId { get; set; }
    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

