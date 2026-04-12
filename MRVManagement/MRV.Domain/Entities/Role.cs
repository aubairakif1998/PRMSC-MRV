namespace MRV.Domain.Entities;

public sealed class Role
{
    public required string Id { get; set; }
    public required string Code { get; set; }
    public required string DisplayName { get; set; }
    public int HierarchyRank { get; set; }
    public List<string> Permissions { get; set; } = [];

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

